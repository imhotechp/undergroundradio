// Serves objects from the 'emerald' R2 bucket over plain HTTPS GET, so browser
// <img>/<audio>/<video> tags can load them directly. R2's S3 API endpoint always
// requires signed requests, even for reads — this Worker is the public front
// door in front of it. Deployed at <name>.<account>.workers.dev, which works
// without the domain's nameservers being on Cloudflare.
//
// SECURITY: the endpoint that uploads into this bucket doesn't authenticate the
// uploader and only validates the filename — so an object named track.mp4 could
// contain anything, including HTML/JS. Content-Type is therefore derived only
// from the extension via the allowlist below, NEVER from the object's stored
// httpMetadata or anything client-supplied; an unrecognized extension is
// rejected outright (415) without serving its bytes. X-Content-Type-Options
// and Content-Security-Policy below back that up by stopping the browser from
// sniffing or executing a response even if something slipped past this. (A
// workers.dev origin is also already separate from mp3juug.com, so app session
// cookies aren't reachable here even in the worst case — this is about turning
// a malicious upload into an inert download, not a cross-origin cookie risk.)

const CONTENT_TYPES = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/mp4",
  flac: "audio/flac",
  aac: "audio/aac",
  ogg: "audio/ogg",
  mp4: "video/mp4",
  m4v: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
};

function basename(key) {
  return key.split("/").pop() || "";
}

function extensionOf(key) {
  const base = basename(key);
  const idx = base.lastIndexOf(".");
  if (idx === -1 || idx === base.length - 1) return "";
  return base.slice(idx + 1).toLowerCase();
}

// Conservative allowlist rather than trying to escape every character that
// could break a header value or smuggle control chars through it.
function sanitizeFilename(key) {
  return basename(key).replace(/[^\w.-]/g, "_") || "file";
}

// Single-range "bytes=start-end" / "bytes=start-" / "bytes=-suffix" only —
// media players only ever request one range at a time when seeking, and
// multi-range (comma-separated) headers just fail this regex and fall back
// to a full response below, which is a safe degradation.
function parseRange(rangeHeader, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader || "");
  if (!match) return null;
  const [, startStr, endStr] = match;
  if (startStr === "" && endStr === "") return null;

  let start, end;
  if (startStr === "") {
    const suffixLength = parseInt(endStr, 10);
    if (Number.isNaN(suffixLength) || suffixLength <= 0) return null;
    start = Math.max(size - suffixLength, 0);
    end = size - 1;
  } else {
    start = parseInt(startStr, 10);
    end = endStr === "" ? size - 1 : parseInt(endStr, 10);
  }

  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  if (start >= size) return "unsatisfiable";
  if (start > end) return null;
  end = Math.min(end, size - 1);
  return { start, end };
}

function securityHeaders(headers) {
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Content-Security-Policy", "default-src 'none'; sandbox");
  return headers;
}

function errorResponse(status, message, extra) {
  const headers = securityHeaders(new Headers(extra));
  return new Response(message, { status, headers });
}

// Builds the headers shared by the 200 (full) and 206 (partial) success paths.
// Object keys are timestamp-prefixed and never reused, so a long-lived
// immutable cache is safe even though Content-Type is now extension-derived
// rather than taken from the object.
function buildHeaders({ contentType, key, etag, size, range }) {
  const headers = securityHeaders(new Headers());
  headers.set("content-type", contentType);
  headers.set("content-disposition", `inline; filename="${sanitizeFilename(key)}"`);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("accept-ranges", "bytes");
  if (etag) headers.set("etag", etag);

  if (range) {
    headers.set("content-range", `bytes ${range.start}-${range.end}/${size}`);
    headers.set("content-length", String(range.end - range.start + 1));
  } else {
    headers.set("content-length", String(size));
  }

  return headers;
}

export default {
  async fetch(request, env) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return errorResponse(405, "Method not allowed");
    }

    const url = new URL(request.url);
    const key = decodeURIComponent(url.pathname.slice(1)); // strip leading '/'
    if (!key) {
      return errorResponse(404, "Not found");
    }

    const contentType = CONTENT_TYPES[extensionOf(key)];
    if (!contentType) {
      return errorResponse(415, "Unsupported file type");
    }

    // HEAD never carries a body to partition, so it always answers with the
    // full resource's headers regardless of any Range request — matching how
    // most real-world servers handle HEAD+Range.
    if (request.method === "HEAD") {
      const meta = await env.BUCKET.head(key);
      if (!meta) return errorResponse(404, "Not found");
      const headers = buildHeaders({ contentType, key, etag: meta.httpEtag, size: meta.size });
      return new Response(null, { status: 200, headers });
    }

    const rangeHeader = request.headers.get("range");
    if (rangeHeader) {
      const meta = await env.BUCKET.head(key);
      if (!meta) return errorResponse(404, "Not found");

      const range = parseRange(rangeHeader, meta.size);
      if (range === "unsatisfiable") {
        return errorResponse(416, "Range Not Satisfiable", { "content-range": `bytes */${meta.size}` });
      }
      if (range) {
        const object = await env.BUCKET.get(key, { range: { offset: range.start, length: range.end - range.start + 1 } });
        if (!object) return errorResponse(404, "Not found");
        const headers = buildHeaders({ contentType, key, etag: meta.httpEtag, size: meta.size, range });
        return new Response(object.body, { status: 206, headers });
      }
      // Range header present but unparseable (e.g. multi-range) — fall
      // through to a full response rather than erroring.
    }

    const object = await env.BUCKET.get(key);
    if (!object) {
      return errorResponse(404, "Not found");
    }
    const headers = buildHeaders({ contentType, key, etag: object.httpEtag, size: object.size });
    return new Response(object.body, { status: 200, headers });
  },
};
