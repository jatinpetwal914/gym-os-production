'use client';

export function OrbitRing({ className = '' }: { className?: string }) {
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden>
      <div className="gym-orbit absolute -right-8 -top-10 h-28 w-28 rounded-full border border-[#6DCCC3]/40" />
      <div className="gym-orbit-slow absolute -right-4 -top-6 h-20 w-20 rounded-full border border-[#DAE1E7]" />
      <div className="absolute right-6 top-8 h-1.5 w-1.5 rounded-full bg-[#2064B6]" />
    </div>
  );
}
