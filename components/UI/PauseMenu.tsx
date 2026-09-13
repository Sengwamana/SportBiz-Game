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
  Activity,
  Megaphone,
  MegaphoneOff
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
    toggleMute,
    announcerEnabled,
    toggleAnnouncer
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
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 scanlines anim-float-in"
    >
      <div
        id="pause-menu-modal"
        className="scanlines relative w-full max-w-md border border-orange-500/30 p-6 sm:p-7 bg-gradient-to-b from-[#0f1638]/96 to-[#060914]/99 shadow-[0_0_70px_rgba(255,120,30,0.25)] flex flex-col gap-5 overflow-hidden anim-panel-pop"
        style={{ clipPath: 'polygon(20px 0, 100% 0, 100% calc(100% - 20px), calc(100% - 20px) 100%, 0 100%, 0 20px)' }}
      >
        {/* Stadium court glow */}
        <div className="absolute -top-20 -right-20 w-52 h-52 bg-orange-600/25 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-52 h-52 bg-blue-600/30 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex flex-col items-center text-center relative">
          <div className="flex items-center gap-2 px-3.5 py-1 rounded-full bg-orange-500/15 border border-orange-500/40 text-orange-300 text-[10px] font-cyber font-bold uppercase tracking-[0.3em] mb-2">
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-ping" />
            Official Timeout
          </div>
          <h2 className="font-athletic text-4xl sm:text-5xl font-black tracking-[0.1em] text-white glow-orange">
            MATCH PAUSED
          </h2>
          <p className="text-[11px] sm:text-xs text-slate-400 font-medium tracking-wide">
            Take a breather, tune the arena acoustics, and get back on court.
          </p>
        </div>

        {/* Match stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 border border-white/10 bg-black/40 relative">
          <div className="flex flex-col items-center p-2 bg-white/5 panel-angle">
            <div className="flex items-center gap-1 text-[9px] font-cyber font-bold text-slate-400 uppercase tracking-[0.2em]">
              <Trophy size={11} className="text-amber-400" /> Score
            </div>
            <div className="font-athletic text-2xl font-bold text-amber-300 mt-0.5 score-ticker">{score.toLocaleString()}</div>
          </div>
          <div className="flex flex-col items-center p-2 bg-white/5 panel-angle">
            <div className="flex items-center gap-1 text-[9px] font-cyber font-bold text-slate-400 uppercase tracking-[0.2em]">
              <Activity size={11} className="text-blue-400" /> Quarter
            </div>
            <div className="font-athletic text-2xl font-bold text-blue-300 mt-0.5">Q{level}</div>
          </div>
          <div className="flex flex-col items-center p-2 bg-white/5 panel-angle">
            <div className="flex items-center gap-1 text-[9px] font-cyber font-bold text-slate-400 uppercase tracking-[0.2em]">
              <Zap size={11} className="text-orange-400" /> Handles
            </div>
            <div className="font-athletic text-2xl font-bold text-orange-300 mt-0.5">{dribbleMultiplier}X</div>
          </div>
          <div className="flex flex-col items-center p-2 bg-white/5 panel-angle">
            <div className="flex items-center gap-1 text-[9px] font-cyber font-bold text-slate-400 uppercase tracking-[0.2em]">
              <Flame size={11} className="text-red-400" /> Dunks
            </div>
            <div className="font-athletic text-2xl font-bold text-red-300 mt-0.5">{dunkStreak}</div>
          </div>
        </div>

        {/* Volume */}
        <div className="flex flex-col gap-2 p-4 border border-white/10 bg-black/40 relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                id="pause-menu-mute-toggle"
                onClick={toggleMute}
                aria-label={isMuted ? 'Unmute Audio' : 'Mute Audio'}
                className="p-1.5 panel-angle bg-white/10 hover:bg-white/20 transition-colors"
              >
                {getVolumeIcon()}
              </button>
              <span className="text-[10px] font-cyber font-bold uppercase tracking-[0.22em] text-slate-300">
                Stadium Acoustics
              </span>
            </div>
            <span className="font-athletic text-lg font-bold text-amber-300 score-ticker">
              {isMuted ? 'MUTED' : `${Math.round(masterVolume * 100)}%`}
            </span>
          </div>
          <input
            id="pause-menu-volume-slider"
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={isMuted ? 0 : masterVolume}
            onChange={handleVolumeChange}
            aria-label="Master Volume Slider"
            className="game-slider w-full cursor-pointer"
          />
          <button
            id="pause-menu-announcer-toggle"
            onClick={() => { audio.playClick(); toggleAnnouncer(); }}
            className="flex items-center justify-center gap-2 mt-1 w-full py-2 panel-angle bg-white/5 hover:bg-white/10 transition-colors text-[10px] font-cyber font-bold uppercase tracking-[0.25em]"
          >
            {announcerEnabled ? (
              <><Megaphone size={14} className="text-amber-300" /> Announcer: ON</>
            ) : (
              <><MegaphoneOff size={14} className="text-slate-500" /> Announcer: OFF</>
            )}
          </button>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2.5 relative">
          <button
            id="pause-menu-resume-btn"
            onClick={handleResume}
            className="btn-game btn-primary w-full py-3.5 text-2xl font-black flex items-center justify-center tracking-[0.12em]"
          >
            <Play size={20} className="fill-current mr-2" /> Resume Match
            <span className="btn-shine" />
          </button>
          <button
            id="pause-menu-restart-btn"
            onClick={handleRestart}
            className="btn-game btn-secondary w-full py-3 text-lg font-black flex items-center justify-center tracking-[0.12em]"
          >
            <RotateCcw size={17} className="mr-2" /> Restart Session
          </button>
          <button
            id="pause-menu-main-menu-btn"
            onClick={handleMainMenu}
            className="btn-game btn-ghost w-full py-2 text-xs font-black flex items-center justify-center tracking-[0.2em]"
          >
            <Home size={14} className="mr-1.5" /> Quit to Main Menu
          </button>
        </div>

        {/* Hint */}
        <div className="text-center text-[11px] font-semibold text-slate-500 tracking-wide relative">
          Press <span className="keycap">ESC</span> or <span className="keycap">P</span> to quickly resume
        </div>
      </div>
    </div>
  );
};