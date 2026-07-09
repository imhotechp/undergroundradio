import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

/**
 * SprayPaintLogo (Three.js / R3F)
 * ----------------------------------------------------------------------------
 * Three ways to provide your logo:
 *   1. `text` + `font`  — quickest. Renders as graffiti-style SVG <text>.
 *   2. `svgPaths`       — array of SVG path `d` strings (your real logo).
 *   3. `svgMarkup`      — full <svg>…</svg> string.
 *
 *   👉 SEARCH FOR  "PASTE YOUR SVG PATHS HERE"  to swap the demo logo.
 *
 * The chosen artwork is rasterized to a CanvasTexture, then revealed
 * left→right by a custom GLSL shader simulating spray-paint overspray
 * (fbm-noise feathered edge + dithered speckle). A GPU points system spawns
 * particles at the moving nozzle; optional drips render as thin meshes.
 * ----------------------------------------------------------------------------
 */

export interface SprayPaintLogoProps {
  /** Plain text rendered in a graffiti font. */
  text?: string;
  /** CSS font-family used when rendering `text`. Default: "Rubik Wet Paint". */
  font?: string;
  /** Font weight to use when rendering text. */
  fontWeight?: number | string;
  /** Array of SVG path `d` strings. */
  svgPaths?: string[];
  /** Or a full <svg>…</svg> string. */
  svgMarkup?: string;
  /** Reserved for SVG children — currently unused; prefer svgMarkup/svgPaths. */
  children?: ReactNode;
  /** viewBox of your SVG (ignored when `text` is supplied). */
  viewBox?: string;
  color?: string;
  sprayColor?: string;
  duration?: number;
  delay?: number;
  particleDensity?: number;
  dripEnabled?: boolean;
  loop?: boolean;
  className?: string;
  playKey?: number;
}

const DEMO_VIEWBOX = "0 0 600 160";

// ---------- PASTE YOUR SVG PATHS HERE ----------
// Replace with your own paths, OR just use the `text` prop instead.
const DEMO_PATHS: string[] = [
  "M40 30 C 20 30 20 130 40 130 L 90 130 L 90 90 L 65 90",
  "M120 130 L 120 30 L 170 30 C 200 30 200 75 170 75 L 130 75 L 175 130",
  "M210 130 L 240 30 L 270 130 M 222 100 L 258 100",
  "M300 130 L 300 30 L 360 30 M 300 80 L 345 80",
  "M385 30 L 385 130 M 370 30 L 400 30 M 370 130 L 400 130",
  "M425 30 L 485 30 M 455 30 L 455 130",
  "M510 30 L 510 130 M 495 30 L 525 30 M 495 130 L 525 130",
  "M550 30 C 530 30 530 80 555 80 C 580 80 580 130 555 130 L 540 130",
];
// -----------------------------------------------

interface BuildResult {
  markup: string;
  width: number;
  height: number;
}

/** Measure text using an offscreen 2D canvas so the SVG viewBox fits tight. */
function measureText(text: string, font: string, weight: number | string, sizePx: number) {
  const c = document.createElement("canvas");
  const ctx = c.getContext("2d")!;
  ctx.font = `${weight} ${sizePx}px "${font}", system-ui, sans-serif`;
  const m = ctx.measureText(text);
  const ascent = m.actualBoundingBoxAscent || sizePx * 0.8;
  const descent = m.actualBoundingBoxDescent || sizePx * 0.3;
  const width = Math.max(1, m.width);
  return { width, ascent, descent, height: ascent + descent };
}

function buildSvg(props: {
  text?: string;
  font: string;
  fontWeight: number | string;
  color: string;
  svgPaths?: string[];
  svgMarkup?: string;
  viewBox: string;
}): BuildResult {
  const { text, font, fontWeight, color, svgPaths, svgMarkup, viewBox } = props;

  // Embed a Google Fonts @import INSIDE the SVG so it loads in the offscreen <img>.
  const fontFamilyEnc = encodeURIComponent(font).replace(/%20/g, "+");
  const fontImport = `@import url('https://fonts.googleapis.com/css2?family=${fontFamilyEnc}&display=swap');`;

  if (text) {
    const sizePx = 240;
    const m = measureText(text, font, fontWeight, sizePx);
    const padX = sizePx * 0.35;
    const padY = sizePx * 0.25;
    const w = Math.ceil(m.width + padX * 2);
    const h = Math.ceil(m.height + padY * 2);
    const baseline = padY + m.ascent;
    const markup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">
<defs><style type="text/css"><![CDATA[
${fontImport}
.tag { font-family: "${font}", system-ui, sans-serif; font-weight: ${fontWeight}; font-size: ${sizePx}px; fill: ${color}; }
]]></style></defs>
<text x="${padX}" y="${baseline}" class="tag">${escapeXml(text)}</text>
</svg>`;
    return { markup, width: w, height: h };
  }

  if (svgMarkup) {
    const vb = parseViewBox(viewBox);
    return { markup: svgMarkup, width: vb.w, height: vb.h };
  }

  const list = svgPaths ?? DEMO_PATHS;
  const vb = parseViewBox(viewBox);
  const strokes = list
    .map(
      (d) =>
        `<path d="${d}" fill="none" stroke="${color}" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>`,
    )
    .join("");
  const markup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${strokes}</svg>`;
  return { markup, width: vb.w, height: vb.h };
}

function escapeXml(s: string) {
  return s.replace(/[<>&"']/g, (c) =>
    c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === "&" ? "&amp;" : c === '"' ? "&quot;" : "&apos;",
  );
}

function parseViewBox(vb: string) {
  const p = vb.split(/\s+/).map(Number);
  return { w: p[2] || 600, h: p[3] || 160 };
}

function svgToCanvas(svg: string, width: number, height: number): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = width;
      c.height = height;
      const ctx = c.getContext("2d")!;
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(c);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

// ---------------- Reveal shader ----------------
const revealVert = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const revealFrag = /* glsl */ `
precision highp float;
uniform sampler2D uLogo;
uniform float uProgress;
uniform vec3  uColor;
uniform vec3  uSprayColor;
uniform float uTime;
varying vec2 vUv;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f*f*(3.0-2.0*f);
  return mix(a, b, u.x) + (c - a)*u.y*(1.0-u.x) + (d - b)*u.x*u.y;
}
float fbm(vec2 p){
  float v = 0.0; float a = 0.5;
  for(int i=0;i<5;i++){ v += a*noise(p); p*=2.02; a*=0.5; }
  return v;
}

void main(){
  vec4 logo = texture2D(uLogo, vUv);
  float logoMask = logo.a;
  if (logoMask < 0.01) discard;

  float edge = uProgress;
  float feather = 0.07;
  float n = fbm(vec2(vUv.x * 14.0, vUv.y * 9.0));
  float boundary = edge + (n - 0.5) * 0.09;
  float reveal = smoothstep(boundary - feather, boundary, vUv.x);

  float speckle = step(0.55, hash(vUv * 900.0 + uTime));
  float bandDist = abs(vUv.x - edge);
  float band = exp(-bandDist * 28.0);
  float dither = speckle * band * 0.9;

  float fillAlpha = clamp(1.0 - reveal + dither, 0.0, 1.0);

  float grain = fbm(vUv * vec2(140.0, 70.0));
  vec3 col = mix(uColor * 0.78, uColor, grain);
  float halo = exp(-bandDist * 10.0) * 0.3;
  col = mix(col, uSprayColor, halo * (1.0 - reveal));

  gl_FragColor = vec4(col, fillAlpha * logoMask);
}`;

// ---------------- Reveal mesh ----------------
function LogoMesh({
  texture,
  aspect,
  color,
  sprayColor,
  progress,
}: {
  texture: THREE.Texture;
  aspect: number;
  color: string;
  sprayColor: string;
  progress: { current: number };
}) {
  const matRef = useRef<THREE.ShaderMaterial | null>(null);
  const uniforms = useMemo(
    () => ({
      uLogo: { value: texture },
      uProgress: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uSprayColor: { value: new THREE.Color(sprayColor) },
      uTime: { value: 0 },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [texture],
  );

  useEffect(() => {
    if (matRef.current) {
      (matRef.current.uniforms.uColor.value as THREE.Color).set(color);
      (matRef.current.uniforms.uSprayColor.value as THREE.Color).set(sprayColor);
    }
  }, [color, sprayColor]);

  useFrame((state) => {
    if (!matRef.current) return;
    matRef.current.uniforms.uProgress.value = progress.current;
    matRef.current.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <mesh>
      <planeGeometry args={[aspect, 1, 1, 1]} />
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={revealVert}
        fragmentShader={revealFrag}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}

// ---------------- GPU particle system ----------------
const PARTICLE_COUNT = 1500;

const partVert = /* glsl */ `
attribute float aSize;
attribute float aAlpha;
varying float vAlpha;
void main(){
  vAlpha = aAlpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * (300.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}`;

const partFrag = /* glsl */ `
precision mediump float;
uniform vec3 uColor;
varying float vAlpha;
void main(){
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float a = smoothstep(0.5, 0.0, d) * vAlpha;
  gl_FragColor = vec4(uColor, a);
}`;

function Particles({
  aspect,
  sprayColor,
  density,
  progress,
  active,
}: {
  aspect: number;
  sprayColor: string;
  density: number;
  progress: { current: number };
  active: { current: boolean };
}) {
  const geomRef = useRef<THREE.BufferGeometry | null>(null);
  const matRef = useRef<THREE.ShaderMaterial | null>(null);
  const readyRef = useRef(false);

  const positions = useMemo(() => new Float32Array(PARTICLE_COUNT * 3), []);
  const sizes = useMemo(() => new Float32Array(PARTICLE_COUNT), []);
  const alphas = useMemo(() => new Float32Array(PARTICLE_COUNT), []);
  const velocities = useMemo(() => new Float32Array(PARTICLE_COUNT * 2), []);
  const cursorRef = useRef(0);

  useEffect(() => {
    if (!geomRef.current) return;
    geomRef.current.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geomRef.current.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    geomRef.current.setAttribute("aAlpha", new THREE.BufferAttribute(alphas, 1));
    readyRef.current = true;
  }, [positions, sizes, alphas]);

  const uniforms = useMemo(
    () => ({ uColor: { value: new THREE.Color(sprayColor) } }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    if (matRef.current) (matRef.current.uniforms.uColor.value as THREE.Color).set(sprayColor);
  }, [sprayColor]);

  useFrame((_, dt) => {
    const geom = geomRef.current;
    if (!geom || !readyRef.current) return;
    const posAttr = geom.attributes.position as THREE.BufferAttribute | undefined;
    const sizeAttr = geom.attributes.aSize as THREE.BufferAttribute | undefined;
    const alphaAttr = geom.attributes.aAlpha as THREE.BufferAttribute | undefined;
    if (!posAttr || !sizeAttr || !alphaAttr) return;

    const spawnCount = active.current ? Math.floor(2 + density * 18) : 0;
    const nozzleX = (progress.current - 0.5) * aspect;
    for (let i = 0; i < spawnCount; i++) {
      const idx = cursorRef.current;
      cursorRef.current = (cursorRef.current + 1) % PARTICLE_COUNT;
      const yJit = (Math.random() - 0.5) * 0.95;
      const xJit = (Math.random() - 0.5) * 0.18;
      positions[idx * 3 + 0] = nozzleX + xJit;
      positions[idx * 3 + 1] = yJit;
      positions[idx * 3 + 2] = 0.01;
      velocities[idx * 2 + 0] = (Math.random() - 0.5) * 0.3;
      velocities[idx * 2 + 1] = (Math.random() - 0.3) * 0.25;
      sizes[idx] = Math.random() * 5 + 1.5;
      alphas[idx] = Math.random() * 0.55 + 0.25;
    }

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      if (alphas[i] <= 0) continue;
      positions[i * 3 + 0] += velocities[i * 2 + 0] * dt;
      positions[i * 3 + 1] += velocities[i * 2 + 1] * dt;
      alphas[i] -= dt * 0.9;
      if (alphas[i] < 0) alphas[i] = 0;
    }

    posAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;
    alphaAttr.needsUpdate = true;
  });

  return (
    <points frustumCulled={false}>
      <bufferGeometry ref={geomRef} />
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={partVert}
        fragmentShader={partFrag}
        transparent
        depthWrite={false}
        blending={THREE.NormalBlending}
      />
    </points>
  );
}

// ---------------- Drips ----------------
interface DripState {
  x: number;
  y: number;
  len: number;
  maxLen: number;
  width: number;
  speed: number;
  alpha: number;
}

function Drips({
  aspect,
  color,
  progress,
  active,
  enabled,
}: {
  aspect: number;
  color: string;
  progress: { current: number };
  active: { current: boolean };
  enabled: boolean;
}) {
  const groupRef = useRef<THREE.Group | null>(null);
  const dripsRef = useRef<DripState[]>([]);
  const meshesRef = useRef<THREE.Mesh[]>([]);
  const MAX = 24;

  useEffect(() => {
    if (!groupRef.current) return;
    const g = groupRef.current;
    while (g.children.length) g.remove(g.children[0]);
    meshesRef.current = [];
    for (let i = 0; i < MAX; i++) {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(color),
          transparent: true,
          opacity: 0,
          depthWrite: false,
        }),
      );
      m.visible = false;
      g.add(m);
      meshesRef.current.push(m);
    }
  }, [color]);

  useEffect(() => {
    for (const m of meshesRef.current) {
      (m.material as THREE.MeshBasicMaterial).color.set(color);
    }
  }, [color]);

  useFrame((_, dt) => {
    if (!enabled) return;
    if (active.current && Math.random() < 0.04 && dripsRef.current.length < MAX) {
      const nozzleX = (progress.current - 0.5) * aspect;
      dripsRef.current.push({
        x: nozzleX + (Math.random() - 0.5) * 0.1,
        y: (Math.random() - 0.5) * 0.4,
        len: 0,
        maxLen: Math.random() * 0.25 + 0.05,
        width: Math.random() * 0.012 + 0.005,
        speed: Math.random() * 0.4 + 0.15,
        alpha: Math.random() * 0.5 + 0.4,
      });
    }
    const meshes = meshesRef.current;
    for (let i = 0; i < meshes.length; i++) {
      const d = dripsRef.current[i];
      const m = meshes[i];
      if (!d) {
        m.visible = false;
        continue;
      }
      d.len = Math.min(d.maxLen, d.len + d.speed * dt);
      d.alpha = Math.max(0, d.alpha - dt * 0.08);
      m.visible = true;
      m.scale.set(d.width, d.len, 1);
      m.position.set(d.x, d.y - d.len / 2, 0.02);
      (m.material as THREE.MeshBasicMaterial).opacity = d.alpha;
    }
    dripsRef.current = dripsRef.current.filter((d) => d.alpha > 0.02);
  });

  return <group ref={groupRef} />;
}

// ---------------- Scene ----------------
function Scene({
  texture,
  aspect,
  color,
  sprayColor,
  duration,
  delay,
  density,
  drips,
  loop,
  playKey,
}: {
  texture: THREE.Texture;
  aspect: number;
  color: string;
  sprayColor: string;
  duration: number;
  delay: number;
  density: number;
  drips: boolean;
  loop: boolean;
  playKey: number;
}) {
  const { camera, size } = useThree();
  const progress = useRef(0);
  const active = useRef(true);
  const startRef = useRef<number | null>(null);
  const reducedRef = useRef(false);

  useEffect(() => {
    if (!(camera instanceof THREE.OrthographicCamera)) return;
    const containerAspect = size.width / size.height;
    let viewW: number, viewH: number;
    if (containerAspect > aspect) {
      viewH = 1;
      viewW = viewH * containerAspect;
    } else {
      viewW = aspect;
      viewH = viewW / containerAspect;
    }
    camera.left = -viewW / 2;
    camera.right = viewW / 2;
    camera.top = viewH / 2;
    camera.bottom = -viewH / 2;
    camera.near = -10;
    camera.far = 10;
    camera.updateProjectionMatrix();
  }, [aspect, camera, size]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedRef.current = mq.matches;
    const h = () => (reducedRef.current = mq.matches);
    mq.addEventListener?.("change", h);
    return () => mq.removeEventListener?.("change", h);
  }, []);

  useEffect(() => {
    startRef.current = null;
    progress.current = 0;
    active.current = true;
  }, [playKey, duration, delay]);

  useFrame((state) => {
    if (reducedRef.current) {
      progress.current = 1;
      active.current = false;
      return;
    }
    const t = state.clock.elapsedTime * 1000;
    if (startRef.current == null) startRef.current = t + delay;
    const elapsed = Math.max(0, t - startRef.current);
    const p = Math.min(1, elapsed / duration);
    progress.current = p;
    active.current = p < 1;
    if (p >= 1 && loop) {
      startRef.current = t + 600;
      progress.current = 0;
    }
  });

  return (
    <>
      <LogoMesh
        texture={texture}
        aspect={aspect}
        color={color}
        sprayColor={sprayColor}
        progress={progress}
      />
      <Particles
        aspect={aspect}
        sprayColor={sprayColor}
        density={density}
        progress={progress}
        active={active}
      />
      <Drips
        aspect={aspect}
        color={sprayColor}
        progress={progress}
        active={active}
        enabled={drips}
      />
    </>
  );
}

// ---------------- Public component ----------------
export function SprayPaintLogo({
  text,
  font = "Rubik Wet Paint",
  fontWeight = 400,
  svgPaths,
  svgMarkup,
  viewBox = DEMO_VIEWBOX,
  color = "#0c0c0d",
  sprayColor,
  duration = 4500,
  delay = 200,
  particleDensity = 0.6,
  dripEnabled = true,
  loop = false,
  className = "",
  playKey = 0,
}: SprayPaintLogoProps) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [aspect, setAspect] = useState(600 / 160);
  const [visible, setVisible] = useState(true);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      // Wait for fonts so the rasterized SVG measures correctly
      if ("fonts" in document) {
        try {
          await (
            document as Document & {
              fonts: { load: (s: string) => Promise<unknown>; ready: Promise<unknown> };
            }
          ).fonts.load(`240px "${font}"`);
          await document.fonts.ready;
        } catch {
          /* ignore */
        }
      }
      if (cancelled) return;

      const built = buildSvg({ text, font, fontWeight, color, svgPaths, svgMarkup, viewBox });
      const a = built.width / built.height;
      setAspect(a);

      // Render at high DPI for crisp edges
      const TARGET_W = 1600;
      const scale = TARGET_W / built.width;
      const texW = Math.round(built.width * scale);
      const texH = Math.round(built.height * scale);

      try {
        const c = await svgToCanvas(built.markup, texW, texH);
        if (cancelled) return;
        const tex = new THREE.CanvasTexture(c);
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.anisotropy = 4;
        setTexture(tex);
      } catch (e) {
        console.error("SprayPaintLogo: failed to rasterize SVG", e);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [text, font, fontWeight, viewBox, color, svgPaths, svgMarkup]);

  useEffect(() => {
    if (!wrapRef.current) return;
    const io = new IntersectionObserver(
      (entries) => setVisible(entries[0]?.isIntersecting ?? true),
      { threshold: 0.05 },
    );
    io.observe(wrapRef.current);
    return () => io.disconnect();
  }, []);

  const spray = sprayColor ?? color;

  return (
    <div
      ref={wrapRef}
      className={`relative w-full ${className}`}
      style={{ aspectRatio: `${aspect}` }}
    >
      {texture && (
        <Canvas
          frameloop={visible ? "always" : "never"}
          orthographic
          camera={{ position: [0, 0, 1], zoom: 1 }}
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: true, premultipliedAlpha: false }}
        >
          <Scene
            texture={texture}
            aspect={aspect}
            color={color}
            sprayColor={spray}
            duration={duration}
            delay={delay}
            density={particleDensity}
            drips={dripEnabled}
            loop={loop}
            playKey={playKey}
          />
        </Canvas>
      )}
    </div>
  );
}

export default SprayPaintLogo;
