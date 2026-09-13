/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useStore } from '../../store';
import { GameStatus } from '../../types';

const FIRE_LINES = [
  'He is on fire!',
  'Absolute domination!',
  'You cannot stop him!',
  'What a showstopper!',
];

const DUNK_LINES = [
  'Slam dunk!',
  'Take it to the rim!',
  'Booyah! Bang!',
  'He threw it down!',
  'Posterizing!',
];

const POWER_LINES = [
  'Power crush!',
  'That rim is bent!',
  'Alley-oop city!',
  'Pure power!',
];

const PERFECT_LINES = [
  'Perfect release!',
  'Butter!',
  'Nothing but net!',
  'Flawless finish!',
];

const ERROR_LINES = [
  'Uh oh.',
  'He got stuffed!',
  'What a block!',
];

const LEVEL_LINES = [
  'Quarter two!',
  'Quarter three!',
  'Final quarter!',
];

const WORD_LINES = [
  'And the BASKET word is complete!',
  'Basket spelled!',
];

const BUZZER_LINES = [
  "That's the game!",
  'And the buzzer sounds...',
];

const VICTORY_LINES = [
  'Champions! MVP!',
  'They did it! The crowd goes wild!',
];

class Announcer {
  private lastSay = 0;
  private timer: number | null = null;

  isAvailable(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  say(text: string) {
    if (!this.isAvailable() || this.timer) return;

    const { announcerEnabled, isMuted } = useStore.getState();
    if (!announcerEnabled || isMuted) return;

    const now = performance.now();
    if (now - this.lastSay < 900) return;
    this.lastSay = now;

    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 0.9;
      utterance.volume = 0.8;
      this.timer = window.setTimeout(() => {
        this.timer = null;
      }, 3200);
      window.speechSynthesis.speak(utterance);
    } catch {
      this.timer = null;
    }
  }

  onDunk(perfect: boolean) {
    const pool = perfect ? PERFECT_LINES : DUNK_LINES;
    this.say(pool[Math.floor(Math.random() * pool.length)]);
  }

  onPower() {
    this.say(POWER_LINES[Math.floor(Math.random() * POWER_LINES.length)]);
  }

  onFire() {
    this.say(FIRE_LINES[Math.floor(Math.random() * FIRE_LINES.length)]);
  }

  onPlayerHit() {
    this.say(ERROR_LINES[Math.floor(Math.random() * ERROR_LINES.length)]);
  }

  onLevelUp(level: number) {
    const idx = Math.min(level - 2, LEVEL_LINES.length - 1);
    this.say(LEVEL_LINES[idx]);
  }

  onWordComplete() {
    this.say(WORD_LINES[Math.floor(Math.random() * WORD_LINES.length)]);
  }

  onGameOver() {
    this.say(BUZZER_LINES[Math.floor(Math.random() * BUZZER_LINES.length)]);
  }

  onVictory() {
    this.say(VICTORY_LINES[Math.floor(Math.random() * VICTORY_LINES.length)]);
  }

  reset() {
    if (this.timer) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* ignore */
    }
  }
}

export const announcer = new Announcer();