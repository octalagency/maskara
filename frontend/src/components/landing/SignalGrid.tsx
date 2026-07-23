/** Soft intelligence lattice behind the hero — light, not neon. */
export function SignalGrid() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute -left-24 top-[-10%] h-[55vh] w-[55vh] rounded-full bg-[radial-gradient(circle,rgba(26,130,245,0.16)_0%,transparent_68%)]" />
      <div className="absolute -right-16 top-[8%] h-[48vh] w-[48vh] rounded-full bg-[radial-gradient(circle,rgba(14,165,160,0.12)_0%,transparent_70%)]" />
      <div className="absolute inset-0 land-grid opacity-[0.4]" />
      <div className="absolute left-[12%] top-[28%] h-1.5 w-1.5 rounded-full bg-brand-500/70 land-pulse" />
      <div className="absolute right-[18%] top-[36%] h-1.5 w-1.5 rounded-full bg-teal-500/60 land-pulse land-pulse-delay" />
      <div className="absolute left-[42%] top-[18%] h-1 w-1 rounded-full bg-brand-400/50 land-pulse land-pulse-delay-2" />
    </div>
  );
}
