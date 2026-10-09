'use client';

import { useEffect, useState, type ComponentType } from 'react';

export type PointerRef = { current: { x: number; y: number } };

export function HeroCssFallback() {
  return (
    <div className="relative flex h-full min-h-[240px] items-center justify-center lg:min-h-[520px]" aria-hidden>
      <div className="absolute h-48 w-48 rounded-full bg-[#39FF88]/15 blur-3xl lg:h-72 lg:w-72" />
      <div className="relative h-24 w-64 rotate-[-18deg] lg:h-32 lg:w-80">
        <div className="absolute left-0 top-1/2 h-20 w-20 -translate-y-1/2 rounded-full border border-[#39FF88]/50 bg-gradient-to-br from-zinc-700 to-zinc-950 shadow-[0_0_28px_rgba(57,255,136,0.25)] lg:h-28 lg:w-28" />
        <div className="absolute right-0 top-1/2 h-20 w-20 -translate-y-1/2 rounded-full border border-[#39FF88]/50 bg-gradient-to-br from-zinc-700 to-zinc-950 shadow-[0_0_28px_rgba(57,255,136,0.25)] lg:h-28 lg:w-28" />
        <div className="absolute left-16 right-16 top-1/2 h-3 -translate-y-1/2 rounded-full bg-gradient-to-r from-zinc-500 via-zinc-200 to-zinc-500 lg:h-4" />
      </div>
    </div>
  );
}

export function DeferredHeroDumbbell({ pointer }: { pointer: PointerRef }) {
  const [Hero, setHero] = useState<ComponentType<{ pointer: PointerRef }> | null>(null);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const desktop = window.matchMedia('(min-width: 1024px)').matches;
    if (reduce || !desktop) return;

    let cancelled = false;
    const load = () => {
      void import('@/components/marketing/hero-dumbbell').then((mod) => {
        if (!cancelled) setHero(() => mod.HeroDumbbell);
      });
    };

    let idleId: number | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(load, { timeout: 1800 });
    } else {
      timer = setTimeout(load, 700);
    }

    return () => {
      cancelled = true;
      if (idleId !== undefined) window.cancelIdleCallback(idleId);
      if (timer !== undefined) clearTimeout(timer);
    };
  }, []);

  if (!Hero) return <HeroCssFallback />;
  return <Hero pointer={pointer} />;
}
