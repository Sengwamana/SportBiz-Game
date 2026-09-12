/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import { create } from 'zustand';
import { GameStatus, RUN_SPEED_BASE, BASKET_TARGET } from './types';
import { audio } from './components/System/Audio';
import { ambientAudio } from './components/System/AmbientAudio';
import { crowdAudioController } from './components/System/CrowdAudioController';

export function calculateDribbleMultiplier(streak: number): number {
  if (streak < 5) return 1;
  if (streak < 10) return 2;
  if (streak < 16) return 3;
  if (streak < 24) return 4;
  if (streak < 35) return 5;
  if (streak < 50) return 6;
  return Math.min(8, 7 + Math.floor((streak - 50) / 20));
}

interface GameState {
  status: GameStatus;
  score: number;
  lives: number;
  maxLives: number;
  speed: number;
  collectedLetters: number[]; 
  level: number;
  laneCount: number;
  gemsCollected: number;
  distance: number;
  
  // Inventory / Abilities
  hasDoubleJump: boolean;
  hasImmortality: boolean;
  isImmortalityActive: boolean;

  // Cinematic Dunk Slow-Mo & Side-Profile Camera
  isDunkSlowMo: boolean;
  dunkCamTarget: [number, number, number] | null;
  timeScale: number;

  // Dunk Streak & Hoop Approach Crowd Tension
  dunkStreak: number;
  hoopTension: number; // 0.0 to 1.0

  // Dribble Combo & Score Multiplier
  dribbleStreak: number;
  dribbleMultiplier: number;
  incrementDribbleStreak: () => void;
  resetDribbleStreak: () => void;

  // Master Volume & Audio Control
  masterVolume: number; // 0.0 to 1.0
  isMuted: boolean;
  setMasterVolume: (vol: number) => void;
  toggleMute: () => void;

  // Pause Controls
  pauseGame: () => void;
  resumeGame: () => void;

  // Actions
  startGame: () => void;
  restartGame: () => void;
  takeDamage: () => void;
  addScore: (amount: number) => void;
  collectGem: (value: number) => void;
  collectLetter: (index: number) => void;
  setStatus: (status: GameStatus) => void;
  setDistance: (dist: number) => void;
  incrementDunkStreak: () => void;
  resetDunkStreak: () => void;
  setHoopTension: (tension: number) => void;
  
  // Cinematic Dunk
  startDunkCinematic: (target: [number, number, number]) => void;
  endDunkCinematic: () => void;
  setTimeScale: (scale: number) => void;
  
  // Shop / Abilities
  buyItem: (type: 'DOUBLE_JUMP' | 'MAX_LIFE' | 'HEAL' | 'IMMORTAL', cost: number) => boolean;
  advanceLevel: () => void;
  openShop: () => void;
  closeShop: () => void;
  activateImmortality: () => void;
}

const MAX_LEVEL = 3;

export const useStore = create<GameState>((set, get) => ({
  status: GameStatus.MENU,
  score: 0,
  lives: 3,
  maxLives: 3,
  speed: 0,
  collectedLetters: [],
  level: 1,
  laneCount: 3,
  gemsCollected: 0,
  distance: 0,
  
  hasDoubleJump: false,
  hasImmortality: false,
  isImmortalityActive: false,

  isDunkSlowMo: false,
  dunkCamTarget: null,
  timeScale: 1.0,

  dunkStreak: 0,
  hoopTension: 0,

  dribbleStreak: 0,
  dribbleMultiplier: 1,

  masterVolume: 0.8,
  isMuted: false,

  setMasterVolume: (vol: number) => {
    const clamped = Math.max(0, Math.min(1, vol));
    set({ masterVolume: clamped, isMuted: clamped === 0 });
    audio.setMasterVolume(clamped);
    ambientAudio.setVolume(clamped);
    crowdAudioController.setVolume(clamped);
  },

  toggleMute: () => {
    const nextMuted = !get().isMuted;
    set({ isMuted: nextMuted });
    const effective = nextMuted ? 0 : get().masterVolume;
    audio.setMasterVolume(effective);
    ambientAudio.setVolume(effective);
    crowdAudioController.setVolume(effective);
  },

  pauseGame: () => {
    if (get().status === GameStatus.PLAYING) {
      set({ status: GameStatus.PAUSED });
    }
  },

  resumeGame: () => {
    if (get().status === GameStatus.PAUSED) {
      set({ status: GameStatus.PLAYING });
    }
  },

  incrementDribbleStreak: () => {
    const nextStreak = get().dribbleStreak + 1;
    const nextMultiplier = calculateDribbleMultiplier(nextStreak);
    set({
      dribbleStreak: nextStreak,
      dribbleMultiplier: nextMultiplier
    });
  },

  resetDribbleStreak: () => {
    set({ dribbleStreak: 0, dribbleMultiplier: 1 });
  },

  startGame: () => set({ 
    status: GameStatus.PLAYING, 
    score: 0, 
    lives: 3, 
    maxLives: 3,
    speed: RUN_SPEED_BASE,
    collectedLetters: [],
    level: 1,
    laneCount: 3,
    gemsCollected: 0,
    distance: 0,
    hasDoubleJump: false,
    hasImmortality: false,
    isImmortalityActive: false,
    isDunkSlowMo: false,
    dunkCamTarget: null,
    timeScale: 1.0,
    dunkStreak: 0,
    hoopTension: 0,
    dribbleStreak: 0,
    dribbleMultiplier: 1
  }),

  restartGame: () => set({ 
    status: GameStatus.PLAYING, 
    score: 0, 
    lives: 3, 
    maxLives: 3,
    speed: RUN_SPEED_BASE,
    collectedLetters: [],
    level: 1,
    laneCount: 3,
    gemsCollected: 0,
    distance: 0,
    hasDoubleJump: false,
    hasImmortality: false,
    isImmortalityActive: false,
    isDunkSlowMo: false,
    dunkCamTarget: null,
    timeScale: 1.0,
    dunkStreak: 0,
    hoopTension: 0,
    dribbleStreak: 0,
    dribbleMultiplier: 1
  }),

  takeDamage: () => {
    const { lives, isImmortalityActive } = get();
    if (isImmortalityActive) return; // No damage if skill is active

    if (lives > 1) {
      set({ lives: lives - 1, dunkStreak: 0, hoopTension: 0, dribbleStreak: 0, dribbleMultiplier: 1 });
    } else {
      get().endDunkCinematic();
      set({ lives: 0, status: GameStatus.GAME_OVER, speed: 0, dunkStreak: 0, hoopTension: 0, dribbleStreak: 0, dribbleMultiplier: 1 });
    }
  },

  incrementDunkStreak: () => set((state) => ({ dunkStreak: state.dunkStreak + 1 })),
  resetDunkStreak: () => set({ dunkStreak: 0 }),
  setHoopTension: (tension) => set({ hoopTension: Math.max(0, Math.min(1, tension)) }),

  addScore: (amount) => set((state) => ({ score: state.score + Math.round(amount * state.dribbleMultiplier) })),
  
  collectGem: (value) => set((state) => ({ 
    score: state.score + Math.round(value * state.dribbleMultiplier), 
    gemsCollected: state.gemsCollected + 1 
  })),

  setDistance: (dist) => set({ distance: dist }),

  collectLetter: (index) => {
    const { collectedLetters, level, speed } = get();
    
    if (!collectedLetters.includes(index)) {
      const newLetters = [...collectedLetters, index];
      
      // LINEAR SPEED INCREASE: Add 10% of BASE speed per letter
      // This ensures 110% -> 120% -> 130% consistent steps
      const speedIncrease = RUN_SPEED_BASE * 0.10;
      const nextSpeed = speed + speedIncrease;

      set({ 
        collectedLetters: newLetters,
        speed: nextSpeed
      });

      // Check if full word collected (B-A-S-K-E-T)
      if (newLetters.length === BASKET_TARGET.length) {
        if (level < MAX_LEVEL) {
            // Immediately advance level
            // The Shop Portal will be spawned by LevelManager at the start of the new level
            get().advanceLevel();
        } else {
            // Victory Condition
            set({
                status: GameStatus.VICTORY,
                score: get().score + 5000
            });
        }
      }
    }
  },

  advanceLevel: () => {
      const { level, laneCount, speed } = get();
      const nextLevel = level + 1;
      
      // LINEAR LEVEL INCREASE: Add 40% of BASE speed per level
      // Combined with the 6 letters (60%), this totals +100% speed per full level cycle
      const speedIncrease = RUN_SPEED_BASE * 0.40;
      const newSpeed = speed + speedIncrease;

      set({
          level: nextLevel,
          laneCount: Math.min(laneCount + 2, 9), // Expand lanes
          status: GameStatus.PLAYING, // Keep playing, user runs into shop
          speed: newSpeed,
          collectedLetters: [] // Reset letters
      });
  },

  openShop: () => set({ status: GameStatus.SHOP }),
  
  closeShop: () => set({ status: GameStatus.PLAYING }),

  buyItem: (type, cost) => {
      const { score, maxLives, lives } = get();
      
      if (score >= cost) {
          set({ score: score - cost });
          
          switch (type) {
              case 'DOUBLE_JUMP':
                  set({ hasDoubleJump: true });
                  break;
              case 'MAX_LIFE':
                  set({ maxLives: maxLives + 1, lives: lives + 1 });
                  break;
              case 'HEAL':
                  set({ lives: Math.min(lives + 1, maxLives) });
                  break;
              case 'IMMORTAL':
                  set({ hasImmortality: true });
                  break;
          }
          return true;
      }
      return false;
  },

  activateImmortality: () => {
      const { hasImmortality, isImmortalityActive } = get();
      if (hasImmortality && !isImmortalityActive) {
          set({ isImmortalityActive: true });
          
          // Lasts 5 seconds
          setTimeout(() => {
              set({ isImmortalityActive: false });
          }, 5000);
      }
  },

  startDunkCinematic: (target: [number, number, number]) => {
    // Clear any active timers
    if ((window as any).__dunkSlowMoTimer) {
      clearTimeout((window as any).__dunkSlowMoTimer);
    }
    if ((window as any).__dunkRampTimer) {
      clearTimeout((window as any).__dunkRampTimer);
    }

    set({
      isDunkSlowMo: true,
      dunkCamTarget: target,
      timeScale: 0.18, // Dramatic slow motion
    });

    // Ease timeScale back up after 1.4s
    (window as any).__dunkRampTimer = setTimeout(() => {
      if (get().isDunkSlowMo) {
        set({ timeScale: 0.55 });
      }
    }, 1400);

    // End cinematic slow-mo after 2.0s total and resume full speed
    (window as any).__dunkSlowMoTimer = setTimeout(() => {
      get().endDunkCinematic();
    }, 2000);
  },

  endDunkCinematic: () => {
    if ((window as any).__dunkSlowMoTimer) {
      clearTimeout((window as any).__dunkSlowMoTimer);
    }
    if ((window as any).__dunkRampTimer) {
      clearTimeout((window as any).__dunkRampTimer);
    }
    set({
      isDunkSlowMo: false,
      dunkCamTarget: null,
      timeScale: 1.0,
    });
  },

  setTimeScale: (scale: number) => set({ timeScale: scale }),

  setStatus: (status) => set({ status }),
  increaseLevel: () => set((state) => ({ level: state.level + 1 })),
}));
