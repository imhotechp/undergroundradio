export interface Point {
  x: number;
  y: number;
}

export interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function parseViewBox(svg: string): ViewBox {
  const match = svg.match(/viewBox=["']([^"']+)["']/);
  if (!match) {
    const w = Number(svg.match(/width=["']([^"']+)["']/)?.[1] ?? 100);
    const h = Number(svg.match(/height=["']([^"']+)["']/)?.[1] ?? 100);
    return { x: 0, y: 0, w, h };
  }
  const [x, y, w, h] = match[1].split(/\s+/).map(Number);
  return { x: x ?? 0, y: y ?? 0, w: w ?? 100, h: h ?? 100 };
}

/** Recolor SVG fill for light/dark theme. */
export function tintSvg(svg: string, fill: string): string {
  return svg
    .replace(/fill:\s*#fff/gi, `fill: ${fill}`)
    .replace(/fill:\s*#ffffff/gi, `fill: ${fill}`)
    .replace(/fill="#fff"/gi, `fill="${fill}"`);
}

export function svgToImage(svg: string, width: number, height: number): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.width = width;
    img.height = height;
    img.src = url;
  });
}

/**
 * Sample points along the primary <path> in an SVG, transformed to viewBox space.
 */
export function sampleSvgPath(svg: string, samples = 140): Point[] {
  if (typeof document === "undefined") return [];

  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-9999px;top:-9999px;visibility:hidden;";
  host.innerHTML = svg;
  document.body.appendChild(host);

  const svgEl = host.querySelector("svg");
  const path = host.querySelector("path");
  const points: Point[] = [];

  if (svgEl && path) {
    const len = path.getTotalLength();
    const ctm = path.getCTM();
    for (let i = 0; i <= samples; i++) {
      const p = path.getPointAtLength((len * i) / samples);
      if (ctm) {
        const pt = svgEl.createSVGPoint();
        pt.x = p.x;
        pt.y = p.y;
        const t = pt.matrixTransform(ctm);
        points.push({ x: t.x, y: t.y });
      } else {
        points.push({ x: p.x, y: p.y });
      }
    }
  }

  document.body.removeChild(host);
  return points;
}

export interface PreparedLetter {
  char: string;
  image: HTMLImageElement;
  viewBox: ViewBox;
  width: number;
  height: number;
  /** Path points in letter-local pixel space (0..width, 0..height). */
  pathPoints: Point[];
}

export async function prepareLetter(
  char: string,
  svg: string,
  targetHeight: number,
  paintColor: string,
): Promise<PreparedLetter> {
  const tinted = tintSvg(svg, paintColor);
  const viewBox = parseViewBox(tinted);
  const scale = targetHeight / viewBox.h;
  const width = Math.ceil(viewBox.w * scale);
  const height = Math.ceil(viewBox.h * scale);
  const image = await svgToImage(tinted, width, height);

  const rawPoints = sampleSvgPath(tinted, 160);
  const pathPoints = rawPoints.map((p) => ({
    x: (p.x - viewBox.x) * scale,
    y: (p.y - viewBox.y) * scale,
  }));

  return { char, image, viewBox, width, height, pathPoints };
}

export interface LetterLayout extends PreparedLetter {
  x: number;
  y: number;
}

export function layoutLetters(letters: PreparedLetter[], gap: number): LetterLayout[] {
  const maxH = Math.max(...letters.map((l) => l.height), 1);
  let x = 0;
  return letters.map((letter) => {
    const layout: LetterLayout = {
      ...letter,
      x,
      y: (maxH - letter.height) / 2,
    };
    x += letter.width + gap;
    return layout;
  });
}

export interface LayoutResult {
  layouts: LetterLayout[];
  contentW: number;
  contentH: number;
}

/** Single horizontal row — best for wide screens. */
export function layoutLettersRow(letters: PreparedLetter[], gap: number): LayoutResult {
  const layouts = layoutLetters(letters, gap);
  const contentW =
    layouts.length > 0 ? layouts[layouts.length - 1].x + layouts[layouts.length - 1].width : 1;
  const contentH = Math.max(...layouts.map((l) => l.height), 1);
  return { layouts, contentW, contentH };
}

/**
 * Two centered rows — "underground" / "radio" for narrow viewports.
 * `breakAfter` = number of letters on the first line.
 */
export function layoutLettersWrapped(
  letters: PreparedLetter[],
  gap: number,
  breakAfter: number,
): LayoutResult {
  const line1 = letters.slice(0, breakAfter);
  const line2 = letters.slice(breakAfter);
  const row1 = layoutLetters(line1, gap);
  const row2 = layoutLetters(line2, gap);

  const w1 = row1.length ? row1[row1.length - 1].x + row1[row1.length - 1].width : 0;
  const w2 = row2.length ? row2[row2.length - 1].x + row2[row2.length - 1].width : 0;
  const contentW = Math.max(w1, w2, 1);

  const h1 = row1.length ? Math.max(...row1.map((l) => l.height)) : 0;
  const h2 = row2.length ? Math.max(...row2.map((l) => l.height)) : 0;
  const lineGap = Math.max(gap * 2.5, 8);
  const contentH = h1 + (row2.length ? lineGap + h2 : 0);

  const layouts: LetterLayout[] = [
    ...row1.map((letter) => ({
      ...letter,
      x: letter.x + (contentW - w1) / 2,
      y: (h1 - letter.height) / 2,
    })),
    ...row2.map((letter) => ({
      ...letter,
      x: letter.x + (contentW - w2) / 2,
      y: h1 + lineGap + (h2 - letter.height) / 2,
    })),
  ];

  return { layouts, contentW, contentH };
}

/** Pick layout mode from viewport width (CSS pixels). */
export function pickLayout(
  letters: PreparedLetter[],
  viewportWidth: number,
  gap: number,
  breakAfter = 11,
): LayoutResult {
  if (viewportWidth < 960) {
    return layoutLettersWrapped(letters, gap, breakAfter);
  }
  return layoutLettersRow(letters, gap);
}

/** Responsive padding in CSS pixels. */
export function getResponsivePadding(viewportWidth: number, viewportHeight: number) {
  const edge = Math.min(viewportWidth, viewportHeight);
  return Math.max(12, Math.min(48, edge * 0.04));
}

export function computeFitTransform(
  contentW: number,
  contentH: number,
  containerW: number,
  containerH: number,
  padding: number,
) {
  const availW = Math.max(1, containerW - padding * 2);
  const availH = Math.max(1, containerH - padding * 2);
  const scale = Math.min(availW / contentW, availH / contentH);
  const drawW = contentW * scale;
  const drawH = contentH * scale;
  const offsetX = (containerW - drawW) / 2;
  const offsetY = (containerH - drawH) / 2;
  return { scale, offsetX, offsetY, drawW, drawH };
}

/** Map letter-local point to canvas coordinates. */
export function toCanvasPoint(
  letter: LetterLayout,
  point: Point,
  fit: ReturnType<typeof computeFitTransform>,
): Point {
  return {
    x: fit.offsetX + (letter.x + point.x) * fit.scale,
    y: fit.offsetY + (letter.y + point.y) * fit.scale,
  };
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
  alpha: number;
  drag?: number;
  glow?: number;
  gravity?: number;
}

/** Single aerosol speckle. */
export function drawSprayDot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  alpha: number,
  color: string,
) {
  const rgb = hexToRgb(color);
  ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Realistic spray stamp: many fine dots in a soft cloud + a tight core.
 * `angle` points in the direction the can is moving (radians).
 */
export function sprayStamp(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  angle = 0,
  intensity = 1,
) {
  const rgb = hexToRgb(color);
  const speckles = Math.floor(10 + intensity * 14);

  for (let i = 0; i < speckles; i++) {
    const t = Math.random();
    const spread = radius * (0.25 + t * 0.95);
    const a = angle + (Math.random() - 0.5) * 1.35;
    const dist = Math.random() * spread;
    const px = x + Math.cos(a) * dist * 0.55 + (Math.random() - 0.5) * radius * 0.35;
    const py = y + Math.sin(a) * dist * 0.55 + (Math.random() - 0.5) * radius * 0.35;
    const r = (Math.random() * 1.1 + 0.25) * Math.max(0.6, radius * 0.08);
    const alpha = (Math.random() * 0.35 + 0.12) * intensity;
    drawSprayDot(ctx, px, py, r, alpha, color);
  }

  const core = ctx.createRadialGradient(x, y, 0, x, y, radius * 0.45);
  core.addColorStop(0, `rgba(${rgb.r},${rgb.g},${rgb.b},${0.55 * intensity})`);
  core.addColorStop(0.45, `rgba(${rgb.r},${rgb.g},${rgb.b},${0.22 * intensity})`);
  core.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},0)`);
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(x, y, radius * 0.45, 0, Math.PI * 2);
  ctx.fill();
}

/** @deprecated use sprayStamp */
export function drawSpraySplat(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  alpha = 1,
  color = "#ffffff",
) {
  sprayStamp(ctx, x, y, radius, color, 0, alpha);
}

/** Single shared progress for mask, nozzle, mist, and residue (0–1). */
export function getLetterSprayState(
  letter: LetterLayout,
  fit: ReturnType<typeof computeFitTransform>,
  progress: number,
) {
  const t = Math.min(1, Math.max(0, progress));
  const pts = letter.pathPoints;

  if (pts.length < 2) {
    const lx = fit.offsetX + letter.x * fit.scale;
    const ly = fit.offsetY + letter.y * fit.scale;
    const lw = letter.width * fit.scale;
    const lh = letter.height * fit.scale;
    return {
      progress: t,
      endIdx: 0,
      nozzle: { x: lx + lw * 0.5, y: ly + lh * 0.5 },
      angle: 0,
    };
  }

  const endIdx = Math.max(1, Math.floor(t * (pts.length - 1)));
  const nozzleIdx = Math.min(endIdx, pts.length - 1);
  const nozzle = toCanvasPoint(letter, pts[nozzleIdx], fit);
  const prev = pts[Math.max(0, nozzleIdx - 1)];
  const angle = Math.atan2(pts[nozzleIdx].y - prev.y, pts[nozzleIdx].x - prev.x);

  return { progress: t, endIdx, nozzle, angle };
}

/** @deprecated use linear progress via getLetterSprayState */
export function easeSprayProgress(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c;
}

function seededUnit(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function drawSmoothPath(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  width: number,
  alpha: number,
) {
  if (points.length < 2) return;

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = width;
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  for (let i = 1; i < points.length - 1; i++) {
    const current = points[i];
    const next = points[i + 1];
    ctx.quadraticCurveTo(current.x, current.y, (current.x + next.x) / 2, (current.y + next.y) / 2);
  }

  const last = points[points.length - 1];
  ctx.lineTo(last.x, last.y);
  ctx.stroke();
  ctx.restore();
}

function drawPressurePasses(maskCtx: CanvasRenderingContext2D, points: Point[], strokeW: number) {
  drawSmoothPath(maskCtx, points, strokeW * 2.45, 0.12);
  drawSmoothPath(maskCtx, points, strokeW * 1.85, 0.22);

  for (let pass = 0; pass < 3; pass++) {
    const jittered = points.map((p, i) => {
      const n = seededUnit(i * 17 + pass * 101);
      const wobble = (n - 0.5) * strokeW * 0.18;
      const prev = points[Math.max(0, i - 1)];
      const next = points[Math.min(points.length - 1, i + 1)];
      const angle = Math.atan2(next.y - prev.y, next.x - prev.x) + Math.PI / 2;
      return {
        x: p.x + Math.cos(angle) * wobble,
        y: p.y + Math.sin(angle) * wobble,
      };
    });
    drawSmoothPath(maskCtx, jittered, strokeW * (1.08 - pass * 0.12), 0.24);
  }

  drawSmoothPath(maskCtx, points, strokeW * 0.96, 0.92);
}

function drawSettledCoverage(maskCtx: CanvasRenderingContext2D, points: Point[], strokeW: number) {
  const step = Math.max(4, Math.floor(points.length / 34));

  maskCtx.save();
  for (let i = 0; i < points.length; i += step) {
    const p = points[i];
    const pulse = 0.72 + seededUnit(i * 43) * 0.56;
    const radius = strokeW * pulse;
    const fill = maskCtx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
    fill.addColorStop(0, "rgba(255,255,255,0.62)");
    fill.addColorStop(0.55, "rgba(255,255,255,0.28)");
    fill.addColorStop(1, "rgba(255,255,255,0)");
    maskCtx.fillStyle = fill;
    maskCtx.beginPath();
    maskCtx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    maskCtx.fill();
  }
  maskCtx.restore();
}

function drawMaskSpeckles(maskCtx: CanvasRenderingContext2D, points: Point[], strokeW: number) {
  const step = Math.max(3, Math.floor(points.length / 42));

  maskCtx.save();
  maskCtx.fillStyle = "#ffffff";
  for (let i = 0; i < points.length; i += step) {
    const p = points[i];
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(points.length - 1, i + 1)];
    const normal = Math.atan2(next.y - prev.y, next.x - prev.x) + Math.PI / 2;

    for (let j = 0; j < 7; j++) {
      const seed = i * 89 + j * 23;
      const side = seededUnit(seed) > 0.5 ? 1 : -1;
      const drift = (0.35 + seededUnit(seed + 1) * 1.55) * strokeW * side;
      const along = (seededUnit(seed + 2) - 0.5) * strokeW * 0.9;
      const dot = 0.9 + seededUnit(seed + 3) * strokeW * 0.055;
      maskCtx.globalAlpha = 0.16 + seededUnit(seed + 4) * 0.26;
      maskCtx.beginPath();
      maskCtx.arc(
        p.x + Math.cos(normal) * drift + Math.cos(normal - Math.PI / 2) * along,
        p.y + Math.sin(normal) * drift + Math.sin(normal - Math.PI / 2) * along,
        dot,
        0,
        Math.PI * 2,
      );
      maskCtx.fill();
    }
  }
  maskCtx.restore();
}

function rgbaFromHex(color: string, alpha: number) {
  const rgb = hexToRgb(color);
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`;
}

function drawResidueDot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  alpha: number,
  color: string,
) {
  const soft = ctx.createRadialGradient(x, y, 0, x, y, radius);
  soft.addColorStop(0, rgbaFromHex(color, alpha));
  soft.addColorStop(0.48, rgbaFromHex(color, alpha * 0.32));
  soft.addColorStop(1, rgbaFromHex(color, 0));
  ctx.fillStyle = soft;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawPaintRun(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  length: number,
  width: number,
  color: string,
  seed: number,
) {
  const bend = (seededUnit(seed + 1) - 0.5) * length * 0.24;
  const endX = x + bend;
  const endY = y + length;
  const midX = x + bend * 0.38;
  const midY = y + length * 0.52;

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = rgbaFromHex(color, 0.28 + seededUnit(seed + 2) * 0.2);
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(midX, midY, endX, endY);
  ctx.stroke();

  drawResidueDot(ctx, endX, endY, width * (1.7 + seededUnit(seed + 3)), 0.26, color);
  ctx.restore();
}

export function drawWallSprayResidue(
  ctx: CanvasRenderingContext2D,
  letter: LetterLayout,
  fit: ReturnType<typeof computeFitTransform>,
  fromIndex: number,
  toIndex: number,
  paintColor: string,
  theme: "dark" | "light",
) {
  const pts = letter.pathPoints;
  if (pts.length < 2 || toIndex < fromIndex) return;

  const start = Math.max(1, fromIndex);
  const end = Math.min(pts.length - 1, toIndex);
  const scale = Math.max(0.7, fit.scale);
  const hazeScale = theme === "dark" ? 1 : 0.82;

  ctx.save();
  ctx.globalCompositeOperation = "source-over";

  for (let i = start; i <= end; i++) {
    const current = toCanvasPoint(letter, pts[i], fit);
    const prevPt = pts[Math.max(0, i - 1)];
    const nextPt = pts[Math.min(pts.length - 1, i + 1)];
    const tangent = Math.atan2(nextPt.y - prevPt.y, nextPt.x - prevPt.x);
    const normal = tangent + Math.PI / 2;
    const seedBase = i * 97 + letter.char.charCodeAt(0) * 31;

    if (i % 2 === 0) {
      const mistRadius = (15 + seededUnit(seedBase) * 18) * scale * hazeScale;
      const mistOffset = (seededUnit(seedBase + 1) - 0.5) * mistRadius * 0.58;
      drawResidueDot(
        ctx,
        current.x + Math.cos(normal) * mistOffset,
        current.y + Math.sin(normal) * mistOffset,
        mistRadius,
        theme === "dark" ? 0.055 : 0.032,
        paintColor,
      );
    }

    if (i % 3 === 0) {
      for (let j = 0; j < 5; j++) {
        const seed = seedBase + j * 19;
        const spread = (10 + seededUnit(seed) * 42) * scale;
        const fan = tangent + (seededUnit(seed + 1) - 0.5) * 1.55;
        const side = (seededUnit(seed + 2) - 0.5) * spread * 0.42;
        const dist = seededUnit(seed + 3) * spread;
        const x = current.x + Math.cos(fan) * dist * 0.42 + Math.cos(normal) * side;
        const y = current.y + Math.sin(fan) * dist * 0.42 + Math.sin(normal) * side;
        const dot = (0.8 + seededUnit(seed + 4) * 2.9) * scale;
        drawResidueDot(ctx, x, y, dot, 0.08 + seededUnit(seed + 5) * 0.12, paintColor);
      }
    }

    if (i > pts.length * 0.08 && i % 9 === 0 && seededUnit(seedBase + 7) > 0.83) {
      const dripStart = {
        x: current.x + Math.cos(normal) * (seededUnit(seedBase + 8) - 0.5) * 22 * scale,
        y: current.y + Math.sin(normal) * (seededUnit(seedBase + 9) - 0.5) * 12 * scale,
      };
      drawPaintRun(
        ctx,
        dripStart.x,
        dripStart.y,
        (18 + seededUnit(seedBase + 10) * 38) * scale,
        (1.1 + seededUnit(seedBase + 11) * 2.1) * scale,
        paintColor,
        seedBase,
      );
    }
  }

  ctx.restore();
}

/**
 * Paint a reveal mask for the current letter: thick path stroke + bloom at the
 * spray head so the letter visibly grows along the graffiti path each frame.
 */
export function drawLetterProgressMask(
  maskCtx: CanvasRenderingContext2D,
  letter: LetterLayout,
  fit: ReturnType<typeof computeFitTransform>,
  progress: number,
  paintColor: string,
) {
  const pts = letter.pathPoints;
  const clamped = Math.min(1, Math.max(0, progress));
  const { endIdx } = getLetterSprayState(letter, fit, clamped);

  if (pts.length < 2) {
    const lx = fit.offsetX + letter.x * fit.scale;
    const ly = fit.offsetY + letter.y * fit.scale;
    const lw = letter.width * fit.scale;
    const lh = letter.height * fit.scale;
    maskCtx.save();
    maskCtx.globalAlpha = clamped;
    maskCtx.fillStyle = "#ffffff";
    maskCtx.fillRect(lx, ly, lw, lh);
    maskCtx.restore();
    return;
  }

  const strokeW = Math.max(36, 54 * fit.scale);
  const travelled = pts.slice(0, endIdx + 1).map((p) => toCanvasPoint(letter, p, fit));

  drawSettledCoverage(maskCtx, travelled, strokeW);
  drawPressurePasses(maskCtx, travelled, strokeW);
  drawMaskSpeckles(maskCtx, travelled, strokeW);

  const head = toCanvasPoint(letter, pts[endIdx], fit);

  maskCtx.save();
  const bloom = maskCtx.createRadialGradient(head.x, head.y, 0, head.x, head.y, strokeW * 1.2);
  bloom.addColorStop(0, "rgba(255,255,255,1)");
  bloom.addColorStop(0.4, "rgba(255,255,255,0.65)");
  bloom.addColorStop(0.75, "rgba(255,255,255,0.2)");
  bloom.addColorStop(1, "rgba(255,255,255,0)");
  maskCtx.fillStyle = bloom;
  maskCtx.beginPath();
  maskCtx.arc(head.x, head.y, strokeW * 1.2, 0, Math.PI * 2);
  maskCtx.fill();
  maskCtx.restore();

  if (clamped > 0.8) {
    const lx = fit.offsetX + letter.x * fit.scale;
    const ly = fit.offsetY + letter.y * fit.scale;
    const lw = letter.width * fit.scale;
    const lh = letter.height * fit.scale;
    maskCtx.save();
    maskCtx.globalAlpha = Math.min(1, (clamped - 0.8) / 0.2);
    maskCtx.fillStyle = "#ffffff";
    maskCtx.fillRect(lx, ly, lw, lh);
    maskCtx.restore();
  }

  const splatR = Math.max(10, 18 * fit.scale);
  const startIdx = Math.max(0, endIdx - 14);
  for (let i = startIdx; i <= endIdx; i++) {
    const canvasPt = toCanvasPoint(letter, pts[i], fit);
    const prev = pts[Math.max(0, i - 1)];
    const angle = Math.atan2(pts[i].y - prev.y, pts[i].x - prev.x);
    sprayStamp(maskCtx, canvasPt.x, canvasPt.y, splatR, paintColor, angle, 0.72);
  }
}

export function spawnSprayParticles(
  pool: Particle[],
  x: number,
  y: number,
  angle: number,
  scale: number,
  color: string,
  count: number,
) {
  for (let i = 0; i < count; i++) {
    const mist = Math.random() > 0.22;
    const spread = (Math.random() - 0.5) * (mist ? 1.55 : 0.8);
    const speed = (Math.random() * (mist ? 3.7 : 2.2) + (mist ? 1.2 : 0.55)) * scale;
    const dir = angle + spread;
    const cross = angle + Math.PI / 2;
    const backscatter = (Math.random() - 0.5) * 8 * scale;
    pool.push({
      x: x + Math.cos(cross) * backscatter + (Math.random() - 0.5) * 6 * scale,
      y: y + Math.sin(cross) * backscatter + (Math.random() - 0.5) * 6 * scale,
      vx: Math.cos(dir) * speed,
      vy: Math.sin(dir) * speed + Math.random() * (mist ? 0.5 : 1.8) * scale,
      life: Math.random() * (mist ? 0.58 : 0.9) + (mist ? 0.18 : 0.32),
      size: (Math.random() * (mist ? 1.6 : 3.8) + (mist ? 0.35 : 1.1)) * scale,
      alpha: Math.random() * (mist ? 0.36 : 0.48) + (mist ? 0.18 : 0.28),
      drag: mist ? 1.2 + Math.random() * 0.9 : 0.5 + Math.random() * 0.45,
      glow: mist ? 4.8 + Math.random() * 2.6 : 2.8 + Math.random() * 1.6,
      gravity: mist ? 7 + Math.random() * 7 : 18 + Math.random() * 18,
    });
  }
}

export function updateAndDrawParticles(
  particles: Particle[],
  ctx: CanvasRenderingContext2D,
  dt: number,
  color: string,
  theme: "dark" | "light" = "dark",
) {
  const rgb = hexToRgb(color);
  const cap = 520;
  if (particles.length > cap) particles.splice(0, particles.length - cap);

  ctx.save();
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt * 58;
    p.y += p.vy * dt * 58;
    p.vy += dt * (p.gravity ?? 14) * p.size;
    p.vx *= 1 - dt * (p.drag ?? 0.8);
    p.life -= dt;
    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }
    const a = Math.min(1, p.life * 2.8) * p.alpha;
    const glowR = p.size * (p.glow ?? (theme === "dark" ? 4.2 : 3.2));
    const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowR);
    glow.addColorStop(0, `rgba(${rgb.r},${rgb.g},${rgb.b},${a * 0.45})`);
    glow.addColorStop(0.45, `rgba(${rgb.r},${rgb.g},${rgb.b},${a * 0.12})`);
    glow.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},0)`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(p.x, p.y, glowR, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${Math.min(1, a * 1.15)})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

function hexToRgb(color: string) {
  const normalized = color.replace("#", "");
  const value =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => char + char)
          .join("")
      : normalized;
  const n = Number.parseInt(value, 16);
  if (Number.isNaN(n)) return { r: 255, g: 255, b: 255 };
  return {
    r: (n >> 16) & 255,
    g: (n >> 8) & 255,
    b: n & 255,
  };
}
