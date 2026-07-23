'use client';

/** Full-bleed AI voice signal — colorful bars, product metaphor. */
export function VoiceWave({ className = '' }: { className?: string }) {
  const bars = [
    22, 34, 48, 62, 78, 92, 68, 52, 38, 56, 82, 96, 74, 46, 32, 58, 86, 70, 44, 28,
    36, 64, 90, 76, 54, 34, 48, 72, 94, 80, 58, 40, 28, 50, 66, 84, 60, 38, 24, 42,
  ];

  return (
    <div
      className={`pointer-events-none absolute inset-x-0 bottom-0 overflow-hidden ${className}`}
      aria-hidden
    >
      <svg
        className="h-[36vh] w-full min-h-[180px] opacity-70 sm:h-[44vh] sm:min-h-[240px] sm:opacity-85"
        viewBox="0 0 800 200"
        preserveAspectRatio="none"
        fill="none"
      >
        <defs>
          <linearGradient id="waveFill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#1a82f5" stopOpacity="0.75" />
            <stop offset="45%" stopColor="#0d9488" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.35" />
          </linearGradient>
          <linearGradient id="waveStroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#1a82f5" stopOpacity="0" />
            <stop offset="25%" stopColor="#38bdf8" stopOpacity="0.95" />
            <stop offset="55%" stopColor="#14b8a6" stopOpacity="0.95" />
            <stop offset="80%" stopColor="#fbbf24" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
          </linearGradient>
        </defs>
        {bars.map((h, i) => {
          const x = 8 + i * 19.7;
          const y = 100 - h / 2;
          return (
            <rect
              key={i}
              className="land-wave-bar"
              x={x}
              y={y}
              width="9"
              height={h}
              rx="3.5"
              fill="url(#waveFill)"
              style={{ animationDelay: `${(i % 12) * 0.07}s` }}
            />
          );
        })}
        <path
          className="land-wave-line"
          d="M0 108 C80 70, 140 140, 220 100 S360 50, 440 110 S600 160, 700 90 S780 60, 800 100"
          stroke="url(#waveStroke)"
          strokeWidth="2.6"
          fill="none"
        />
      </svg>
      <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#eaf3ff] via-[#eaf3ff]/80 to-transparent" />
    </div>
  );
}
