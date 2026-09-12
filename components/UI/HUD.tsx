/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect } from 'react';
import { Heart, Zap, Trophy, Flame, Play, Pause, ArrowUpCircle, Activity, PlusCircle, Shield, RotateCcw, Sparkles, Volume2, VolumeX } from 'lucide-react';
import { useStore } from '../../store';
import { GameStatus, GEMINI_COLORS, ShopItem, RUN_SPEED_BASE, BASKET_TARGET } from '../../types';
import { audio } from '../System/Audio';
import { ambientAudio } from '../System/AmbientAudio';
import { crowdAudioController } from '../System/CrowdAudioController';
import { ScoreMultiplierBadge } from './ScoreMultiplierBadge';
import { PauseMenu } from './PauseMenu';

// Basketball Pro Locker Room Items
const SHOP_ITEMS: ShopItem[] = [
  {
    id: 'DOUBLE_JUMP',
    name: 'AIR SNEAKERS',
    description: 'Jump again in mid-air to execute high-flying dunks over defenders.',
    cost: 1000,
    icon: ArrowUpCircle,
    oneTime: true
  },
  {
    id: 'MAX_LIFE',
    name: 'STAMINA BOOST',
    description: 'Energy hydration drink that permanently adds a stamina heart.',
    cost: 1500,
    icon: Activity
  },
  {
    id: 'HEAL',
    name: 'ICE & RECOVERY',
    description: 'Trainer care package that restores 1 stamina heart instantly.',
    cost: 1000,
    icon: PlusCircle
  },
  {
    id: 'IMMORTAL',
    name: "ON-FIRE MODE",
    description: "Unlock 'He's On Fire!': Press Space or tap to blaze through obstacles for 5s.",
    cost: 3000,
    icon: Flame,
    oneTime: true
  }
];

const ShopScreen: React.FC = () => {
  const { score, buyItem, closeShop, hasDoubleJump, hasImmortality } = useStore();
  const [items, setItems] = useState<ShopItem[]>([]);

  useEffect(() => {
    let pool = SHOP_ITEMS.filter(item => {
      if (item.id === 'DOUBLE_JUMP' && hasDoubleJump) return false;
      if (item.id === 'IMMORTAL' && hasImmortality) return false;
      return true;
    });

    pool = pool.sort(() => 0.5 - Math.random());
    setItems(pool.slice(0, 3));
  }, [hasDoubleJump, hasImmortality]);

  return (
    <div className="absolute inset-0 bg-slate-900/60 z-[100] text-slate-900 pointer-events-auto backdrop-blur-md overflow-y-auto flex items-center justify-center p-4">
      <div className="bg-white/95 border-2 border-orange-500/40 rounded-3xl p-6 md:p-8 max-w-4xl w-full shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="text-center mb-6">
          <div className="inline-flex items-center space-x-2 bg-orange-100 text-orange-700 px-4 py-1.5 rounded-full text-xs md:text-sm font-bold tracking-wider mb-2">
            <Flame className="w-4 h-4 text-orange-600 fill-orange-500" />
            <span>HALF-TIME GEAR UP</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-black text-slate-900 font-athletic tracking-wide">
            PRO LOCKER ROOM
          </h2>
          <div className="flex items-center justify-center text-slate-600 font-semibold mt-2">
            <span className="text-sm md:text-base mr-2">AVAILABLE MATCH POINTS:</span>
            <span className="text-xl md:text-2xl font-black text-orange-600 font-mono">
              {score.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-8">
          {items.map(item => {
            const Icon = item.icon;
            const canAfford = score >= item.cost;
            return (
              <div
                key={item.id}
                className="bg-slate-50 border-2 border-slate-200 hover:border-orange-500 p-5 rounded-2xl flex flex-col items-center text-center transition-all shadow-sm hover:shadow-md"
              >
                <div className="bg-orange-100 p-3.5 rounded-2xl mb-3 text-orange-600">
                  <Icon className="w-7 h-7" />
                </div>
                <h3 className="text-lg md:text-xl font-black text-slate-900 font-athletic mb-1">
                  {item.name}
                </h3>
                <p className="text-slate-600 text-xs md:text-sm mb-4 h-12 flex items-center justify-center leading-relaxed">
                  {item.description}
                </p>
                <button
                  onClick={() => buyItem(item.id as any, item.cost)}
                  disabled={!canAfford}
                  className={`px-4 py-2.5 rounded-xl font-bold w-full text-sm md:text-base transition-all shadow-sm ${
                    canAfford
                      ? 'bg-orange-600 hover:bg-orange-700 text-white hover:scale-[1.02] active:scale-[0.98]'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  {item.cost.toLocaleString()} PTS
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex justify-center">
          <button
            onClick={closeShop}
            className="flex items-center px-8 md:px-12 py-3.5 bg-blue-900 hover:bg-blue-800 text-white font-black text-lg md:text-xl rounded-2xl hover:scale-105 transition-all shadow-lg hover:shadow-blue-900/30"
          >
            BACK TO COURT <Play className="ml-2 w-5 h-5 fill-white" />
          </button>
        </div>
      </div>
    </div>
  );
};

export const HUD: React.FC = () => {
  const {
    score,
    lives,
    maxLives,
    collectedLetters,
    status,
    level,
    restartGame,
    startGame,
    gemsCollected,
    distance,
    isImmortalityActive,
    speed,
    isDunkSlowMo,
    dunkStreak,
    hoopTension,
    dribbleStreak,
    dribbleMultiplier,
    pauseGame,
    resumeGame,
    isMuted,
    toggleMute
  } = useStore();

  const [dunkAlert, setDunkAlert] = useState<{ text: string; points: number; multiplier?: number; id: number } | null>(null);

  // Global Keyboard shortcut for Pause (ESC / P)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key.toLowerCase() === 'p') {
        if (status === GameStatus.PLAYING) {
          pauseGame();
        } else if (status === GameStatus.PAUSED) {
          resumeGame();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [status, pauseGame, resumeGame]);

  // Listen for successful dunks to show broadcast popups with active multiplier
  useEffect(() => {
    let timer: NodeJS.Timeout;
    const handleDunk = (e: any) => {
      const currentMult = useStore.getState().dribbleMultiplier;
      const basePts = e.detail?.points || 300;
      setDunkAlert({
        text: e.detail?.text || 'SLAM DUNK!',
        points: basePts * currentMult,
        multiplier: currentMult,
        id: Date.now()
      });
      clearTimeout(timer);
      timer = setTimeout(() => {
        setDunkAlert(null);
      }, 1300);
    };

    window.addEventListener('dunk-success', handleDunk);
    return () => {
      window.removeEventListener('dunk-success', handleDunk);
      clearTimeout(timer);
    };
  }, []);

  const handleAudioToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleMute();
  };

  const target = BASKET_TARGET; // ['B', 'A', 'S', 'K', 'E', 'T']

  if (status === GameStatus.SHOP) {
    return <ShopScreen />;
  }

  // --- MENU SCREEN (LIGHT MODE BASKETBALL GAMING INTRO) ---
  if (status === GameStatus.MENU) {
    return (
      <div className="absolute inset-0 flex items-center justify-center z-[100] bg-slate-900/50 backdrop-blur-sm p-4 pointer-events-auto">
        <div className="relative w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-500 text-slate-900">
          {/* Top Court Banner Header */}
          <div className="relative w-full bg-gradient-to-br from-orange-500 via-orange-600 to-blue-900 p-8 text-center text-white overflow-hidden">
            {/* Background court circle line pattern */}
            <div className="absolute -top-12 -right-12 w-48 h-48 border-4 border-white/15 rounded-full pointer-events-none"></div>
            <div className="absolute -bottom-16 -left-16 w-56 h-56 border-4 border-white/15 rounded-full pointer-events-none"></div>

            {/* Audio Toggle in Menu */}
            <button
              id="menu-audio-toggle"
              onClick={handleAudioToggle}
              className="absolute top-4 right-4 z-20 bg-white/20 hover:bg-white/30 backdrop-blur-md p-2 rounded-xl text-white transition-all"
              title={isMuted ? "Unmute Arena Sounds" : "Mute Arena Sounds"}
              aria-label={isMuted ? "Unmute Arena Sounds" : "Mute Arena Sounds"}
            >
              {isMuted ? <VolumeX className="w-5 h-5 text-orange-200" /> : <Volume2 className="w-5 h-5 text-white" />}
            </button>

            <div className="relative z-10 flex flex-col items-center">
              <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-3 shadow-inner">
                <span className="text-3xl">🏀</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-black tracking-wider font-athletic text-white drop-shadow-md">
                SLAM RUNNER
              </h1>
              <p className="text-orange-100 text-sm font-semibold mt-1 tracking-wide">
                DAYLIGHT BASKETBALL ARENA
              </p>
            </div>
          </div>

          {/* Body Content */}
          <div className="p-6 md:p-8 flex flex-col items-center">
            {/* Objective badges */}
            <div className="grid grid-cols-3 gap-2 w-full mb-6">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                <span className="text-xl">🏀</span>
                <p className="text-[11px] font-bold text-slate-600 mt-1 uppercase">Dribble</p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                <span className="text-xl">🛡️</span>
                <p className="text-[11px] font-bold text-slate-600 mt-1 uppercase">Dodge</p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                <span className="text-xl">🔥</span>
                <p className="text-[11px] font-bold text-slate-600 mt-1 uppercase">Slam Dunk</p>
              </div>
            </div>

            {/* Main Action Button */}
            <button
              onClick={() => {
                audio.init();
                ambientAudio.startAmbience();
                startGame();
              }}
              className="w-full group relative py-4 px-6 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-black text-xl rounded-2xl transition-all shadow-lg shadow-orange-500/30 hover:scale-[1.02] active:scale-[0.98] overflow-hidden"
            >
              <span className="relative z-10 font-athletic tracking-widest flex items-center justify-center text-2xl">
                TIP-OFF MATCH <Play className="ml-2 w-6 h-6 fill-white" />
              </span>
            </button>

            {/* Controls Guide */}
            <div className="mt-5 text-center">
              <p className="text-slate-500 text-xs font-bold tracking-wider uppercase">
                [ ← → / SWIPE TO DRIBBLE • ↑ / SWIPE UP TO DUNK ]
              </p>
              <p className="text-slate-400 text-[11px] mt-1">
                Collect B-A-S-K-E-T letters to advance quarters!
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- GAME OVER SCREEN (LIGHT MODE STADIUM SCOREBOARD) ---
  if (status === GameStatus.GAME_OVER) {
    return (
      <div className="absolute inset-0 bg-slate-900/65 z-[100] text-slate-900 pointer-events-auto backdrop-blur-md overflow-y-auto flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl border-2 border-red-200 text-center animate-in zoom-in-95 duration-300">
          <div className="inline-flex items-center space-x-1.5 bg-red-100 text-red-700 px-4 py-1 rounded-full text-xs font-bold tracking-wider mb-2">
            <span>FINAL BUZZER</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-slate-900 font-athletic tracking-wide mb-6">
            GAME OVER
          </h1>

          <div className="grid grid-cols-1 gap-2.5 mb-6 text-left">
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-center justify-between">
              <div className="flex items-center text-slate-700 font-bold text-sm">
                <Trophy className="mr-2 w-4 h-4 text-amber-500" /> QUARTER REACHED
              </div>
              <div className="text-lg font-black font-mono text-slate-900">{level} / 3</div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-center justify-between">
              <div className="flex items-center text-slate-700 font-bold text-sm">
                <span className="mr-2 text-base">🏀</span> BASKETBALLS COLLECTED
              </div>
              <div className="text-lg font-black font-mono text-orange-600">{gemsCollected}</div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-center justify-between">
              <div className="flex items-center text-slate-700 font-bold text-sm">
                <Zap className="mr-2 w-4 h-4 text-blue-600" /> COURT DISTANCE
              </div>
              <div className="text-lg font-black font-mono text-slate-900">{Math.floor(distance)} YDS</div>
            </div>

            <div className="bg-orange-50 border border-orange-200 p-4 rounded-xl flex items-center justify-between mt-1">
              <div className="font-bold text-slate-800 text-sm">FINAL SCORE</div>
              <div className="text-2xl md:text-3xl font-black text-orange-600 font-mono">
                {score.toLocaleString()}
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              audio.init();
              ambientAudio.startAmbience();
              restartGame();
            }}
            className="w-full py-3.5 px-6 bg-orange-600 hover:bg-orange-700 text-white font-black text-lg md:text-xl rounded-2xl transition-all shadow-lg hover:shadow-orange-600/30 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center font-athletic tracking-wider"
          >
            <RotateCcw className="mr-2 w-5 h-5" /> PLAY AGAIN / REMATCH
          </button>
        </div>
      </div>
    );
  }

  // --- VICTORY SCREEN (CHAMPIONSHIP TROPHY) ---
  if (status === GameStatus.VICTORY) {
    return (
      <div className="absolute inset-0 bg-slate-900/60 z-[100] text-slate-900 pointer-events-auto backdrop-blur-md overflow-y-auto flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl border-2 border-amber-300 text-center animate-in zoom-in-95 duration-400">
          <div className="w-20 h-20 bg-amber-100 rounded-3xl mx-auto flex items-center justify-center mb-4 text-4xl shadow-inner border border-amber-200 animate-bounce">
            🏆
          </div>
          <h1 className="text-4xl md:text-6xl font-black text-slate-900 font-athletic tracking-wide mb-1">
            CHAMPIONSHIP VICTORY!
          </h1>
          <p className="text-orange-600 font-bold text-sm md:text-base tracking-wider mb-6 uppercase">
            MVP PERFORMANCE — YOU CONQUERED THE COURT!
          </p>

          <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl mb-6">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">CHAMPIONSHIP SCORE</div>
            <div className="text-3xl md:text-4xl font-black text-orange-600 font-mono">
              {score.toLocaleString()}
            </div>
            <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-200 text-left">
              <div>
                <span className="text-[11px] font-bold text-slate-500 uppercase block">Basketballs</span>
                <span className="text-xl font-black text-slate-900 font-mono">{gemsCollected}</span>
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-500 uppercase block">Total Distance</span>
                <span className="text-xl font-black text-slate-900 font-mono">{Math.floor(distance)} YDS</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              audio.init();
              ambientAudio.startAmbience();
              restartGame();
            }}
            className="w-full py-4 px-8 bg-blue-900 hover:bg-blue-800 text-white font-black text-xl rounded-2xl transition-all shadow-lg hover:shadow-blue-900/30 hover:scale-105 font-athletic tracking-wider"
          >
            START NEW TOURNAMENT
          </button>
        </div>
      </div>
    );
  }

  // --- LIVE IN-GAME ATHLETIC BROADCAST HUD (LIGHT MODE) ---
  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-3 md:p-6 z-50">
      {/* Top Bar: Scoreboard, Quarter, Stamina & Audio Control */}
      <div className="flex justify-between items-start w-full">
        {/* Left: Scoreboard & Dunk Streak */}
        <div className="flex flex-col items-start space-y-1.5">
          <div className="bg-white/90 backdrop-blur-md px-4 py-2.5 rounded-2xl shadow-lg border border-slate-200/80 flex items-center space-x-2.5">
            <span className="text-2xl">🏀</span>
            <div>
              <div className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-wider leading-none">
                POINTS
              </div>
              <div className="text-2xl md:text-4xl font-black text-slate-900 font-mono leading-none mt-0.5">
                {score.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Dunk Streak Badge (modulates crowd cheering volume) */}
          {dunkStreak > 0 && (
            <div className="bg-gradient-to-r from-orange-600 via-amber-500 to-red-600 text-white px-3 py-1 rounded-xl shadow-lg border border-white/60 flex items-center space-x-1.5 animate-pulse">
              <Flame className="w-3.5 h-3.5 fill-white text-white" />
              <span className="font-athletic text-xs md:text-sm font-black tracking-wider">
                DUNK STREAK {dunkStreak}X
              </span>
              <span className="text-[10px] font-mono font-bold bg-black/20 px-1.5 py-0.5 rounded text-amber-100">
                {dunkStreak >= 3 ? 'CROWD ROARING' : dunkStreak >= 2 ? 'HEATING UP' : 'CROWD HYPED'}
              </span>
            </div>
          )}
        </div>

        {/* Center: Quarter / Round Indicator */}
        <div className="bg-white/90 backdrop-blur-md px-4 py-1.5 rounded-full shadow-md border border-slate-200/80 flex items-center space-x-1 text-slate-800 font-athletic text-sm md:text-base tracking-wider">
          <span className="text-orange-600 font-black">QUARTER</span>
          <span className="text-slate-900 font-black">{level}</span>
          <span className="text-slate-400 text-xs">/ 3</span>
        </div>

        {/* Right: Stamina Hearts & Arena Audio Button */}
        <div className="flex items-center space-x-2">
          <div className="bg-white/90 backdrop-blur-md px-3.5 py-2.5 rounded-2xl shadow-lg border border-slate-200/80 flex items-center space-x-1.5">
            {[...Array(maxLives)].map((_, i) => (
              <Heart
                key={i}
                className={`w-6 h-6 md:w-7 md:h-7 transition-colors ${
                  i < lives
                    ? 'text-red-500 fill-red-500 drop-shadow-sm'
                    : 'text-slate-200 fill-slate-200'
                }`}
              />
            ))}
          </div>

          <button
            id="hud-arena-audio-btn"
            onClick={toggleAudio}
            className="pointer-events-auto bg-white/90 hover:bg-white backdrop-blur-md p-2.5 rounded-2xl shadow-lg border border-slate-200/80 text-slate-700 hover:text-orange-600 transition-all active:scale-95 flex items-center justify-center"
            title={isMuted ? "Unmute Arena Sound" : "Mute Arena Sound"}
            aria-label={isMuted ? "Unmute Arena Sound" : "Mute Arena Sound"}
          >
            {isMuted ? (
              <VolumeX className="w-5 h-5 text-slate-400" />
            ) : (
              <Volume2 className="w-5 h-5 text-orange-600" />
            )}
          </button>
        </div>
      </div>

      {/* Active Skill "ON FIRE!" Indicator */}
      {isImmortalityActive && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 text-white font-black text-lg md:text-2xl px-6 py-1.5 rounded-full shadow-xl flex items-center space-x-2 animate-bounce">
          <Flame className="w-6 h-6 fill-white" />
          <span className="font-athletic tracking-widest">HE'S ON FIRE!</span>
          <Sparkles className="w-5 h-5 fill-white" />
        </div>
      )}

      {/* B-A-S-K-E-T Letter Collector Row */}
      <div className="absolute top-16 md:top-20 left-1/2 transform -translate-x-1/2 flex flex-col items-center">
        <div className="flex space-x-1.5 md:space-x-2.5">
          {target.map((char, idx) => {
            const isCollected = collectedLetters.includes(idx);
            const color = GEMINI_COLORS[idx];

            return (
              <div
                key={idx}
                style={{
                  borderColor: isCollected ? color : '#e2e8f0',
                  backgroundColor: isCollected ? color : 'rgba(255, 255, 255, 0.85)',
                  color: isCollected ? '#ffffff' : '#94a3b8',
                  boxShadow: isCollected ? `0 4px 14px ${color}66` : '0 2px 4px rgba(0,0,0,0.05)'
                }}
                className="w-9 h-11 md:w-12 md:h-14 flex items-center justify-center border-2 font-black text-xl md:text-2xl font-athletic rounded-xl transform transition-all duration-300 backdrop-blur-sm"
              >
                {char}
              </div>
            );
          })}
        </div>

        {/* Dynamic Hoop Approach Crowd Tension Indicator */}
        {hoopTension > 0.05 && (
          <div className="mt-2 flex flex-col items-center animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900/85 backdrop-blur-md text-amber-300 border border-amber-500/40 px-3 py-0.5 rounded-full text-[10px] md:text-xs font-mono font-bold tracking-wider uppercase flex items-center space-x-1.5 shadow-md">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span>CROWD TENSION</span>
              <span className="text-white font-bold">{Math.round(hoopTension * 100)}%</span>
            </div>
            <div className="w-32 md:w-44 h-1.5 bg-slate-800/80 rounded-full mt-1 overflow-hidden border border-slate-700/60 shadow-inner">
              <div
                className="h-full bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 transition-all duration-75"
                style={{ width: `${Math.round(hoopTension * 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Bottom Right: Court Pace / Speed Meter */}
      <div className="w-full flex justify-end items-end">
        <div className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-2xl shadow-md border border-slate-200/80 flex items-center space-x-2 text-slate-800">
          <Zap className="w-4 h-4 md:w-5 md:h-5 text-orange-600" />
          <span className="font-athletic text-sm md:text-lg tracking-wider font-bold">
            PACE {Math.round((speed / RUN_SPEED_BASE) * 100)}%
          </span>
        </div>
      </div>

      {/* Dynamic Slam Dunk Broadcast Popup */}
      {dunkAlert && (
        <div
          key={dunkAlert.id}
          className="absolute top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none flex flex-col items-center justify-center animate-in zoom-in-75 fade-in duration-150 z-30"
        >
          <div className="bg-gradient-to-r from-orange-600 via-amber-500 to-orange-600 text-white font-black text-2xl md:text-5xl px-7 py-3 rounded-2xl shadow-2xl border-2 border-white flex items-center space-x-3 tracking-widest font-athletic rotate-[-2deg]">
            <span>🏀</span>
            <span>{dunkAlert.text}</span>
            <span>🔥</span>
          </div>
          <div className="mt-2 bg-white/95 text-orange-600 font-mono font-black text-lg md:text-2xl px-5 py-1 rounded-full shadow-lg border border-orange-300 tracking-wider">
            +{dunkAlert.points} PTS
          </div>
        </div>
      )}

      {/* Cinematic Slow-Motion Letterboxing & Sideline Broadcast Banner */}
      <div
        className={`fixed inset-x-0 top-0 pointer-events-none z-50 transition-all duration-300 ease-out ${
          isDunkSlowMo ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full'
        }`}
      >
        <div className="bg-gradient-to-b from-black/90 via-black/80 to-transparent h-12 md:h-16 px-4 md:px-8 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600"></span>
            </span>
            <span className="text-white font-mono text-xs md:text-sm font-black tracking-widest uppercase drop-shadow">
              SLAM CAM // SIDE-PROFILE REPLAY
            </span>
          </div>
          <div className="bg-red-600/90 text-white font-mono text-[11px] md:text-xs font-bold px-3 py-1 rounded-full tracking-wider shadow-inner">
            ● 0.2X SLOW-MO
          </div>
        </div>
      </div>

      <div
        className={`fixed inset-x-0 bottom-0 pointer-events-none z-50 transition-all duration-300 ease-out ${
          isDunkSlowMo ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-full'
        }`}
      >
        <div className="bg-gradient-to-t from-black/90 via-black/80 to-transparent h-12 md:h-16 px-4 md:px-8 flex items-center justify-between text-slate-300 font-mono text-[11px] md:text-xs tracking-widest">
          <span>HIGH-FLYING RIM JAM</span>
          <span className="text-amber-400 font-bold">MONSTER FINISH</span>
        </div>
      </div>
    </div>
  );
};
