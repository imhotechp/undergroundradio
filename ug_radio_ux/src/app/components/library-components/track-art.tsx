const GRADIENTS: [string, string][] = [
  ["#4c1d95", "#0f0a1f"],
  ["#1e3a8a", "#0a0f1f"],
  ["#7f1d1d", "#1a0a0a"],
  ["#14532d", "#08140c"],
  ["#78350f", "#1a0f05"],
  ["#831843", "#1a0510"],
  ["#164e63", "#051419"],
  ["#3f3f46", "#0a0a0a"],
];

export function gradientForIndex(index: number): string {
  const [from, to] = GRADIENTS[((index % GRADIENTS.length) + GRADIENTS.length) % GRADIENTS.length];
  return `linear-gradient(135deg, ${from}, ${to})`;
}

/** Renders real cover art when a track has one; falls back to a gradient placeholder tile. */
export function TrackArt({
  index,
  size = 48,
  className = "",
  src,
  alt = "",
}: {
  index: number;
  size?: number;
  className?: string;
  src?: string;
  alt?: string;
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- external R2 URL, not in next/image's allowed domains
      <img
        src={src}
        alt={alt}
        width={size}
        height={size}
        className={`shrink-0 overflow-hidden rounded-md object-cover ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-md ${className}`}
      style={{ width: size, height: size, backgroundImage: gradientForIndex(index) }}
    >
      <svg
        width={size * 0.4}
        height={size * 0.4}
        viewBox="0 0 24 24"
        fill="currentColor"
        className="text-white/25"
        aria-hidden
      >
        <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z" />
      </svg>
    </div>
  );
}
