import gsap from "gsap";

/** Shared GSAP ease for spray + letter — one curve, same clock. */
export function spraySyncEase(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return gsap.parseEase("power2.inOut")(c);
}

export function animateStageReveal(target: HTMLElement | null) {
  if (!target) return undefined;
  return gsap.fromTo(
    target,
    { opacity: 0, scale: 0.93, y: 18 },
    { opacity: 1, scale: 1, y: 0, duration: 1.05, ease: "power3.out", clearProps: "transform" },
  );
}

export function runCanShake(target: HTMLElement | null, durationMs: number) {
  if (!target) return undefined;
  return gsap.timeline({ repeat: -1 }).to(target, {
    x: "+=5",
    y: "+=2.5",
    rotation: 4,
    duration: 0.085,
    yoyo: true,
    ease: "sine.inOut",
    repeat: Math.max(1, Math.floor(durationMs / 170)),
  });
}

export function pulseSprayMist(target: HTMLElement | null, paintColor: string) {
  if (!target) return undefined;
  return gsap.timeline({ repeat: -1 }).to(target, {
    scale: 1.12,
    opacity: 0.95,
    duration: 0.22,
    yoyo: true,
    ease: "sine.inOut",
    boxShadow: `0 0 28px ${paintColor}55`,
  });
}

export function killGsapTween(tween?: gsap.core.Tween | gsap.core.Timeline | null) {
  tween?.kill();
}
