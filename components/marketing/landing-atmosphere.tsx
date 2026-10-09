'use client';

import { useEffect, useRef, useState } from 'react';

function canUsePointerLight() {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

export function LandingAtmosphere() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-[#050708]" />
      <div className="absolute inset-0 landing-grid opacity-[0.18]" />
      <div className="absolute -left-32 top-[-8rem] h-[28rem] w-[28rem] rounded-full bg-[#39FF88]/[0.08] blur-[72px] landing-glow" />
      <div className="absolute right-[-10rem] top-24 h-[22rem] w-[22rem] rounded-full bg-[#35D6FF]/[0.06] blur-[64px] landing-glow" />
      <div className="absolute bottom-[-8rem] left-1/3 h-[18rem] w-[18rem] rounded-full bg-white/[0.03] blur-[56px]" />
      <div className="landing-particles absolute inset-0" />
    </div>
  );
}

export function CursorGlow() {
  const ref = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!canUsePointerLight()) return;
    setEnabled(true);
    const node = ref.current;
    if (!node) return;

    const onMove = (event: PointerEvent) => {
      node.style.setProperty('--mouse-x', `${event.clientX}px`);
      node.style.setProperty('--mouse-y', `${event.clientY}px`);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  if (!enabled) return null;

  return (
    <div
      ref={ref}
      className="pointer-events-none fixed inset-0 z-30 hidden md:block"
      aria-hidden
      style={{
        background:
          'radial-gradient(circle 180px at var(--mouse-x, -200px) var(--mouse-y, -200px), rgba(57,255,136,0.10), rgba(53,214,255,0.04) 38%, transparent 70%)',
      }}
    />
  );
}
