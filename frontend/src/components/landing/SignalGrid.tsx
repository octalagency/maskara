/** Soft mesh + concentric rings — voice.ai style color field. */
export function SignalGrid() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {/* Concentric signal rings */}
      <div className="absolute left-1/2 top-[42%] h-[140vmax] w-[140vmax] -translate-x-1/2 -translate-y-1/2">
        {[18, 32, 46, 60, 74].map((size) => (
          <div
            key={size}
            className="land-ring absolute left-1/2 top-1/2 rounded-full border border-[#3b5bdb]/[0.07]"
            style={{
              width: `${size}%`,
              height: `${size}%`,
              transform: 'translate(-50%, -50%)',
            }}
          />
        ))}
      </div>

      {/* Mesh color field */}
      <div className="land-mesh absolute left-1/2 top-[48%] h-[min(70vw,520px)] w-[min(92vw,780px)] -translate-x-1/2 -translate-y-1/2 rounded-[40%] opacity-90 blur-2xl sm:blur-3xl" />
      <div className="land-mesh-2 absolute left-[58%] top-[38%] h-[280px] w-[280px] -translate-x-1/2 rounded-full opacity-70 blur-3xl sm:h-[360px] sm:w-[360px]" />
      <div className="land-mesh-3 absolute left-[38%] top-[55%] h-[220px] w-[220px] -translate-x-1/2 rounded-full opacity-60 blur-3xl sm:h-[300px] sm:w-[300px]" />
    </div>
  );
}
