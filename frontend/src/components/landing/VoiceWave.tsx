'use client';

/** Full-bleed AI voice signal — product metaphor, not decorative fluff. */
export function VoiceWave({ className = '' }: { className?: string }) {
  const bars = [
    18, 28, 42, 58, 72, 88, 64, 48, 36, 52, 78, 94, 70, 44, 30, 56, 82, 66, 40, 24,
    34, 60, 86, 74, 50, 32, 46, 68, 90, 76, 54, 38, 26, 48, 62, 80, 58, 36, 22, 40,
  ];

  return (
    <div className={`pointer-events-none absolute inset-x-0 bottom-0 overflow-hidden ${className}`} aria-hidden>
      <svg
        className="h-[42vh] w-full min-h-[220px] opacity-[0.55] sm:opacity-70"
        viewBox="0 0 800 200"
        preserveAspectRatio="none"
        fill="none"
      >
        <defs>
          <linearGradient id="waveFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1a82f5" stopOpacity="0.55" />
            <stop offset="55%" stopColor="#33a1ff" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#33a1ff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="waveStroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#1a82f5" stopOpacity="0" />
            <stop offset="35%" stopColor="#1a82f5" stopOpacity="0.9" />
            <stop offset="65%" stopColor="#0ea5a0" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#0ea5a0" stopOpacity="0" />
          </linearGradient>
        </defs>
        {bars.map((h, i) => {
          const x = 10 + i * 19.5;
          const y = 100 - h / 2;
          return (
            <rect
              key={i}
              className="land-wave-bar"
              x={x}
              y={y}
              width="8"
              height={h}
              rx="3"
              fill="url(#waveFill)"
              style={{ animationDelay: `${(i % 12) * 0.08}s` }}
            />
          );
        })}
        <path
          className="land-wave-line"
          d="M0 108 C80 70, 140 140, 220 100 S360 50, 440 110 S600 160, 700 90 S780 60, 800 100"
          stroke="url(#waveStroke)"
          strokeWidth="2.2"
          fill="none"
        />
      </svg>
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#eef3f8] to-transparent" />
    </div>
  );
}
