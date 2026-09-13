/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef } from 'react';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface Popup {
  id: number;
  position: [number, number, number];
  text: string;
  sub: string;
  color: string;
  scale: number;
  bornAt: number;
  life: number;
}

interface Halo {
  id: number;
  position: [number, number, number];
  scale: number;
  opacity: number;
}

const POPUP_LIFE = 950;
const MAX_POPUPS = 16;
const MAX_HALOS = 22;

export const ScorePopups: React.FC = () => {
  const [popups, setPopups] = useState<Popup[]>([]);
  const [halos, setHalos] = useState<Halo[]>([]);
  const nextId = useRef(1);

  useEffect(() => {
    const handlePopup = (e: any) => {
      const d = e.detail || {};
      const pos: [number, number, number] = d.position || [0, 2, 0];
      setPopups(prev => [
        ...prev.slice(-(MAX_POPUPS - 1)),
        {
          id: nextId.current++,
          position: pos,
          text: d.text || '',
          sub: d.sub || '',
          color: d.color || '#ffffff',
          scale: d.scale || 1,
          bornAt: performance.now(),
          life: POPUP_LIFE,
        },
      ]);
    };

    const handleLetterTrail = (e: any) => {
      const d = e.detail || {};
      const pos: [number, number, number] = d.position || [0, 2, 0];
      const halosList: Halo[] = [];
      for (let i = 0; i < 5; i++) {
        halosList.push({
          id: nextId.current++,
          position: [pos[0], pos[1], pos[2] + i * 2.2],
          scale: i * 0.55,
          opacity: 0.65 - i * 0.12,
        });
      }
      setHalos(prev => [...prev.slice(-(MAX_HALOS - halosList.length)), ...halosList]);
    };

    window.addEventListener('score-popup', handlePopup);
    window.addEventListener('letter-trail', handleLetterTrail);
    return () => {
      window.removeEventListener('score-popup', handlePopup);
      window.removeEventListener('letter-trail', handleLetterTrail);
    };
  }, []);

  useFrame(() => {
    const now = performance.now();
    setPopups(prev => (prev.length ? prev.filter(p => now - p.bornAt < p.life) : prev));
    setHalos(prev =>
      prev.length
        ? prev
            .map(h => ({ ...h, opacity: h.opacity - 0.03, scale: h.scale + 0.25 }))
            .filter(h => h.opacity > 0.04)
        : prev
    );
  });

  return (
    <group>
      {halos.map(h => (
        <mesh key={h.id} position={[h.position[0], h.position[1], h.position[2]]}>
          <ringGeometry args={[0.35 + h.scale, 0.6 + h.scale, 24]} />
          <meshBasicMaterial color="#c084fc" transparent opacity={h.opacity} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      ))}

      {popups.map(p => {
        const age = performance.now() - p.bornAt;
        const lifeT = Math.min(1, age / p.life);
        const drift = lifeT * 1.4;
        return (
          <Html
            key={p.id}
            position={[p.position[0], p.position[1] + drift, p.position[2]]}
            center
            zIndexRange={[300, 0]}
            style={{ pointerEvents: 'none' }}
          >
            <div className="score-popup" style={{ color: p.color, fontSize: `${0.75 + p.scale * 0.75}em` }}>
              <div className="score-popup-text">{p.text}</div>
              {p.sub && (
                <div className="score-popup-sub" style={{ borderColor: p.color, color: p.color }}>
                  {p.sub}
                </div>
              )}
            </div>
          </Html>
        );
      })}
    </group>
  );
};