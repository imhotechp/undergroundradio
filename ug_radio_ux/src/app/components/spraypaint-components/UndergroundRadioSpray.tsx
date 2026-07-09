import gsap from "gsap";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from "react";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import { UNDERGROUND_RADIO_LETTERS } from "@/app/components/spraypaint-components/underground-radio-letters";
import { SprayCanMotion3D } from "@/app/components/spraypaint-components/SprayCanMotion3D";
import {
  computeFitTransform,
  drawLetterProgressMask,
  drawWallSprayResidue,
  getLetterSprayState,
  getResponsivePadding,
  pickLayout,
  prepareLetter,
  spawnSprayParticles,
  updateAndDrawParticles,
  type LetterLayout,
  type Particle,
  type PreparedLetter,
} from "@/app/components/spraypaint-components/svg-spray-utils";
import { animateStageReveal, killGsapTween, spraySyncEase } from "@/app/components/spraypaint-components/spray-gsap";

export type SprayTheme = "dark" | "light";
export type SprayPhase = "idle" | "shake" | "spray" | "done";

export interface UndergroundRadioSprayProps {
  theme?: SprayTheme;
  shakeDuration?: number;
  letterDuration?: number;
  autoPlay?: boolean;
  loop?: boolean;
  paused?: boolean;
  speed?: number;
  tiltEnabled?: boolean;
  showCanUi?: boolean;
  particlesEnabled?: boolean;
  className?: string;
  style?: CSSProperties;
  onComplete?: () => void;
  onProgress?: (progress: number, phase: SprayPhase) => void;
}

export interface UndergroundRadioSprayHandle {
  skipToEnd: () => void;
  exportPng: () => void;
}

const SHAKE_MS_DEFAULT = 900;
const LETTER_MS_DEFAULT = 1400;
/** Oversampled source raster so completed letters stay crisp on large/retina canvases. */
const BASE_LETTER_HEIGHT = 960;
const UNDERGROUND_BREAK = 11;

type Phase = SprayPhase;

function computeOverallProgress(
  phase: Phase,
  elapsed: number,
  shakeDuration: number,
  letterIndex: number,
  letterProgress: number,
  totalLetters: number,
) {
  if (phase === "idle") return 0;
  if (phase === "done") return 100;
  if (phase === "shake") return Math.min(10, (elapsed / shakeDuration) * 10);
  const base = 10;
  const span = 90;
  return base + ((letterIndex + letterProgress) / Math.max(1, totalLetters)) * span;
}

function setHighQualitySmoothing(ctx: CanvasRenderingContext2D) {
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
}

function AmbientSurface({ theme }: { theme: SprayTheme }) {
  const isDark = theme === "dark";
  const accent = isDark ? "255,255,255" : "0,0,0";
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <motion.div
        className="absolute -left-[20%] top-[18%] h-[55%] w-[55%] rounded-full blur-3xl"
        style={{
          background: `radial-gradient(circle, rgba(${accent},0.09) 0%, transparent 68%)`,
        }}
        animate={{ x: [0, 28, 0], y: [0, -18, 0], opacity: [0.55, 0.9, 0.55] }}
        transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -right-[15%] bottom-[12%] h-[48%] w-[48%] rounded-full blur-3xl"
        style={{
          background: `radial-gradient(circle, rgba(${accent},0.06) 0%, transparent 70%)`,
        }}
        animate={{ x: [0, -22, 0], y: [0, 14, 0], opacity: [0.4, 0.75, 0.4] }}
        transition={{ duration: 13, repeat: Infinity, ease: "easeInOut", delay: 1.2 }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: isDark
            ? [
                "linear-gradient(125deg, rgba(255,255,255,0.07), transparent 38%)",
                "linear-gradient(245deg, rgba(255,255,255,0.05), transparent 42%)",
                "linear-gradient(180deg, transparent 52%, rgba(255,255,255,0.04))",
              ].join(",")
            : [
                "linear-gradient(125deg, rgba(0,0,0,0.04), transparent 38%)",
                "linear-gradient(245deg, rgba(0,0,0,0.03), transparent 42%)",
                "linear-gradient(180deg, transparent 55%, rgba(0,0,0,0.04))",
              ].join(","),
        }}
      />
      <motion.div
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: isDark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.1)" }}
        animate={{ opacity: [0.35, 0.8, 0.35] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

function getLetterGap(viewportWidth: number) {
  if (viewportWidth < 400) return 2;
  if (viewportWidth < 768) return 4;
  return 6;
}

/**
 * Mobile-first spray-paint reveal of the undergroundradio logo.
 * Responsive: wraps to two lines on narrow screens, rescales on resize/rotate.
 */
export const UndergroundRadioSpray = forwardRef<
  UndergroundRadioSprayHandle,
  UndergroundRadioSprayProps
>(function UndergroundRadioSpray(
  {
    theme = "dark",
    shakeDuration = SHAKE_MS_DEFAULT,
    letterDuration = LETTER_MS_DEFAULT,
    autoPlay = true,
    loop = false,
    paused = false,
    speed = 1,
    tiltEnabled = true,
    showCanUi = true,
    particlesEnabled = true,
    className = "",
    style,
    onComplete,
    onProgress,
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canWrapperRef = useRef<HTMLDivElement>(null);
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const accumulatedRef = useRef<HTMLCanvasElement | null>(null);
  const residueCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const loopTimeoutRef = useRef<number | null>(null);

  const preparedRef = useRef<PreparedLetter[]>([]);
  const layoutsRef = useRef<LetterLayout[]>([]);
  const contentSizeRef = useRef({ w: 0, h: 0 });
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef<number | null>(null);
  const phaseRef = useRef<Phase>("idle");
  const letterIndexRef = useRef(0);
  const letterProgressRef = useRef(0);
  const lastStampIdxRef = useRef(-1);
  const fitRef = useRef(computeFitTransform(1, 1, 1, 1, 48));
  const dprRef = useRef(1);
  const viewportRef = useRef({ w: 0, h: 0 });
  const canScaleRef = useRef(1);
  const onProgressRef = useRef(onProgress);
  const onCompleteRef = useRef(onComplete);
  onProgressRef.current = onProgress;
  onCompleteRef.current = onComplete;

  const pauseAnchorRef = useRef<number | null>(null);
  const pauseOffsetRef = useRef(0);
  const pausedRef = useRef(paused);
  const speedRef = useRef(speed);
  const tiltEnabledRef = useRef(tiltEnabled);
  const particlesEnabledRef = useRef(particlesEnabled);
  const loopRef = useRef(loop);
  pausedRef.current = paused;
  speedRef.current = speed;
  tiltEnabledRef.current = tiltEnabled;
  particlesEnabledRef.current = particlesEnabled;
  loopRef.current = loop;

  const [ready, setReady] = useState(false);
  const canX = useMotionValue(0);
  const canY = useMotionValue(0);
  const [canSize, setCanSize] = useState(48);
  const [shaking, setShaking] = useState(false);
  const [showCan, setShowCan] = useState(true);
  const [sprayActive, setSprayActive] = useState(false);
  const [playKey, setPlayKey] = useState(0);

  const tiltX = useMotionValue(0);
  const tiltY = useMotionValue(0);
  const stageRotateX = useSpring(useTransform(tiltY, [-0.5, 0.5], [10, -10]), {
    stiffness: 100,
    damping: 20,
  });
  const stageRotateY = useSpring(useTransform(tiltX, [-0.5, 0.5], [-10, 10]), {
    stiffness: 100,
    damping: 20,
  });
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (!tiltEnabled) {
      tiltX.set(0);
      tiltY.set(0);
    }
  }, [tiltEnabled, tiltX, tiltY]);

  useEffect(() => {
    if (!particlesEnabled) particlesRef.current = [];
  }, [particlesEnabled]);

  useEffect(() => {
    if (!ready || !stageRef.current) return undefined;
    const tween = animateStageReveal(stageRef.current);
    return () => killGsapTween(tween);
  }, [ready]);

  const bgColor = theme === "dark" ? "#000000" : "#ffffff";
  const paintColor = theme === "dark" ? "#ffffff" : "#000000";
  const particleColor = paintColor;
  const shadowColor = theme === "dark" ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0.2)";
  const highlightColor = theme === "dark" ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.12)";

  const paintColorRef = useRef(paintColor);
  const themeRef = useRef(theme);
  const particleColorRef = useRef(particleColor);
  paintColorRef.current = paintColor;
  themeRef.current = theme;
  particleColorRef.current = particleColor;

  const resetAnimation = useCallback(() => {
    if (loopTimeoutRef.current !== null) {
      window.clearTimeout(loopTimeoutRef.current);
      loopTimeoutRef.current = null;
    }
    startTimeRef.current = null;
    pauseAnchorRef.current = null;
    pauseOffsetRef.current = 0;
    phaseRef.current = "idle";
    letterIndexRef.current = 0;
    letterProgressRef.current = 0;
    lastStampIdxRef.current = -1;
    particlesRef.current = [];
    setShowCan(true);
    setSprayActive(false);
    setShaking(false);

    const acc = accumulatedRef.current;
    if (acc) {
      const ctx = acc.getContext("2d");
      ctx?.clearRect(0, 0, acc.width, acc.height);
    }
    const mask = maskCanvasRef.current;
    if (mask) {
      const ctx = mask.getContext("2d");
      ctx?.clearRect(0, 0, mask.width, mask.height);
    }
    const residue = residueCanvasRef.current;
    if (residue) {
      const ctx = residue.getContext("2d");
      ctx?.clearRect(0, 0, residue.width, residue.height);
    }
  }, []);

  const restart = useCallback(() => {
    resetAnimation();
    setPlayKey((k) => k + 1);
  }, [resetAnimation]);

  const drawLetterPaint = useCallback(
    (
      targetCtx: CanvasRenderingContext2D,
      canvas: HTMLCanvasElement,
      letter: LetterLayout,
      fit: ReturnType<typeof computeFitTransform>,
      mask?: HTMLCanvasElement,
    ) => {
      const lx = fit.offsetX + letter.x * fit.scale;
      const ly = fit.offsetY + letter.y * fit.scale;
      const lw = letter.width * fit.scale;
      const lh = letter.height * fit.scale;

      const glyph = document.createElement("canvas");
      glyph.width = Math.max(1, Math.ceil(lw));
      glyph.height = Math.max(1, Math.ceil(lh));
      const gctx = glyph.getContext("2d")!;
      setHighQualitySmoothing(gctx);
      gctx.drawImage(letter.image, 0, 0, lw, lh);
      gctx.globalCompositeOperation = "source-in";
      gctx.fillStyle = paintColor;
      gctx.fillRect(0, 0, lw, lh);

      const layer = document.createElement("canvas");
      layer.width = canvas.width;
      layer.height = canvas.height;
      const lctx = layer.getContext("2d")!;
      setHighQualitySmoothing(lctx);

      lctx.shadowColor = shadowColor;
      lctx.shadowBlur = 14 * fit.scale;
      lctx.shadowOffsetY = 5 * fit.scale;
      lctx.drawImage(glyph, lx, ly, lw, lh);

      lctx.shadowBlur = 0;
      lctx.shadowOffsetY = 0;
      lctx.drawImage(glyph, lx, ly, lw, lh);

      lctx.globalCompositeOperation = "source-atop";
      const shine = lctx.createLinearGradient(lx, ly, lx + lw * 0.4, ly + lh * 0.35);
      shine.addColorStop(0, highlightColor);
      shine.addColorStop(1, "rgba(255,255,255,0)");
      lctx.fillStyle = shine;
      lctx.fillRect(lx, ly, lw, lh);

      if (mask) {
        lctx.globalCompositeOperation = "destination-in";
        lctx.drawImage(mask, 0, 0);
      }

      setHighQualitySmoothing(targetCtx);
      targetCtx.drawImage(layer, 0, 0);
    },
    [shadowColor, highlightColor, paintColor],
  );

  const drawSceneBackground = useCallback(
    (bgCtx: CanvasRenderingContext2D, bgCanvas: HTMLCanvasElement) => {
      bgCtx.fillStyle = bgColor;
      bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);

      const cx = bgCanvas.width * 0.5;
      const cy = bgCanvas.height * 0.44;
      const spot = bgCtx.createRadialGradient(
        cx,
        cy,
        0,
        cx,
        cy,
        Math.max(bgCanvas.width, bgCanvas.height) * 0.55,
      );
      if (theme === "dark") {
        spot.addColorStop(0, "rgba(255,255,255,0.14)");
        spot.addColorStop(0.35, "rgba(255,255,255,0.05)");
        spot.addColorStop(0.7, "rgba(255,255,255,0.01)");
        spot.addColorStop(1, "rgba(0,0,0,0.5)");
      } else {
        spot.addColorStop(0, "rgba(255,255,255,0.9)");
        spot.addColorStop(0.4, "rgba(250,250,250,0.6)");
        spot.addColorStop(0.75, "rgba(240,240,240,0.2)");
        spot.addColorStop(1, "rgba(220,220,220,0.35)");
      }
      bgCtx.fillStyle = spot;
      bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);

      bgCtx.globalAlpha = theme === "dark" ? 0.08 : 0.045;
      bgCtx.fillStyle = theme === "dark" ? "#ffffff" : "#000000";
      const grain = Math.min(320, Math.floor((bgCanvas.width * bgCanvas.height) / 6500));
      for (let i = 0; i < grain; i++) {
        bgCtx.fillRect((i * 137.5) % bgCanvas.width, (i * 79.3) % bgCanvas.height, 1, 1);
      }
      bgCtx.globalAlpha = 1;

      const vignette = bgCtx.createRadialGradient(
        bgCanvas.width * 0.5,
        bgCanvas.height * 0.48,
        Math.min(bgCanvas.width, bgCanvas.height) * 0.18,
        bgCanvas.width * 0.5,
        bgCanvas.height * 0.5,
        Math.max(bgCanvas.width, bgCanvas.height) * 0.88,
      );
      vignette.addColorStop(0, "rgba(0,0,0,0)");
      vignette.addColorStop(1, theme === "dark" ? "rgba(0,0,0,0.62)" : "rgba(0,0,0,0.14)");
      bgCtx.fillStyle = vignette;
      bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);

      const floor = bgCtx.createLinearGradient(0, bgCanvas.height * 0.7, 0, bgCanvas.height);
      floor.addColorStop(0, "rgba(0,0,0,0)");
      floor.addColorStop(1, theme === "dark" ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)");
      bgCtx.fillStyle = floor;
      bgCtx.fillRect(0, bgCanvas.height * 0.62, bgCanvas.width, bgCanvas.height * 0.38);
    },
    [bgColor, theme],
  );

  const drawCompositeFrame = useCallback(
    (letterIndex: number, maskCanvas?: HTMLCanvasElement | null) => {
      const bgCanvas = bgCanvasRef.current;
      const canvas = canvasRef.current;
      const accumulated = accumulatedRef.current;
      const residue = residueCanvasRef.current;
      if (!bgCanvas || !canvas || !accumulated) return;

      const bgCtx = bgCanvas.getContext("2d");
      const ctx = canvas.getContext("2d");
      if (!bgCtx || !ctx) return;

      const layouts = layoutsRef.current;
      const fit = fitRef.current;

      drawSceneBackground(bgCtx, bgCanvas);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (residue) ctx.drawImage(residue, 0, 0);
      ctx.drawImage(accumulated, 0, 0);

      if (letterIndex < layouts.length && maskCanvas) {
        const letter = layouts[letterIndex];
        drawLetterPaint(ctx, canvas, letter, fit, maskCanvas);
      }

      if (particlesEnabledRef.current) {
        updateAndDrawParticles(
          particlesRef.current,
          ctx,
          1 / 60,
          particleColorRef.current,
          themeRef.current,
        );
      }
    },
    [drawLetterPaint, drawSceneBackground],
  );

  const repaintAccumulated = useCallback(
    (throughIndex: number) => {
      const acc = accumulatedRef.current;
      const canvas = canvasRef.current;
      if (!acc || !canvas) return;
      const accCtx = acc.getContext("2d");
      if (!accCtx) return;

      accCtx.clearRect(0, 0, acc.width, acc.height);
      const layouts = layoutsRef.current;
      const fit = fitRef.current;
      for (let i = 0; i < throughIndex && i < layouts.length; i++) {
        drawLetterPaint(accCtx, canvas, layouts[i], fit);
      }
    },
    [drawLetterPaint],
  );

  const refreshThemeVisuals = useCallback(() => {
    const maskCanvas = maskCanvasRef.current;
    const residueCanvas = residueCanvasRef.current;
    const completed = letterIndexRef.current;
    const layouts = layoutsRef.current;

    if (residueCanvas) {
      residueCanvas.getContext("2d")?.clearRect(0, 0, residueCanvas.width, residueCanvas.height);
    }

    repaintAccumulated(completed);

    if (phaseRef.current === "spray" && completed < layouts.length && maskCanvas) {
      const maskCtx = maskCanvas.getContext("2d");
      if (maskCtx) {
        maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
        drawLetterProgressMask(
          maskCtx,
          layouts[completed],
          fitRef.current,
          letterProgressRef.current,
          paintColorRef.current,
        );
      }
    }

    drawCompositeFrame(completed, maskCanvas);
  }, [drawCompositeFrame, repaintAccumulated]);

  const drawCompositeFrameRef = useRef(drawCompositeFrame);
  const drawLetterPaintRef = useRef(drawLetterPaint);
  const drawSceneBackgroundRef = useRef(drawSceneBackground);
  drawCompositeFrameRef.current = drawCompositeFrame;
  drawLetterPaintRef.current = drawLetterPaint;
  drawSceneBackgroundRef.current = drawSceneBackground;

  const applyResponsiveLayout = useCallback(() => {
    const container = containerRef.current;
    const bgCanvas = bgCanvasRef.current;
    const canvas = canvasRef.current;
    if (!container || !bgCanvas || !canvas || preparedRef.current.length === 0) return;

    const rect = container.getBoundingClientRect();
    const cssW = Math.max(1, rect.width);
    const cssH = Math.max(1, rect.height);
    viewportRef.current = { w: cssW, h: cssH };

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    dprRef.current = dpr;

    const nextW = Math.floor(cssW * dpr);
    const nextH = Math.floor(cssH * dpr);

    for (const c of [bgCanvas, canvas]) {
      if (c.width !== nextW || c.height !== nextH) {
        c.width = nextW;
        c.height = nextH;
      }
      c.style.width = `${cssW}px`;
      c.style.height = `${cssH}px`;
    }

    if (!maskCanvasRef.current) maskCanvasRef.current = document.createElement("canvas");
    if (!accumulatedRef.current) accumulatedRef.current = document.createElement("canvas");
    if (!residueCanvasRef.current) residueCanvasRef.current = document.createElement("canvas");
    if (maskCanvasRef.current.width !== nextW || maskCanvasRef.current.height !== nextH) {
      maskCanvasRef.current.width = nextW;
      maskCanvasRef.current.height = nextH;
      lastStampIdxRef.current = -1;
      letterProgressRef.current = 0;
    }
    if (accumulatedRef.current.width !== nextW || accumulatedRef.current.height !== nextH) {
      accumulatedRef.current.width = nextW;
      accumulatedRef.current.height = nextH;
    }
    if (residueCanvasRef.current.width !== nextW || residueCanvasRef.current.height !== nextH) {
      residueCanvasRef.current.width = nextW;
      residueCanvasRef.current.height = nextH;
      residueCanvasRef.current.getContext("2d")?.clearRect(0, 0, nextW, nextH);
    }

    const gap = getLetterGap(cssW);
    const { layouts, contentW, contentH } = pickLayout(
      preparedRef.current,
      cssW,
      gap,
      UNDERGROUND_BREAK,
    );
    layoutsRef.current = layouts;
    contentSizeRef.current = { w: contentW, h: contentH };

    const padding = getResponsivePadding(cssW, cssH) * dpr;
    fitRef.current = computeFitTransform(contentW, contentH, canvas.width, canvas.height, padding);

    const scale = fitRef.current.scale * dpr;
    const nextCanSize = Math.max(28, Math.min(72, scale * 52));
    canScaleRef.current = nextCanSize;
    if (Math.abs(nextCanSize - canSize) > 1) setCanSize(nextCanSize);

    const fit = fitRef.current;
    const cx = (fit.offsetX + (contentW * fit.scale) / 2) / dpr;
    const cy = (fit.offsetY + (contentH * fit.scale) / 2) / dpr;
    canX.set(cx);
    canY.set(cy - nextCanSize * 0.85);

    const completed = letterIndexRef.current;
    repaintAccumulated(completed);

    const bgCtx = bgCanvas.getContext("2d");
    if (bgCtx) {
      drawSceneBackground(bgCtx, bgCanvas);
    }
  }, [repaintAccumulated, drawSceneBackground, canX, canY, canSize]);

  const finishAllLetters = useCallback(() => {
    if (!ready || phaseRef.current === "done") return;

    const layouts = layoutsRef.current;
    const canvas = canvasRef.current;
    const accumulated = accumulatedRef.current;
    const maskCanvas = maskCanvasRef.current;
    if (!canvas || !accumulated || layouts.length === 0) return;

    const start = letterIndexRef.current;
    for (let i = start; i < layouts.length; i++) {
      const accCtx = accumulated.getContext("2d");
      if (accCtx) drawLetterPaintRef.current(accCtx, canvas, layouts[i], fitRef.current);
    }

    letterIndexRef.current = layouts.length;
    letterProgressRef.current = 1;
    phaseRef.current = "done";
    particlesRef.current = [];
    if (maskCanvas) {
      maskCanvas.getContext("2d")?.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    }
    setShowCan(false);
    setShaking(false);
    setSprayActive(false);
    drawCompositeFrameRef.current(layouts.length, null);
    onProgressRef.current?.(100, "done");
    onCompleteRef.current?.();
  }, [ready]);

  const exportPng = useCallback(() => {
    const bgCanvas = bgCanvasRef.current;
    const canvas = canvasRef.current;
    if (!bgCanvas || !canvas) return;

    const out = document.createElement("canvas");
    out.width = bgCanvas.width;
    out.height = bgCanvas.height;
    const ctx = out.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(bgCanvas, 0, 0);
    ctx.drawImage(canvas, 0, 0);

    const link = document.createElement("a");
    link.download = `undergroundradio-${theme}-${Date.now()}.png`;
    link.href = out.toDataURL("image/png");
    link.click();
  }, [theme]);

  useImperativeHandle(ref, () => ({ skipToEnd: finishAllLetters, exportPng }), [
    finishAllLetters,
    exportPng,
  ]);

  const applyResponsiveLayoutRef = useRef(applyResponsiveLayout);
  const refreshThemeVisualsRef = useRef(refreshThemeVisuals);
  applyResponsiveLayoutRef.current = applyResponsiveLayout;
  refreshThemeVisualsRef.current = refreshThemeVisuals;

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const prepared = await Promise.all(
        UNDERGROUND_RADIO_LETTERS.map(({ char, path }) =>
          prepareLetter(char, path, BASE_LETTER_HEIGHT, "#ffffff"),
        ),
      );
      if (cancelled) return;

      preparedRef.current = prepared;
      setReady(true);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    applyResponsiveLayoutRef.current();
    refreshThemeVisualsRef.current();
  }, [theme, paintColor, ready]);

  useEffect(() => {
    if (!ready) return;
    resetAnimation();
    applyResponsiveLayoutRef.current();
  }, [ready, playKey, resetAnimation]);

  useEffect(() => {
    if (!ready || !autoPlay) return;

    const bgCanvas = bgCanvasRef.current;
    const canvas = canvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    const accumulated = accumulatedRef.current;
    const residueCanvas = residueCanvasRef.current;
    if (!bgCanvas || !canvas || !maskCanvas || !accumulated || !residueCanvas) return;

    const bgCtx = bgCanvas.getContext("2d");
    const ctx = canvas.getContext("2d");
    const maskCtx = maskCanvas.getContext("2d");
    const residueCtx = residueCanvas.getContext("2d");
    if (!bgCtx || !ctx || !maskCtx || !residueCtx) return;

    const layouts = layoutsRef.current;
    const totalLetters = layouts.length;
    const dpr = dprRef.current;

    const paintLetterToAccumulated = (index: number) => {
      const letter = layouts[index];
      const accCtx = accumulated.getContext("2d");
      if (!accCtx) return;
      drawLetterPaintRef.current(accCtx, canvas, letter, fitRef.current);
    };

    const clearMask = () => {
      maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    };

    const stampAlongPath = (letter: LetterLayout, linearProgress: number) => {
      const fit = fitRef.current;
      const progress = spraySyncEase(linearProgress);
      const spray = getLetterSprayState(letter, fit, progress);

      maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
      drawLetterProgressMask(maskCtx, letter, fit, progress, paintColorRef.current);

      canX.set(spray.nozzle.x / dpr);
      canY.set(spray.nozzle.y / dpr);

      if (canWrapperRef.current) {
        const deg = (spray.angle * 180) / Math.PI - 18;
        gsap.set(canWrapperRef.current, { rotation: deg });
      }

      if (letter.pathPoints.length >= 2) {
        const residueStart = lastStampIdxRef.current + 1;
        if (spray.endIdx >= residueStart) {
          drawWallSprayResidue(
            residueCtx,
            letter,
            fit,
            residueStart,
            spray.endIdx,
            paintColorRef.current,
            themeRef.current,
          );
          lastStampIdxRef.current = spray.endIdx;
        }
      }

      if (particlesEnabledRef.current) {
        spawnSprayParticles(
          particlesRef.current,
          spray.nozzle.x,
          spray.nozzle.y,
          spray.angle,
          fit.scale,
          paintColorRef.current,
          Math.floor(10 + progress * 14),
        );
      }
    };

    if (shouldReduceMotion) {
      drawSceneBackgroundRef.current(bgCtx, bgCanvas);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const letter of layouts) {
        drawLetterPaintRef.current(ctx, canvas, letter, fitRef.current);
      }
      phaseRef.current = "done";
      setShowCan(false);
      setShaking(false);
      setSprayActive(false);
      onProgressRef.current?.(100, "done");
      onCompleteRef.current?.();
      return undefined;
    }

    let lastUiEmit = 0;
    let lastReportedPhase: Phase = "idle";

    const tick = (now: number) => {
      if (startTimeRef.current === null) startTimeRef.current = now;

      if (pausedRef.current) {
        if (pauseAnchorRef.current === null) pauseAnchorRef.current = now;
        const holdIdx = Math.min(letterIndexRef.current, layouts.length);
        const mask = phaseRef.current === "spray" ? maskCanvas : null;
        drawCompositeFrameRef.current(holdIdx, mask);
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      if (pauseAnchorRef.current !== null) {
        pauseOffsetRef.current += now - pauseAnchorRef.current;
        pauseAnchorRef.current = null;
      }

      const elapsed = (now - startTimeRef.current - pauseOffsetRef.current) * speedRef.current;

      let letterProgress = 0;

      if (phaseRef.current === "idle") {
        phaseRef.current = "shake";
        setShaking(true);
        const fit = fitRef.current;
        const cx = (fit.offsetX + (contentSizeRef.current.w * fit.scale) / 2) / dpr;
        const cy = (fit.offsetY + (contentSizeRef.current.h * fit.scale) / 2) / dpr;
        canX.set(cx);
        canY.set(cy - canScaleRef.current * 0.85);
      }

      if (phaseRef.current === "shake") {
        drawCompositeFrameRef.current(0, null);
        if (elapsed >= shakeDuration) {
          phaseRef.current = "spray";
          setShaking(false);
          setSprayActive(true);
          letterIndexRef.current = 0;
          letterProgressRef.current = 0;
          lastStampIdxRef.current = -1;
          clearMask();
        }
      } else if (phaseRef.current === "spray") {
        const idx = letterIndexRef.current;

        if (idx < totalLetters) {
          const letterStart = shakeDuration + idx * letterDuration;
          const linearProgress = Math.min(1, Math.max(0, (elapsed - letterStart) / letterDuration));
          letterProgress = spraySyncEase(linearProgress);
          letterProgressRef.current = letterProgress;
          stampAlongPath(layouts[idx], linearProgress);
          drawCompositeFrameRef.current(idx, maskCanvas);

          if (letterProgress >= 0.99) {
            paintLetterToAccumulated(idx);
            clearMask();
            lastStampIdxRef.current = -1;
            letterProgressRef.current = 0;
            letterIndexRef.current = idx + 1;
          }
        } else {
          phaseRef.current = "done";
          setShowCan(false);
          setSprayActive(false);
          drawCompositeFrameRef.current(totalLetters, null);
          onCompleteRef.current?.();
          if (loopRef.current && loopTimeoutRef.current === null) {
            loopTimeoutRef.current = window.setTimeout(() => {
              loopTimeoutRef.current = null;
              restart();
            }, 2000);
          }
        }
      } else {
        drawCompositeFrameRef.current(totalLetters, null);
      }

      const progressValue = computeOverallProgress(
        phaseRef.current,
        elapsed,
        shakeDuration,
        letterIndexRef.current,
        letterProgress,
        totalLetters,
      );
      if (
        phaseRef.current !== lastReportedPhase ||
        now - lastUiEmit > 120 ||
        progressValue >= 100
      ) {
        onProgressRef.current?.(progressValue, phaseRef.current);
        lastReportedPhase = phaseRef.current;
        lastUiEmit = now;
      }

      const shouldContinue =
        pausedRef.current || phaseRef.current !== "done" || particlesRef.current.length > 0;
      if (shouldContinue) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    drawCompositeFrameRef.current(0, null);
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafRef.current);
      if (loopTimeoutRef.current !== null) {
        window.clearTimeout(loopTimeoutRef.current);
        loopTimeoutRef.current = null;
      }
    };
  }, [
    ready,
    autoPlay,
    shakeDuration,
    letterDuration,
    restart,
    playKey,
    shouldReduceMotion,
    canX,
    canY,
  ]);

  useEffect(() => {
    if (!ready) return;

    const container = containerRef.current;
    if (!container) return;

    let resizeTimer: number | undefined;
    const scheduleLayout = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => applyResponsiveLayoutRef.current(), 80);
    };

    const ro = new ResizeObserver(scheduleLayout);
    ro.observe(container);

    const onViewportChange = scheduleLayout;
    window.addEventListener("orientationchange", onViewportChange);
    window.visualViewport?.addEventListener("resize", onViewportChange);

    return () => {
      window.clearTimeout(resizeTimer);
      ro.disconnect();
      window.removeEventListener("orientationchange", onViewportChange);
      window.visualViewport?.removeEventListener("resize", onViewportChange);
    };
  }, [ready]);

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!tiltEnabledRef.current) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    tiltX.set((e.clientX - rect.left) / rect.width - 0.5);
    tiltY.set((e.clientY - rect.top) / rect.height - 0.5);
  };

  const handlePointerLeave = () => {
    tiltX.set(0);
    tiltY.set(0);
  };

  return (
    <div
      ref={containerRef}
      className={`relative h-full min-h-[200px] w-full overflow-hidden ${className}`}
      style={{ backgroundColor: bgColor, ...style }}
      data-theme={theme}
      onPointerMove={tiltEnabled ? handlePointerMove : undefined}
      onPointerLeave={tiltEnabled ? handlePointerLeave : undefined}
    >
      <AmbientSurface theme={theme} />

      {/* Static wall / background — does not tilt */}
      <canvas
        ref={bgCanvasRef}
        className="absolute inset-0 block h-full w-full touch-none"
        aria-hidden
      />

      {/* Logo + spray can only — 3D tilt on pointer move */}
      <motion.div
        ref={stageRef}
        className="absolute inset-0"
        style={{
          rotateX: tiltEnabled ? stageRotateX : 0,
          rotateY: tiltEnabled ? stageRotateY : 0,
          transformPerspective: 1400,
          transformStyle: "preserve-3d",
        }}
      >
        <canvas
          ref={canvasRef}
          className="block h-full w-full touch-none"
          style={{ background: "transparent" }}
          aria-label="undergroundradio spray paint animation"
          role="img"
        />

        {showCanUi && showCan && (
          <motion.div
            ref={canWrapperRef}
            className="pointer-events-none absolute z-20 -translate-x-[30%] -translate-y-[60%]"
            style={{
              left: canX,
              top: canY,
              filter: sprayActive
                ? `drop-shadow(0 20px 36px rgba(0,0,0,0.55)) drop-shadow(0 0 ${canSize * 0.5}px ${theme === "dark" ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.15)"})`
                : "drop-shadow(0 28px 32px rgba(0,0,0,0.5))",
            }}
          >
            <SprayCanMotion3D
              paintColor={paintColor}
              theme={theme}
              size={canSize}
              shaking={shaking}
              spraying={sprayActive}
            />
          </motion.div>
        )}
      </motion.div>

      {!ready && (
        <motion.div
          className="absolute inset-0 z-10 flex items-center justify-center text-sm"
          style={{ color: paintColor }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.45 }}
        >
          Loading...
        </motion.div>
      )}
    </div>
  );
});

export default UndergroundRadioSpray;
