import gsap from "gsap";
import { useEffect, useRef } from "react";

export interface SprayCanMotion3DProps {
  paintColor: string;
  theme: "dark" | "light";
  size: number;
  shaking: boolean;
  spraying: boolean;
}

function CanSvg({ paintColor, size }: { paintColor: string; size: number }) {
  const id = paintColor.replace("#", "");
  return (
    <svg
      width={size}
      height={size * 2}
      viewBox="0 0 58 116"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient
          id={`body-${id}`}
          x1="7"
          x2="51"
          y1="46"
          y2="46"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#0a0a0c" />
          <stop offset="0.2" stopColor="#52525b" />
          <stop offset="0.55" stopColor="#18181b" />
          <stop offset="1" stopColor="#050506" />
        </linearGradient>
        <linearGradient
          id={`band-${id}`}
          x1="13"
          x2="45"
          y1="65"
          y2="65"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor={paintColor} stopOpacity="0.35" />
          <stop offset="0.5" stopColor={paintColor} />
          <stop offset="1" stopColor={paintColor} stopOpacity="0.5" />
        </linearGradient>
        <radialGradient id={`cap-${id}`} cx="0.5" cy="0.5" r="0.5">
          <stop stopColor="#d4d4dc" />
          <stop offset="1" stopColor="#2a2a32" />
        </radialGradient>
        <filter id={`glow-${id}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <ellipse cx="29" cy="110" rx="18" ry="5.5" fill="#000" opacity="0.5" />
      <path
        d="M11 38 C11 31 47 31 47 38 V100 C47 108 11 108 11 100 V38Z"
        fill={`url(#body-${id})`}
      />
      <path
        d="M14 40 C14 36 44 36 44 40 V98 C44 103 14 103 14 98 V40Z"
        fill={`url(#band-${id})`}
        opacity="0.95"
      />
      <ellipse cx="29" cy="38" rx="17.5" ry="6.5" fill="#7a7a86" />
      <ellipse cx="29" cy="100" rx="17.5" ry="7.5" fill="#111114" />
      <path d="M17 43 C22 46 36 46 41 43" stroke="#fff" strokeOpacity="0.28" strokeWidth="2" />
      <path
        d="M19 56 V86"
        stroke="#fff"
        strokeOpacity="0.35"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <rect x="19" y="18" width="20" height="21" rx="4" fill={`url(#cap-${id})`} />
      <rect x="23" y="6" width="12" height="15" rx="3" fill="#5a5a64" />
      <path
        d="M33 26 L52 17"
        stroke="#8a8a96"
        strokeWidth="3.5"
        strokeLinecap="round"
        filter={`url(#glow-${id})`}
      />
      <ellipse cx="52" cy="17" rx="4.8" ry="3" fill="#1e1e24" />
      <circle cx="52" cy="17" r="2" fill={paintColor} opacity="0.95" />
      <circle cx="52" cy="17" r="4.5" fill={paintColor} opacity="0.2" />
    </svg>
  );
}

/** CSS 3D spray can — GSAP shake + mist synced with canvas spray. */
export function SprayCanMotion3D({
  paintColor,
  theme,
  size,
  shaking,
  spraying,
}: SprayCanMotion3DProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const mistRef = useRef<HTMLSpanElement>(null);
  const shakeTween = useRef<gsap.core.Tween | null>(null);
  const mistTween = useRef<gsap.core.Tween | null>(null);

  const mistW = Math.max(100, size * 2.2);
  const mistH = Math.max(52, size * 1);
  const mistColor =
    theme === "dark" ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.5)";

  useEffect(() => {
    shakeTween.current?.kill();
    if (shaking && rootRef.current) {
      gsap.set(rootRef.current, { x: 0, y: 0, rotation: 0 });
      shakeTween.current = gsap.to(rootRef.current, {
        x: "+=5",
        y: "+=2.5",
        rotation: 4,
        duration: 0.085,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });
    }
    return () => {
      shakeTween.current?.kill();
    };
  }, [shaking]);

  useEffect(() => {
    mistTween.current?.kill();
    if (spraying && mistRef.current) {
      gsap.set(mistRef.current, { scale: 0.85, opacity: 0.55 });
      mistTween.current = gsap.to(mistRef.current, {
        scale: 1.1,
        opacity: 0.95,
        duration: 0.2,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });
    }
    return () => {
      mistTween.current?.kill();
    };
  }, [spraying]);

  const tiltX = spraying ? -10 : 6;
  const tiltY = spraying ? -34 : -14;
  const tiltZ = spraying ? -7 : 0;

  return (
    <div ref={rootRef} style={{ perspective: 900, transformStyle: "preserve-3d" }}>
      <div
        style={{
          transform: `rotateX(${tiltX}deg) rotateY(${tiltY}deg) rotateZ(${tiltZ}deg)`,
          transformStyle: "preserve-3d",
        }}
      >
        <div
          className="absolute left-1/2 rounded-full bg-black/50 blur-md"
          style={{
            width: size * 0.95,
            height: size * 0.24,
            bottom: -size * 0.08,
            transform: "translateX(-50%) translateZ(-40px)",
          }}
        />

        {spraying && (
          <>
            <span
              data-spray-mist
              ref={mistRef}
              className="pointer-events-none absolute rounded-full blur-3xl"
              style={{
                left: size * 0.55,
                top: size * 0.22,
                width: mistW * 1.3,
                height: mistH * 1.4,
                transform: "translateZ(20px)",
                background: `radial-gradient(ellipse, ${mistColor} 0%, transparent 70%)`,
              }}
            />
            <span
              className="pointer-events-none absolute rounded-full blur-2xl"
              style={{
                left: size * 0.68,
                top: size * 0.3,
                width: mistW,
                height: mistH,
                transform: "translateZ(35px)",
                background:
                  theme === "dark"
                    ? "radial-gradient(ellipse, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.2) 42%, transparent 75%)"
                    : "radial-gradient(ellipse, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.12) 42%, transparent 75%)",
              }}
            />
          </>
        )}

        <div style={{ transform: "translateZ(0)" }}>
          <CanSvg paintColor={paintColor} size={size} />
        </div>
      </div>
    </div>
  );
}
