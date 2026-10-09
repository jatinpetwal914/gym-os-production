'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { Suspense, useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import * as THREE from 'three';

export type PointerRef = MutableRefObject<{ x: number; y: number }>;

function Plate({ position, radius, thickness }: { position: [number, number, number]; radius: number; thickness: number }) {
  return (
    <group position={position} rotation={[0, 0, Math.PI / 2]}>
      <mesh>
        <cylinderGeometry args={[radius, radius, thickness, 24]} />
        <meshStandardMaterial color="#121417" metalness={0.92} roughness={0.22} />
      </mesh>
      <mesh>
        <torusGeometry args={[radius * 0.98, 0.018, 8, 24]} />
        <meshStandardMaterial
          color="#39FF88"
          emissive="#39FF88"
          emissiveIntensity={0.85}
          metalness={0.2}
          roughness={0.35}
        />
      </mesh>
    </group>
  );
}

function CinematicDumbbell({ pointer, reduced }: { pointer: PointerRef; reduced: boolean }) {
  const group = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime;
    if (reduced) {
      group.current.rotation.set(0.28, 0.35, 0.12);
      group.current.position.y = 0;
      return;
    }
    const px = pointer.current.x;
    const py = pointer.current.y;
    const targetX = 0.22 + Math.sin(t * 0.5) * 0.08 + py * 0.07;
    const targetY = t * 0.12 + px * 0.07;
    group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, targetX, 0.06);
    group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, targetY, 0.04);
    group.current.rotation.z = THREE.MathUtils.lerp(group.current.rotation.z, 0.12 + px * 0.03, 0.06);
    group.current.position.y = Math.sin(t * 0.5) * 0.12;
  });

  return (
    <group ref={group} rotation={[0.28, 0.4, 0.12]}>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.075, 0.075, 2.35, 16]} />
        <meshStandardMaterial color="#2a2d31" metalness={0.95} roughness={0.18} />
      </mesh>
      <Plate position={[-0.98, 0, 0]} radius={0.38} thickness={0.16} />
      <Plate position={[-0.78, 0, 0]} radius={0.26} thickness={0.12} />
      <Plate position={[0.78, 0, 0]} radius={0.26} thickness={0.12} />
      <Plate position={[0.98, 0, 0]} radius={0.38} thickness={0.16} />
    </group>
  );
}

export function HeroDumbbell({ pointer }: { pointer: PointerRef }) {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  return (
    <div className="pointer-events-none h-full min-h-[280px] w-full lg:min-h-[520px]">
      <Canvas camera={{ position: [0, 0.2, 4.4], fov: 40 }} dpr={[1, 1.25]} gl={{ antialias: false, alpha: true, powerPreference: 'low-power' }}>
        <Suspense fallback={null}>
          <ambientLight intensity={0.28} />
          <directionalLight position={[4, 5, 6]} intensity={1.2} color="#f4f7f5" />
          <pointLight position={[1.4, 1.6, 2.2]} intensity={1.4} color="#39FF88" />
          <pointLight position={[-2.2, -0.4, -1.2]} intensity={0.55} color="#35D6FF" />
          <CinematicDumbbell pointer={pointer} reduced={reduced} />
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.25, 0]}>
            <circleGeometry args={[1.7, 24]} />
            <meshBasicMaterial color="#39FF88" transparent opacity={0.08} />
          </mesh>
        </Suspense>
      </Canvas>
    </div>
  );
}
