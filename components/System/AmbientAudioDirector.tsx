/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useEffect, useRef } from 'react';
import { useStore } from '../../store';
import { GameStatus, RUN_SPEED_BASE } from '../../types';
import { ambientAudio } from './AmbientAudio';
import { audio } from './Audio';
import { announcer } from './Announcer';

/**
 * AmbientAudioDirector
 * Dynamically modulates arena crowd ambience, excitement cheering, and acoustic filters
 * in real-time as the basketball game starts and intensity escalates.
 */
export const AmbientAudioDirector: React.FC = () => {
  const { status, speed, level, collectedLetters, isImmortalityActive } = useStore();
  const prevStatus = useRef<GameStatus>(status);
  const prevOnFire = useRef<boolean>(isImmortalityActive);

  // Status transitions
  useEffect(() => {
    if (status !== prevStatus.current) {
      ambientAudio.onGameStatusChange(status);
      if (status === GameStatus.GAME_OVER) announcer.onGameOver();
      if (status === GameStatus.VICTORY) announcer.onVictory();
      if (status === GameStatus.MENU) announcer.reset();
      prevStatus.current = status;
    }
  }, [status]);

  // Keep music lifecycle separate from crowd intensity and announcements.
  useEffect(() => {
    const syncMusic = () => {
      const current = useStore.getState();
      const active = [GameStatus.MENU, GameStatus.PLAYING, GameStatus.SHOP].includes(current.status);
      if (document.hidden || !active) audio.stopBGM();
      else {
        audio.setMasterVolume(current.isMuted ? 0 : current.masterVolume);
        audio.playBGM('./audio/arena-pulse.wav');
      }
    };
    syncMusic();
    window.addEventListener('pointerdown', syncMusic);
    window.addEventListener('keydown', syncMusic);
    document.addEventListener('visibilitychange', syncMusic);
    return () => {
      audio.stopBGM();
      window.removeEventListener('pointerdown', syncMusic);
      window.removeEventListener('keydown', syncMusic);
      document.removeEventListener('visibilitychange', syncMusic);
    };
  }, [status]);

  // "He's On Fire!" activation crowd explosion
  useEffect(() => {
    if (isImmortalityActive && !prevOnFire.current) {
      ambientAudio.triggerCheerSwell(1.0);
      ambientAudio.triggerArenaFanfare();
      announcer.onFire();
    }
    prevOnFire.current = isImmortalityActive;
  }, [isImmortalityActive]);

  // Dynamic real-time intensity management
  useEffect(() => {
    if (status !== GameStatus.PLAYING && status !== GameStatus.SHOP) return;

    // Intensity calculation scaling from 0.15 (early Q1) to 1.0 (climax speed / high quarters / on fire)
    const baseQuarter = (level - 1) * 0.22; // 0.0 -> 0.22 -> 0.44
    const speedDelta = Math.max(0, speed - RUN_SPEED_BASE);
    const speedProgress = Math.min(0.40, (speedDelta / (RUN_SPEED_BASE * 1.2)) * 0.40);
    const letterProgress = (collectedLetters.length / 6) * 0.18;
    const onFireBoost = isImmortalityActive ? 0.35 : 0;

    const totalIntensity = Math.min(1.0, 0.15 + baseQuarter + speedProgress + letterProgress + onFireBoost);
    ambientAudio.updateIntensity(totalIntensity);
  }, [status, speed, level, collectedLetters.length, isImmortalityActive]);

  // User input audio unlock listener
  useEffect(() => {
    const handleFirstInteraction = () => {
      audio.init();
      ambientAudio.init();
    };

    window.addEventListener('click', handleFirstInteraction, { once: true });
    window.addEventListener('keydown', handleFirstInteraction, { once: true });
    window.addEventListener('touchstart', handleFirstInteraction, { once: true });

    return () => {
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
    };
  }, []);

  return null;
};
