/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../../store';
import { GameStatus } from '../../types';

interface DribbleRipple {
  id: number;
  position: [number, number, number];
  radius: number;
  maxRadius: number;
  opacity: number;
  color: string;
}

interface SkidParticle {
  id: number;
  position: [number, number, number];
  scale: number;
  opacity: number;
  angle: number;
}

interface DustPuff {
  id: number;
  position: [number, number, number];
  scale: number;
  opacity: number;
  tint: string;
}

const RIPPLE_GEO = new THREE.RingGeometry(0.18, 0.24, 32);
const SKID_GEO = new THREE.PlaneGeometry(0.24, 0.08);
const DUST_GEO = new THREE.CircleGeometry(1, 20);

export const CourtVFX: React.FC = () => {
  const { status, speed, dribbleMultiplier } = useStore();
  const [ripples, setRipples] = useState<DribbleRipple[]>([]);
  const [skids, setSkids] = useState<SkidParticle[]>([]);
  const [dusts, setDusts] = useState<DustPuff[]>([]);
  const nextId = useRef(1);

  const spawnDust = (x: number, z: number, intensity: number, tint = '#e2e0d8') => {
    const count = intensity > 0.6 ? 3 : 1;
    const arr: DustPuff[] = [];
    for (let i = 0; i < count; i++) {
      arr.push({
        id: nextId.current++,
        position: [x + (Math.random() - 0.5) * 0.5, 0.025, z + (Math.random() - 0.5) * 0.5],
        scale: 0.15 + intensity * 0.25,
        opacity: 0.4 + intensity * 0.3,
        tint,
      });
    }
    setDusts(prev => [...prev.slice(-14), ...arr]);
  };

  // Listen for dribble floor impact
  useEffect(() => {
    const handleDribble = (e: any) => {
      if (status !== GameStatus.PLAYING) return;
      const detail = e.detail || {};
      const mult = detail.multiplier || 1;
      const x = detail.x || 0;
      const z = detail.z || 0.2;

      const rippleColor =
        mult >= 5 ? '#facc15' :
        mult === 4 ? '#ef4444' :
        mult === 3 ? '#ea580c' : '#f59e0b';

      setRipples(prev => [
        ...prev.slice(-12),
        {
          id: nextId.current++,
          position: [x, 0.015, z],
          radius: 0.2,
          maxRadius: 0.65 + mult * 0.1,
          opacity: Math.min(0.9, 0.45 + mult * 0.1),
          color: rippleColor,
        }
      ]);

      // Light dribble dust kick on each bounce
      spawnDust(x, z, 0.25, rippleColor);
    };

    const handleLanding = (e: any) => {
      if (status !== GameStatus.PLAYING) return;
      const detail = e.detail || {};
      const x = detail.x ?? 0;
      const z = detail.z ?? 0;
      const intensity = detail.intensity ?? 0.5;
      window.dispatchEvent(new CustomEvent('screen-shake', {
        detail: { intensity: 0.05 + intensity * 0.3 }
      }));
      spawnDust(x, z, intensity);
    };

    const handleCrossover = (e: any) => {
      if (status !== GameStatus.PLAYING) return;
      const detail = e.detail || {};
      const dir = detail.direction || 1;
      const lane = detail.lane || 0;

      setSkids(prev => [
        ...prev.slice(-8),
        {
          id: nextId.current++,
          position: [lane * 2.8, 0.014, 0.4],
          scale: 1.0,
          opacity: 0.65,
          angle: dir * 0.45,
        }
      ]);
    };

    window.addEventListener('dribble-impact', handleDribble);
    window.addEventListener('crossover-turn', handleCrossover);
    window.addEventListener('player-landed', handleLanding);

    return () => {
      window.removeEventListener('dribble-impact', handleDribble);
      window.removeEventListener('crossover-turn', handleCrossover);
      window.removeEventListener('player-landed', handleLanding);
    };
  }, [status]);

  useFrame((_, delta) => {
    if (status !== GameStatus.PLAYING) return;
    const safeDelta = Math.min(delta, 0.05);

    // Animate and fade ripples
    setRipples(prev => {
      if (prev.length === 0) return prev;
      return prev
        .map(r => ({
          ...r,
          radius: r.radius + safeDelta * 2.8,
          opacity: r.opacity - safeDelta * 3.0,
          position: [r.position[0], r.position[1], r.position[2] + speed * safeDelta],
        }))
        .filter(r => r.opacity > 0.02 && r.radius < r.maxRadius);
    });

    // Animate and fade sneaker skids
    setSkids(prev => {
      if (prev.length === 0) return prev;
      return prev
        .map(s => ({
          ...s,
          opacity: s.opacity - safeDelta * 2.0,
          position: [s.position[0], s.position[1], s.position[2] + speed * safeDelta],
        }))
        .filter(s => s.opacity > 0.02);
    });

    // Animate and fade dust puffs (expand outward)
    setDusts(prev => {
      if (prev.length === 0) return prev;
      return prev
        .map(d => ({
          ...d,
          scale: d.scale + safeDelta * 3.4,
          opacity: d.opacity - safeDelta * 1.6,
          position: [d.position[0], d.position[1], d.position[2] + speed * safeDelta],
        }))
        .filter(d => d.opacity > 0.02);
    });
  });

  return (
    <group>
      {/* Hardwood Court Floor Dribble Ripples */}
      {ripples.map(r => (
        <mesh
          key={r.id}
          position={r.position}
          rotation={[-Math.PI / 2, 0, 0]}
          geometry={RIPPLE_GEO}
          scale={[r.radius / 0.2, r.radius / 0.2, 1]}
        >
          <meshBasicMaterial
            color={r.color}
            transparent
            opacity={r.opacity}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}

      {/* Sneaker Crossover Court Marks */}
      {skids.map(s => (
        <mesh
          key={s.id}
          position={s.position}
          rotation={[-Math.PI / 2, 0, s.angle]}
          geometry={SKID_GEO}
        >
          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={s.opacity * 0.55}
          />
        </mesh>
      ))}

      {/* Landing & Dribble Dust Puffs */}
      {dusts.map(d => (
        <mesh
          key={d.id}
          position={d.position}
          rotation={[-Math.PI / 2, 0, d.id % 2 === 0 ? 0 : Math.PI / 2]}
          geometry={DUST_GEO}
          scale={[d.scale, d.scale, 1]}
        >
          <meshBasicMaterial
            color={d.tint}
            transparent
            opacity={d.opacity}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
};
