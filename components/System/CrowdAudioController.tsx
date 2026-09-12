/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useEffect, useRef } from 'react';
import { audio } from './Audio';
import { ambientAudio } from './AmbientAudio';
import { useStore } from '../../store';
import { GameStatus } from '../../types';

/**
 * CrowdAudioEngine
 * Procedural Web Audio synthesis system that:
 * 1. Modulates crowd cheering volume dynamically based on current dunk success streak
 * 2. Builds stadium tension as player approaches upcoming basketball hoops
 * 3. Synthesizes anticipatory vocal formants, sub-harmonic risers, streak-scaled roar explosions,
 *    and disappointment groans on missed hoops.
 */
export class CrowdAudioEngine {
  private ctx: AudioContext | null = null;
  private crowdBus: GainNode | null = null;

  // Hoop Approach Tension Nodes
  private tensionGain: GainNode | null = null;
  private tensionFilter: BiquadFilterNode | null = null;
  private tensionRiserOsc: OscillatorNode | null = null;
  private tensionRiserGain: GainNode | null = null;
  private tensionNoiseSource: AudioBufferSourceNode | null = null;
  private isTensionActive = false;

  // State Tracking
  private currentTension = 0; // 0.0 to 1.0
  private currentStreak = 0;
  private hasGaspTriggeredForCurrentHoop = false;
  private isMuted = false;

  constructor() {
    // Lazy initialized
  }

  public init(externalCtx?: AudioContext) {
    if (!this.ctx) {
      if (externalCtx) {
        this.ctx = externalCtx;
      } else if (audio.ctx) {
        this.ctx = audio.ctx;
      } else {
        audio.init();
        this.ctx = audio.ctx;
      }
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    if (this.ctx && !this.crowdBus) {
      this.setupAudioGraph();
    }
  }

  private setupAudioGraph() {
    if (!this.ctx) return;

    // Master bus for streak & tension crowd audio
    this.crowdBus = this.ctx.createGain();
    this.crowdBus.gain.setValueAtTime(1.0, this.ctx.currentTime);

    if (audio.masterGain) {
      this.crowdBus.connect(audio.masterGain);
    } else {
      this.crowdBus.connect(this.ctx.destination);
    }

    // --- Tension Generator Graph ---
    this.tensionGain = this.ctx.createGain();
    this.tensionGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);

    // Resonant bandpass filter that sweeps upwards as hoop approaches
    this.tensionFilter = this.ctx.createBiquadFilter();
    this.tensionFilter.type = 'bandpass';
    this.tensionFilter.frequency.setValueAtTime(420, this.ctx.currentTime);
    this.tensionFilter.Q.setValueAtTime(2.2, this.ctx.currentTime);

    // Continuous pink noise source for crowd anticipation breath/murmur
    const sampleRate = this.ctx.sampleRate;
    const duration = 5.0;
    const frameCount = Math.floor(sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, frameCount, sampleRate);
    const data = buffer.getChannelData(0);

    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < frameCount; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      data[i] = (b0 + b1 + b2) * 0.25;
    }

    this.tensionNoiseSource = this.ctx.createBufferSource();
    this.tensionNoiseSource.buffer = buffer;
    this.tensionNoiseSource.loop = true;

    // Sub-harmonic riser oscillator (deep room suspense resonance)
    this.tensionRiserOsc = this.ctx.createOscillator();
    this.tensionRiserGain = this.ctx.createGain();
    this.tensionRiserOsc.type = 'triangle';
    this.tensionRiserOsc.frequency.setValueAtTime(55, this.ctx.currentTime);
    this.tensionRiserGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);

    // Connections
    this.tensionNoiseSource.connect(this.tensionFilter);
    this.tensionFilter.connect(this.tensionGain);

    this.tensionRiserOsc.connect(this.tensionRiserGain);
    this.tensionRiserGain.connect(this.tensionGain);

    this.tensionGain.connect(this.crowdBus);

    // Start background tension generators
    try {
      this.tensionNoiseSource.start();
      this.tensionRiserOsc.start();
      this.isTensionActive = true;
    } catch {
      // Audio node start safety
    }
  }

  /**
   * Modulates crowd tension in real-time as the player approaches the hoop
   * @param distance Distance along Z axis between player and upcoming hoop (meters)
   * @param streak Current consecutive slam dunk streak
   */
  public updateHoopProximity(distance: number, streak: number) {
    this.currentStreak = streak;
    if (!this.ctx || !this.tensionGain || !this.tensionFilter || !this.tensionRiserOsc || !this.tensionRiserGain) {
      this.init();
    }
    if (!this.ctx || !this.tensionGain || !this.tensionFilter || !this.tensionRiserOsc || !this.tensionRiserGain) {
      return;
    }

    const t = this.ctx.currentTime;
    const APPROACH_MAX_DIST = 42.0; // Distance at which crowd begins watching closely
    const APPROACH_CRITICAL_DIST = 4.0; // Point of imminent leap

    if (distance > APPROACH_MAX_DIST || distance < -2.0) {
      // Outside approach range: smoothly fade tension out
      this.currentTension = 0;
      this.hasGaspTriggeredForCurrentHoop = false;
      this.tensionGain.gain.setTargetAtTime(0.0001, t, 0.25);
      this.tensionRiserGain.gain.setTargetAtTime(0.0001, t, 0.25);
      return;
    }

    // Calculate normalized tension (0.0 at 42m, 1.0 at 4m)
    const normalized = Math.max(0, Math.min(1, (APPROACH_MAX_DIST - Math.max(APPROACH_CRITICAL_DIST, distance)) / (APPROACH_MAX_DIST - APPROACH_CRITICAL_DIST)));
    this.currentTension = normalized;

    // Streak multiplier: Higher streak builds exponentially greater tension!
    // Streak 0: standard anticipation (1.0x)
    // Streak 1: 1.35x
    // Streak 2: 1.70x ("HEATING UP!")
    // Streak 3+: 2.2x - 3.0x ("ARENA BEDLAM!")
    const streakMultiplier = 1.0 + Math.min(streak, 5) * 0.40;

    // 1. Resonant filter sweeps up with vocal excitement (420Hz -> 1350Hz)
    const targetFreq = 420 + Math.pow(normalized, 1.4) * 980;
    const targetQ = 1.8 + normalized * 2.8;
    this.tensionFilter.frequency.setTargetAtTime(targetFreq, t, 0.1);
    this.tensionFilter.Q.setTargetAtTime(targetQ, t, 0.1);

    // 2. Sub-harmonic riser glides up (55Hz -> 120Hz)
    const targetRiserFreq = 55 + normalized * 65;
    this.tensionRiserOsc.frequency.setTargetAtTime(targetRiserFreq, t, 0.1);

    // 3. Tension Gain Envelope
    const targetGain = (0.015 + Math.pow(normalized, 1.6) * 0.22) * streakMultiplier;
    this.tensionGain.gain.setTargetAtTime(this.isMuted ? 0 : targetGain, t, 0.08);

    const targetRiserGain = (0.008 + normalized * 0.045) * streakMultiplier;
    this.tensionRiserGain.gain.setTargetAtTime(this.isMuted ? 0 : targetRiserGain, t, 0.08);

    // 4. If high streak (2+) and entering the rim zone (normalized > 0.82), trigger quick crowd intake breath
    if (streak >= 2 && normalized > 0.82 && !this.hasGaspTriggeredForCurrentHoop) {
      this.hasGaspTriggeredForCurrentHoop = true;
      this.triggerAnticipationInhale(streak);
    }
  }

  /**
   * Quick crowd anticipatory breath intake ("Oooohhh!") just before the leap
   */
  private triggerAnticipationInhale(streak: number) {
    if (!this.ctx || !this.crowdBus) return;
    const t = this.ctx.currentTime;
    const duration = 0.35;

    const noise = this.ctx.createBufferSource();
    const frameCount = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, frameCount, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frameCount; i++) {
      data[i] = (Math.random() * 2 - 1) * (i / frameCount); // Rising ramp
    }
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(600, t);
    filter.frequency.linearRampToValueAtTime(1100, t + duration);
    filter.Q.setValueAtTime(3.0, t);

    const gain = this.ctx.createGain();
    const peakVol = 0.08 + Math.min(streak, 5) * 0.035;
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(peakVol, t + duration * 0.8);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.crowdBus);

    noise.start(t);
    noise.stop(t + duration);
  }

  /**
   * Triggers massive dynamic crowd cheering volume scaled by the dunk success streak
   * @param streak New dunk streak count (1, 2, 3, 4, etc.)
   */
  public triggerStreakDunkCheer(streak: number, position?: [number, number, number]) {
    this.currentStreak = streak;
    this.currentTension = 0;
    this.hasGaspTriggeredForCurrentHoop = false;

    // Immediately silence approach tension
    if (this.ctx && this.tensionGain) {
      const t = this.ctx.currentTime;
      this.tensionGain.gain.cancelScheduledValues(t);
      this.tensionGain.gain.setValueAtTime(0.0001, t);
    }

    if (!this.ctx || !this.crowdBus) this.init();
    if (!this.ctx || !this.crowdBus) return;

    const t = this.ctx.currentTime;

    // --- Dynamic Cheering Scaling by Streak ---
    // Streak 1: Solid arena cheer (energy ~0.7, vol mult 1.25)
    // Streak 2: Roaring cheer + arena horns (energy ~0.85, vol mult 1.65)
    // Streak 3: On-Fire Stadium Roar + whistling + fanfare (energy ~1.0, vol mult 2.1)
    // Streak 4+: Full arena standing ovation + bedlam (energy ~1.0, vol mult 2.6+)
    const energy = Math.min(1.0, 0.65 + streak * 0.12);
    const volumeMultiplier = 1.0 + Math.min(streak, 6) * 0.35;
    const duration = 1.6 + Math.min(streak, 5) * 0.45;

    // 1. Dual-band High Impact Crowd Roar
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const roarBuffer = this.ctx.createBuffer(2, bufferSize, this.ctx.sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const data = roarBuffer.getChannelData(channel);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
    }

    const roarSource = this.ctx.createBufferSource();
    roarSource.buffer = roarBuffer;

    // Mid-vocal formant filter ("YEEEAAAHHH!")
    const midFilter = this.ctx.createBiquadFilter();
    midFilter.type = 'bandpass';
    midFilter.frequency.setValueAtTime(700, t);
    midFilter.frequency.exponentialRampToValueAtTime(1450 + streak * 120, t + duration * 0.25);
    midFilter.frequency.exponentialRampToValueAtTime(800, t + duration);
    midFilter.Q.setValueAtTime(2.0, t);

    // High presence boost for celebratory crispness
    const highBoost = this.ctx.createBiquadFilter();
    highBoost.type = 'peaking';
    highBoost.frequency.setValueAtTime(2800, t);
    highBoost.gain.setValueAtTime(6 + streak * 2, t);

    const roarGain = this.ctx.createGain();
    const peakVolume = Math.min(0.55, (0.16 + streak * 0.06) * volumeMultiplier);

    roarGain.gain.setValueAtTime(0.001, t);
    // Instantaneous punch attack on rim impact
    roarGain.gain.exponentialRampToValueAtTime(peakVolume, t + 0.08);
    // Sustained roar
    roarGain.gain.setValueAtTime(peakVolume * 0.85, t + duration * 0.45);
    // Gradual stadium decay
    roarGain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    roarSource.connect(midFilter);
    midFilter.connect(highBoost);
    highBoost.connect(roarGain);
    roarGain.connect(this.crowdBus);

    roarSource.start(t);
    roarSource.stop(t + duration);

    // 2. High Streak Whistling & Euphoric Shouts (for streak >= 2)
    if (streak >= 2) {
      const whistleCount = Math.min(4, streak);
      for (let w = 0; w < whistleCount; w++) {
        const wStart = t + 0.12 + w * 0.14;
        const wDur = 0.55 + Math.random() * 0.3;
        const wOsc = this.ctx.createOscillator();
        const wGain = this.ctx.createGain();

        wOsc.type = 'sine';
        const baseFreq = 2200 + Math.random() * 600;
        wOsc.frequency.setValueAtTime(baseFreq, wStart);
        // Signature human sports whistle pitch inflection (up-down)
        wOsc.frequency.linearRampToValueAtTime(baseFreq * 1.35, wStart + wDur * 0.35);
        wOsc.frequency.exponentialRampToValueAtTime(baseFreq * 0.95, wStart + wDur);

        wGain.gain.setValueAtTime(0.001, wStart);
        wGain.gain.exponentialRampToValueAtTime(0.07, wStart + 0.04);
        wGain.gain.exponentialRampToValueAtTime(0.001, wStart + wDur);

        wOsc.connect(wGain);
        wGain.connect(this.crowdBus);

        wOsc.start(wStart);
        wOsc.stop(wStart + wDur);
      }
    }

    // 3. Stadium Organ Fanfare on high streak (streak >= 3)
    if (streak >= 3) {
      const organNotes = [523.25, 659.25, 783.99, 1046.50]; // C Major Triumph
      organNotes.forEach((freq, idx) => {
        const oStart = t + 0.15 + idx * 0.08;
        const oOsc = this.ctx!.createOscillator();
        const oGain = this.ctx!.createGain();

        oOsc.type = 'triangle';
        oOsc.frequency.setValueAtTime(freq, oStart);

        oGain.gain.setValueAtTime(0.001, oStart);
        oGain.gain.exponentialRampToValueAtTime(0.09, oStart + 0.03);
        oGain.gain.exponentialRampToValueAtTime(0.001, oStart + 0.35);

        oOsc.connect(oGain);
        oGain.connect(this.crowdBus!);

        oOsc.start(oStart);
        oOsc.stop(oStart + 0.35);
      });
    }

    // 4. Scale up the background arena intensity so the cheering lingers
    ambientAudio.updateIntensity(Math.min(1.0, 0.4 + streak * 0.15));
  }

  /**
   * Crowd disappointment groan when a hoop is missed after a streak
   * @param previousStreak The streak that was just lost
   */
  public triggerMissedHoopGroan(previousStreak: number) {
    this.currentTension = 0;
    this.hasGaspTriggeredForCurrentHoop = false;

    // Immediately silence approach tension
    if (this.ctx && this.tensionGain) {
      const t = this.ctx.currentTime;
      this.tensionGain.gain.cancelScheduledValues(t);
      this.tensionGain.gain.setValueAtTime(0.0001, t);
    }

    if (!this.ctx || !this.crowdBus || previousStreak <= 0) return;

    const t = this.ctx.currentTime;
    const duration = 0.85;

    // 1. Noise-based downward sweep ("AWWWWWW...")
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(850, t);
    filter.frequency.exponentialRampToValueAtTime(320, t + duration * 0.7);
    filter.Q.setValueAtTime(2.4, t);

    const gain = this.ctx.createGain();
    const groanVol = Math.min(0.28, 0.10 + previousStreak * 0.04);
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.exponentialRampToValueAtTime(groanVol, t + 0.12);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.crowdBus);

    noise.start(t);
    noise.stop(t + duration);

    // 2. Vocal downward pitch bend
    const vocalOsc = this.ctx.createOscillator();
    const vocalGain = this.ctx.createGain();
    vocalOsc.type = 'sawtooth';
    vocalOsc.frequency.setValueAtTime(175, t);
    vocalOsc.frequency.linearRampToValueAtTime(115, t + duration * 0.8);

    const vocalFilter = this.ctx.createBiquadFilter();
    vocalFilter.type = 'lowpass';
    vocalFilter.frequency.setValueAtTime(450, t);

    vocalGain.gain.setValueAtTime(0.001, t);
    vocalGain.gain.exponentialRampToValueAtTime(0.045, t + 0.1);
    vocalGain.gain.exponentialRampToValueAtTime(0.001, t + duration * 0.8);

    vocalOsc.connect(vocalFilter);
    vocalFilter.connect(vocalGain);
    vocalGain.connect(this.crowdBus);

    vocalOsc.start(t);
    vocalOsc.stop(t + duration * 0.8);
  }

  public setMute(muted: boolean) {
    this.isMuted = muted;
    if (this.ctx && this.crowdBus) {
      this.crowdBus.gain.setTargetAtTime(muted ? 0 : 1.0, this.ctx.currentTime, 0.1);
    }
  }

  public setVolume(volume: number) {
    const clamped = Math.max(0, Math.min(1, volume));
    this.isMuted = clamped === 0;
    if (this.ctx && this.crowdBus) {
      this.crowdBus.gain.setTargetAtTime(clamped, this.ctx.currentTime, 0.05);
    }
  }

  public getTension(): number {
    return this.currentTension;
  }
}

// Global Singleton Instance
export const crowdAudioController = new CrowdAudioEngine();

/**
 * CrowdAudioController React Component
 * Synchronizes React store state and game events with the audio engine
 */
export const CrowdAudioController: React.FC = () => {
  const { status, dunkStreak, setHoopTension } = useStore();
  const prevStatus = useRef<GameStatus>(status);

  useEffect(() => {
    if (status === GameStatus.PLAYING && prevStatus.current !== GameStatus.PLAYING) {
      crowdAudioController.init();
    } else if (status === GameStatus.GAME_OVER || status === GameStatus.MENU) {
      crowdAudioController.updateHoopProximity(999, 0);
      setHoopTension(0);
    }
    prevStatus.current = status;
  }, [status, setHoopTension]);

  // Sync mute state if audio system mutes
  useEffect(() => {
    const handleAudioUnlock = () => {
      crowdAudioController.init();
    };

    window.addEventListener('click', handleAudioUnlock, { once: true });
    window.addEventListener('keydown', handleAudioUnlock, { once: true });
    window.addEventListener('touchstart', handleAudioUnlock, { once: true });

    return () => {
      window.removeEventListener('click', handleAudioUnlock);
      window.removeEventListener('keydown', handleAudioUnlock);
      window.removeEventListener('touchstart', handleAudioUnlock);
    };
  }, []);

  return null;
};
