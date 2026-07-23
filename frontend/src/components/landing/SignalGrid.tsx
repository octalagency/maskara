/** Soft multi-hue atmosphere — sky, teal, amber (no purple neon). */
export function SignalGrid() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute -left-[20%] top-[-18%] h-[70vh] w-[70vh] rounded-full bg-[radial-gradient(circle,rgba(26,130,245,0.28)_0%,transparent_68%)] land-orb" />
      <div className="absolute -right-[15%] top-[5%] h-[58vh] w-[58vh] rounded-full bg-[radial-gradient(circle,rgba(13,148,136,0.22)_0%,transparent_70%)] land-orb land-orb-delay" />
      <div className="absolute bottom-[18%] left-[28%] h-[40vh] w-[40vh] rounded-full bg-[radial-gradient(circle,rgba(245,158,11,0.14)_0%,transparent_72%)]" />
      <div className="absolute inset-0 land-grid opacity-[0.55]" />
      <div className="absolute left-[10%] top-[26%] h-2 w-2 rounded-full bg-sky-500/80 land-pulse" />
      <div className="absolute right-[14%] top-[32%] h-2 w-2 rounded-full bg-teal-500/70 land-pulse land-pulse-delay" />
      <div className="absolute left-[48%] top-[16%] h-1.5 w-1.5 rounded-full bg-amber-400/80 land-pulse land-pulse-delay-2" />
      <div className="absolute right-[28%] top-[48%] h-1.5 w-1.5 rounded-full bg-sky-400/60 land-pulse land-pulse-delay" />
    </div>
  );
}
