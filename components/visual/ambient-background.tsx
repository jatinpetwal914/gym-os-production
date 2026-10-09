'use client';

export function AmbientBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-[#F4F7FA]" />
      <div className="absolute inset-0 opacity-40 gym-grid-bg" />
      <div className="absolute -left-24 top-[-8rem] h-[28rem] w-[28rem] rounded-full bg-[#6DCCC3]/25 blur-[90px]" />
      <div className="absolute right-[-8rem] top-24 h-[22rem] w-[22rem] rounded-full bg-[#2064B6]/12 blur-[80px]" />
    </div>
  );
}
