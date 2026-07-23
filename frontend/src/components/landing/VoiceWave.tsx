'use client';

/** Soft animated bars sitting inside the mesh — voice signal, not a chart. */
export function VoiceWave({ className = '' }: { className?: string }) {
  const bars = Array.from({ length: 36 }, (_, i) => 24 + ((i * 11) % 56));

  return (
    <div
      className={`pointer-events-none absolute inset-x-0 bottom-[8%] flex justify-center sm:bottom-[10%] ${className}`}
      aria-hidden
    >
      <div className="flex h-16 items-end gap-[3px] opacity-50 sm:h-24 sm:gap-1 sm:opacity-60">
        {bars.map((h, i) => (
          <span
            key={i}
            className="land-wave-bar w-[3px] rounded-full bg-gradient-to-t from-[#3b5bdb]/50 via-[#8b7cf6]/45 to-[#f9a8d4]/40 sm:w-1.5"
            style={{
              height: `${h}%`,
              minHeight: 8,
              animationDelay: `${(i % 10) * 0.08}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
