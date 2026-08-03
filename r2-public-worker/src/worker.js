// Serves objects from the 'emerald' R2 bucket over plain HTTPS GET, so browser
// <img>/<audio> tags can load them directly. R2's S3 API endpoint always
// requires signed requests, even for reads — this Worker is the public front
// door in front of it. Deployed at <name>.<account>.workers.dev, which works
// without the domain's nameservers being on Cloudflare.

export default {
  async fetch(request, env) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", { status: 405 });
    }

    const url = new URL(request.url);
    const key = decodeURIComponent(url.pathname.slice(1)); // strip leading '/'
    if (!key) {
      return new Response("Not found", { status: 404 });
    }

    const object = await env.BUCKET.get(key);
    if (!object) {
      return new Response("Not found", { status: 404 });
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    headers.set("cache-control", "public, max-age=31536000, immutable");

    return new Response(request.method === "HEAD" ? null : object.body, { headers });
  },
};
