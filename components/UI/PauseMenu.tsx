/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useStore } from '../../store';
import { GameStatus } from '../../types';
import { audio } from '../System/Audio';
import {
  Play,
  RotateCcw,
  Home,
  Volume2,
  VolumeX,
  Volume1,
  Trophy,
  Flame,
  Zap,
  Activity
} from 'lucide-react';

export const PauseMenu: React.FC = () => {
  const {
    status,
    resumeGame,
    restartGame,
    setStatus,
    score,
    level,
    distance,
    dunkStreak,
    dribbleMultiplier,
    dribbleStreak,
    masterVolume,
    setMasterVolume,
    isMuted,
    toggleMute
  } = useStore();

  if (status !== GameStatus.PAUSED) return null;

  const handleResume = () => {
    audio.playClick();
    resumeGame();
  };

  const handleRestart = () => {
    audio.playClick();
    restartGame();
  };

  const handleMainMenu = () => {
    audio.playClick();
    setStatus(GameStatus.MENU);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setMasterVolume(val);
  };

  const getVolumeIcon = () => {
    if (isMuted || masterVolume === 0) return <VolumeX size={20} className="text-red-400" />;
    if (masterVolume < 0.5) return <Volume1 size={20} className="text-amber-400" />;
    return <Volume2 size={20} className="text-amber-400" />;
  };

  return (
    <div
      id="pause-menu-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200"
    >
      {/* Semi-transparent Modal Container with Game Colors */}
      <div
        id="pause-menu-modal"
        className="w-full max-w-md rounded-3xl p-6 sm:p-8 bg-slate-900/80 border border-white/15 shadow-[0_0_50px_rgba(234,88,12,0.25)] backdrop-blur-2xl text-white flex flex-col gap-6 relative overflow-hidden"
      >
        {/* Subtle decorative stadium court glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-orange-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />

        {/* Header: Timeout Called / Match Paused */}
        <div className="flex flex-col items-center text-center">
          <div className="flex items-center gap-2 px-3.5 py-1 rounded-full bg-orange-500/15 border border-orange-500/30 text-orange-400 text-xs font-bold uppercase tracking-widest mb-2">
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-ping" />
            Official Timeout
          </div>
          <h2 className="font-athletic text-4xl sm:text-5xl font-black tracking-wider text-white drop-shadow-md">
            MATCH PAUSED
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 font-medium">
            Take a breather, adjust your acoustics, and jump right back on court.
          </p>
        </div>

        {/* Current Match Stats Card */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 rounded-2xl bg-slate-950/60 border border-white/10 text-center">
          {/* Current Score */}
          <div className="flex flex-col items-center p-2 rounded-xl bg-white/5">
            <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              <Trophy size={12} className="text-amber-400" />
              Score
            </div>
            <div className="font-athletic text-2xl font-bold text-amber-400 mt-0.5">
              {score.toLocaleString()}
            </div>
          </div>

          {/* Quarter / Level */}
          <div className="flex flex-col items-center p-2 rounded-xl bg-white/5">
            <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              <Activity size={12} className="text-blue-400" />
              Quarter
            </div>
            <div className="font-athletic text-2xl font-bold text-blue-400 mt-0.5">
              Q{level}
            </div>
          </div>

          {/* Multiplier / Dribble Streak */}
          <div className="flex flex-col items-center p-2 rounded-xl bg-white/5">
            <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              <Zap size={12} className="text-orange-400" />
              Handles
            </div>
            <div className="font-athletic text-2xl font-bold text-orange-400 mt-0.5">
              {dribbleMultiplier}X
            </div>
          </div>

          {/* Dunk Streak */}
          <div className="flex flex-col items-center p-2 rounded-xl bg-white/5">
            <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              <Flame size={12} className="text-red-400" />
              Dunks
            </div>
            <div className="font-athletic text-2xl font-bold text-red-400 mt-0.5">
              {dunkStreak}
            </div>
          </div>
        </div>

        {/* Audio Volume Controller */}
        <div className="flex flex-col gap-2 p-4 rounded-2xl bg-slate-950/60 border border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                id="pause-menu-mute-toggle"
                onClick={toggleMute}
                aria-label={isMuted ? 'Unmute Audio' : 'Mute Audio'}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                {getVolumeIcon()}
              </button>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Stadium Acoustics & Audio
              </span>
            </div>
            <span className="font-athletic text-lg font-bold text-amber-400">
              {isMuted ? 'MUTED' : `${Math.round(masterVolume * 100)}%`}
            </span>
          </div>

          {/* Custom Volume Range Slider */}
          <div className="flex items-center gap-3 mt-1">
            <input
              id="pause-menu-volume-slider"
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : masterVolume}
              onChange={handleVolumeChange}
              aria-label="Master Volume Slider"
              className="w-full h-2 rounded-lg bg-slate-800 appearance-none cursor-pointer accent-orange-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Menu Action Buttons */}
        <div className="flex flex-col gap-3">
          {/* Resume Match */}
          <button
            id="pause-menu-resume-btn"
            onClick={handleResume}
            className="w-full py-3.5 px-6 rounded-2xl font-athletic text-2xl font-bold tracking-wider uppercase text-white bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 active:scale-[0.98] transition-all duration-200 shadow-lg shadow-orange-600/30 flex items-center justify-center gap-2 border border-orange-400/40"
          >
            <Play size={22} className="fill-current" />
            Resume Match
          </button>

          {/* Restart Session (Without Page Reload) */}
          <button
            id="pause-menu-restart-btn"
            onClick={handleRestart}
            className="w-full py-3 px-6 rounded-2xl font-athletic text-xl font-bold tracking-wider uppercase text-slate-200 bg-white/10 hover:bg-white/20 active:scale-[0.98] transition-all duration-200 border border-white/15 flex items-center justify-center gap-2"
          >
            <RotateCcw size={18} />
            Restart Session
          </button>

          {/* Return to Main Menu */}
          <button
            id="pause-menu-main-menu-btn"
            onClick={handleMainMenu}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-bold tracking-wider uppercase text-slate-400 hover:text-white hover:bg-white/5 transition-all duration-200 flex items-center justify-center gap-1.5"
          >
            <Home size={15} />
            Quit to Main Menu
          </button>
        </div>

        {/* Keyboard shortcut reminder */}
        <div className="text-center text-[11px] font-semibold text-slate-400 tracking-wide">
          Tip: Press <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white font-mono text-[10px]">ESC</kbd> or <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white font-mono text-[10px]">P</kbd> to quickly resume or pause
        </div>
      </div>
    </div>
  );
};
