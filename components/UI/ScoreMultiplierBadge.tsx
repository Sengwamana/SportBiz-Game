import { useShallow } from 'zustand/react/shallow';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { useStore, calculateDribbleMultiplier } from '../../store';
import { Flame, Zap, Sparkles, TrendingUp } from 'lucide-react';

interface TierConfig {
  name: string;
  borderColor: string;
  glowStyle: string;
  textColor: string;
  badgeBg: string;
  accentColor: string;
  flameLevel: number;
}

export const ScoreMultiplierBadge: React.FC = () => {
  const { dribbleStreak, dribbleMultiplier, status, lastDribbleTime, resetDribbleStreak } = useStore(useShallow(state => ({
    dribbleStreak: state.dribbleStreak,
    dribbleMultiplier: state.dribbleMultiplier,
    status: state.status,
    lastDribbleTime: state.lastDribbleTime,
    resetDribbleStreak: state.resetDribbleStreak,
  })));
  const [pulse, setPulse] = useState(false);
  const [recentBounce, setRecentBounce] = useState(false);
  const [drain, setDrain] = useState(1);
  const [overdue, setOverdue] = useState(false);

  // Combo grace timer: combo drains and resets if the player stops dribbling
  useEffect(() => {
    if ((status !== 'PLAYING' && status !== 'PAUSED') || dribbleStreak <= 0) {
      setDrain(1);
      setOverdue(false);
      return;
    }
    const id = setInterval(() => {
      const elapsed = Date.now() - lastDribbleTime;
      const ratio = 1 - elapsed / 1500;
      setDrain(Math.max(0, Math.min(1, ratio)));
      setOverdue(elapsed >= 1200);
      if (elapsed >= 1500) {
        resetDribbleStreak();
      }
    }, 120);
    return () => clearInterval(id);
  }, [status, dribbleStreak, lastDribbleTime, resetDribbleStreak]);

  // Trigger pulse whenever dribble streak increments or on floor bounce
  useEffect(() => {
    if (dribbleStreak > 0) {
      setPulse(true);
      const timer = setTimeout(() => setPulse(false), 220);
      return () => clearTimeout(timer);
    }
  }, [dribbleStreak]);

  useEffect(() => {
    const handleBounce = () => {
      setRecentBounce(true);
      const timer = setTimeout(() => setRecentBounce(false), 160);
      return () => clearTimeout(timer);
    };
    window.addEventListener('dribble-impact', handleBounce);
    return () => window.removeEventListener('dribble-impact', handleBounce);
  }, []);

  // Calculate next tier threshold
  const getTierProgress = (streak: number) => {
    if (streak < 5) return { current: streak, target: 5, pct: (streak / 5) * 100 };
    if (streak < 10) return { current: streak - 5, target: 5, pct: ((streak - 5) / 5) * 100 };
    if (streak < 16) return { current: streak - 10, target: 6, pct: ((streak - 10) / 6) * 100 };
    if (streak < 24) return { current: streak - 16, target: 8, pct: ((streak - 16) / 8) * 100 };
    if (streak < 35) return { current: streak - 24, target: 11, pct: ((streak - 24) / 11) * 100 };
    if (streak < 50) return { current: streak - 35, target: 15, pct: ((streak - 35) / 15) * 100 };
    return { current: streak, target: streak, pct: 100 };
  };

  const progress = getTierProgress(dribbleStreak);

  // Tier visual attributes
  const getTierConfig = (mult: number): TierConfig => {
    switch (mult) {
      case 2:
        return {
          name: 'HOT HANDLES',
          borderColor: 'border-amber-400',
          glowStyle: 'shadow-[0_0_24px_rgba(245,158,11,0.55)]',
          textColor: 'text-amber-400',
          badgeBg: 'bg-amber-500/20',
          accentColor: '#f59e0b',
          flameLevel: 1,
        };
      case 3:
        return {
          name: 'CROSSOVER KING',
          borderColor: 'border-orange-500',
          glowStyle: 'shadow-[0_0_36px_rgba(234,88,12,0.75)]',
          textColor: 'text-orange-400',
          badgeBg: 'bg-orange-500/25',
          accentColor: '#ea580c',
          flameLevel: 2,
        };
      case 4:
        return {
          name: 'ANKLE BREAKER',
          borderColor: 'border-red-500',
          glowStyle: 'shadow-[0_0_48px_rgba(239,68,68,0.85)]',
          textColor: 'text-red-400',
          badgeBg: 'bg-red-500/25',
          accentColor: '#ef4444',
          flameLevel: 3,
        };
      case 5:
        return {
          name: 'ON FIRE!',
          borderColor: 'border-yellow-400',
          glowStyle: 'shadow-[0_0_60px_rgba(250,204,21,0.95)]',
          textColor: 'text-yellow-300',
          badgeBg: 'bg-yellow-500/30',
          accentColor: '#facc15',
          flameLevel: 4,
        };
      case 6:
      case 7:
        return {
          name: 'UNSTOPPABLE',
          borderColor: 'border-amber-300',
          glowStyle: 'shadow-[0_0_75px_rgba(245,158,11,1.0)]',
          textColor: 'text-amber-200',
          badgeBg: 'bg-amber-500/35',
          accentColor: '#fbbf24',
          flameLevel: 5,
        };
      default:
        return {
          name: 'SUPREME LEGEND',
          borderColor: 'border-white',
          glowStyle: 'shadow-[0_0_90px_rgba(255,255,255,0.95)]',
          textColor: 'text-white',
          badgeBg: 'bg-white/20',
          accentColor: '#ffffff',
          flameLevel: 6,
        };
    }
  };

  // Only render during active play and when multiplier is active (streak >= 5)
  // Or show a subtle buildup indicator when streak >= 3 to guide player
  const isVisible = (status === 'PLAYING' || status === 'PAUSED') && dribbleStreak >= 4;
  if (!isVisible) return null;

  const config = getTierConfig(dribbleMultiplier);

  return (
    <div
      id="score-multiplier-container"
      className={`relative transition-all duration-300 transform ${
        pulse ? 'scale-105' : recentBounce ? 'scale-102' : 'scale-100'
      }`}
    >
      {/* Outer Radiant Heat Aura Glow */}
      <div
        className={`absolute -inset-1 blur-md opacity-75 transition-all duration-500 ${
          dribbleMultiplier >= 4 ? 'animate-pulse' : ''
        }`}
        style={{
          backgroundColor: config.accentColor,
          opacity: Math.min(0.85, 0.25 + dribbleMultiplier * 0.12),
          clipPath: 'polygon(14px 0, 100% 0, calc(100% - 14px) 100%, 0 100%)',
        }}
      />

      {/* Main Multiplier Card */}
      <div
        id="score-multiplier-card"
        className={`relative flex items-center gap-3 px-3.5 py-2 bg-gradient-to-b from-[#0f1535]/95 to-[#070b20]/98 border ${config.borderColor} ${config.glowStyle} transition-all duration-300 select-none`}
        style={{ clipPath: 'polygon(14px 0, 100% 0, calc(100% - 14px) 100%, 0 100%)' }}
      >
        {/* Animated Multiplier Number Badge */}
        <div
          className={`flex items-center justify-center min-w-[50px] h-[50px] font-athletic text-3xl font-black ${config.badgeBg} ${config.textColor} border border-white/20 relative overflow-hidden`}
          style={{ clipPath: 'polygon(10px 0, 100% 0, calc(100% - 10px) 100%, 0 100%)' }}
        >
          {/* Subtle diagonal shine effect */}
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/15 to-transparent pointer-events-none" />
          
          <span className="tracking-tighter drop-shadow-md">
            {dribbleMultiplier}X
          </span>

          {/* Flame / Sparkle Indicator */}
          {dribbleMultiplier >= 3 && (
            <Flame
              size={15}
              className={`absolute top-0.5 right-0.5 ${
                dribbleMultiplier >= 5 ? 'text-yellow-300 animate-bounce' : 'text-orange-400'
              }`}
            />
          )}
        </div>

        {/* Combo Details & Streak Bar */}
        <div className="flex flex-col min-w-[130px]">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <Zap size={13} className={config.textColor} />
              <span className={`text-xs font-black tracking-widest uppercase font-cyber ${config.textColor}`}>
                {config.name}
              </span>
            </div>
            <span className="text-[10px] font-bold text-slate-300 bg-white/10 px-1.5 py-0.5 font-mono">
              {dribbleStreak} DRIBBLES
            </span>
          </div>

          {/* Progress bar to next multiplier tier */}
          <div className="w-full mt-1.5">
            <div className="flex justify-between text-[9px] font-semibold text-slate-400 mb-0.5 uppercase tracking-wider">
              <span>{dribbleMultiplier >= 8 ? 'Max Multiplier' : 'Next Multiplier'}</span>
              <span>{dribbleMultiplier >= 8 ? 'MAX' : `${Math.round(progress.pct)}%`}</span>
            </div>
            <div className="meter-bar w-full h-1.5">
              <div
                className="h-full transition-all duration-200"
                style={{
                  width: `${progress.pct}%`,
                  backgroundColor: config.accentColor,
                  boxShadow: `0 0 8px ${config.accentColor}`,
                }}
              />
            </div>
          </div>

          {/* Combo grace drain bar */}
          {lastDribbleTime > 0 && drain < 1 && (
            <div className="mt-1">
              <div className={`flex justify-between text-[9px] font-bold uppercase tracking-wider ${overdue ? 'text-red-400 anim-blink' : 'text-slate-500'}`}>
                <span>Combo</span>
                <span>{overdue ? 'Fading!' : `${Math.round(drain * 100)}%`}</span>
              </div>
              <div className="meter-bar w-full h-1 mt-0.5">
                <div
                  className="h-full transition-all duration-150"
                  style={{
                    width: `${drain * 100}%`,
                    backgroundColor: overdue ? '#ef4444' : config.accentColor,
                    boxShadow: `0 0 6px ${overdue ? '#ef4444' : config.accentColor}`,
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Dynamic Multiplier Perks indicator */}
        <div className="hidden sm:flex flex-col items-center justify-center pl-2 border-l border-white/10 text-[10px] font-bold text-emerald-400">
          <TrendingUp size={14} className="mb-0.5 text-emerald-400" />
          <span className="font-cyber uppercase tracking-widest">Score Boost</span>
        </div>
      </div>
    </div>
  );
};
