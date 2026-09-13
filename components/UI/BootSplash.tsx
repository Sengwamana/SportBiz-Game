/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';

/**
 * BootSplash
 * Brief cinematic engine-start splash shown on every page load, then fades out to
 * reveal the live 3D arena menu. Pure DOM overlay (skip button included) so it stays
 * cheap and never blocks the WebGL boot.
 */
export const BootSplash: React.FC = () => {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFading(true), 1900);
    const killTimer = setTimeout(() => setVisible(false), 2450);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(killTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      id="boot-splash"
      onClick={() => setVisible(false)}
      className={`boot-splash fixed inset-0 z-[300] flex flex-col items-center justify-center select-none cursor-pointer ${
        fading ? 'boot-splash-fade' : ''
      }`}
    >
      {/* Stadium floodlight beams */}
      <div className="boot-beam boot-beam-l" />
      <div className="boot-beam boot-beam-r" />

      {/* Logo */}
      <div className="flex flex-col items-center anim-panel-pop">
        <div className="text-[11px] md:text-xs font-cyber font-bold tracking-[0.45em] uppercase text-orange-300/90 mb-3">
          DayLight Arena Championship
        </div>
        <h1 className="boot-logo font-athletic font-black tracking-[0.08em] text-white">
          SLAM <span className="glow-orange text-orange-400">RUNNER</span>
        </h1>
        <div className="mt-2 flex items-center gap-2 text-3xl md:text-4xl">
          <span className="filter drop-shadow-[0_0_14px_rgba(255,120,30,0.8)]">🏀</span>
          <span className="text-orange-500 text-2xl anim-blink">●</span>
        </div>
      </div>

      {/* Engine boot bar */}
      <div className="mt-8 w-[min(320px,70vw)] h-1 bg-white/10 overflow-hidden">
        <div className="boot-bar" />
      </div>

      {/* Feature strips */}
      <div className="mt-6 flex items-center gap-4 text-[10px] md:text-xs font-cyber font-bold tracking-[0.3em] uppercase text-slate-400">
        <span className="flex items-center gap-1.5">🏀 Dribble</span>
        <span className="text-slate-600">•</span>
        <span className="flex items-center gap-1.5">🛡️ Dodge</span>
        <span className="text-slate-600">•</span>
        <span className="flex items-center gap-1.5">🔥 Slam Dunk</span>
      </div>

      <div className="mt-10 absolute bottom-8 text-center text-[9px] font-mono text-slate-600 tracking-widest">
        click anywhere to skip • court prep in progress
      </div>
    </div>
  );
};