'use client';

import { type MouseEvent, type ReactNode, useCallback, useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

const spring = { type: 'spring' as const, stiffness: 350, damping: 25 };

function finePointer() {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

export function InteractiveCard({
  children,
  className = '',
  onClick,
  type,
  elevated = false,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  type?: 'button';
  elevated?: boolean;
}) {
  const root = useRef<HTMLButtonElement | HTMLDivElement>(null);
  const [lit, setLit] = useState(false);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, spring);
  const sy = useSpring(y, spring);
  const rotateX = useTransform(sy, [-0.5, 0.5], [2, -2]);
  const rotateY = useTransform(sx, [-0.5, 0.5], [-2, 2]);

  const onMove = useCallback((event: MouseEvent<HTMLElement>) => {
    if (!finePointer() || !root.current) return;
    const rect = root.current.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;
    x.set(px - 0.5);
    y.set(py - 0.5);
    root.current.style.setProperty('--mx', `${event.clientX - rect.left}px`);
    root.current.style.setProperty('--my', `${event.clientY - rect.top}px`);
    setLit(true);
  }, [x, y]);

  const onLeave = useCallback(() => {
    x.set(0);
    y.set(0);
    setLit(false);
  }, [x, y]);

  const shared = {
    ref: root as never,
    onMouseMove: onMove,
    onMouseLeave: onLeave,
    style: { rotateX, rotateY, transformPerspective: 900 },
    className: `group relative overflow-hidden text-left ${elevated ? 'z-[1]' : ''} ${className}`,
  };

  const light = (
    <span
      aria-hidden
      className={`pointer-events-none absolute inset-0 transition-opacity duration-300 ${lit ? 'opacity-100' : 'opacity-0'}`}
      style={{
        background:
          'radial-gradient(circle 140px at var(--mx, 50%) var(--my, 50%), rgba(57,255,136,0.12), transparent 65%)',
      }}
    />
  );

  if (type === 'button') {
    return (
      <motion.button type="button" onClick={onClick} whileTap={{ scale: 0.98 }} {...shared}>
        {light}
        <span className="relative z-[1] flex h-full flex-col">{children}</span>
      </motion.button>
    );
  }

  return (
    <motion.div {...shared}>
      {light}
      <div className="relative z-[1] h-full">{children}</div>
    </motion.div>
  );
}
