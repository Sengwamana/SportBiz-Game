/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import { ambientAudio } from './AmbientAudio';
import { GameStatus } from '../../types';

export class AudioController {
  ctx: AudioContext | null = null;
  masterGain: GainNode | null = null;
  private lastFlickerTime = 0;

  constructor() {
    // Lazy initialization
  }

  init() {
    if (!this.ctx) {
      // Support for standard and webkit prefixed AudioContext
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.4; // Master volume
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    ambientAudio.init(this.ctx);
  }

  setMasterVolume(vol: number) {
    this.init();
    if (this.ctx && this.masterGain) {
      const t = this.ctx.currentTime;
      const targetGain = Math.max(0, Math.min(1, vol)) * 0.45;
      this.masterGain.gain.cancelScheduledValues(t);
      this.masterGain.gain.setTargetAtTime(targetGain, t, 0.05);
    }
  }

  playDribbleBounce(streak = 0) {
    if (!this.ctx || !this.masterGain) this.init();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    const streakBonus = Math.min(1.5, 1 + streak * 0.03);

    // 1. Heavy basketball core bounce impact (rubber/leather cavity vibration)
    const bounceOsc = this.ctx.createOscillator();
    const bounceGain = this.ctx.createGain();
    bounceOsc.type = 'triangle';
    bounceOsc.frequency.setValueAtTime(125 * streakBonus, t);
    bounceOsc.frequency.exponentialRampToValueAtTime(42, t + 0.07);

    bounceGain.gain.setValueAtTime(0.35, t);
    bounceGain.gain.exponentialRampToValueAtTime(0.001, t + 0.075);

    bounceOsc.connect(bounceGain);
    bounceGain.connect(this.masterGain);
    bounceOsc.start(t);
    bounceOsc.stop(t + 0.075);

    // 2. Crisp hardwood floor contact slap
    const slapOsc = this.ctx.createOscillator();
    const slapGain = this.ctx.createGain();
    slapOsc.type = 'sine';
    slapOsc.frequency.setValueAtTime(380 * streakBonus, t);
    slapOsc.frequency.exponentialRampToValueAtTime(80, t + 0.045);

    slapGain.gain.setValueAtTime(0.22, t);
    slapGain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    slapOsc.connect(slapGain);
    slapGain.connect(this.masterGain);
    slapOsc.start(t);
    slapOsc.stop(t + 0.05);
  }

  playCrossover() {
    if (!this.ctx || !this.masterGain) this.init();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;

    // Fast athletic sneaker bite on the court hardwood
    const squeakOsc = this.ctx.createOscillator();
    const squeakGain = this.ctx.createGain();
    squeakOsc.type = 'sawtooth';
    squeakOsc.frequency.setValueAtTime(1800, t);
    squeakOsc.frequency.linearRampToValueAtTime(2400, t + 0.03);
    squeakOsc.frequency.exponentialRampToValueAtTime(1500, t + 0.09);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2100, t);
    filter.Q.setValueAtTime(3.2, t);

    squeakGain.gain.setValueAtTime(0.2, t);
    squeakGain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

    squeakOsc.connect(filter);
    filter.connect(squeakGain);
    squeakGain.connect(this.masterGain);

    squeakOsc.start(t);
    squeakOsc.stop(t + 0.09);
  }

  startAmbientCrowd() {
    this.init();
    ambientAudio.startAmbience();
  }

  stopAmbientCrowd() {
    ambientAudio.stopAmbience();
  }

  updateAmbientIntensity(intensity: number) {
    ambientAudio.updateIntensity(intensity);
  }

  playCheer(energy = 0.6) {
    this.init();
    ambientAudio.triggerCheerSwell(energy);
  }

  playDefenseChant() {
    this.init();
    ambientAudio.triggerDefenseChant();
  }

  playRhythmicClaps() {
    this.init();
    ambientAudio.triggerRhythmicClaps();
  }

  playGemCollect() {
    if (!this.ctx || !this.masterGain) this.init();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    
    // 1. Basketball bounce thud (body of ball hitting hardwood)
    const bounceOsc = this.ctx.createOscillator();
    const bounceGain = this.ctx.createGain();
    bounceOsc.type = 'triangle';
    bounceOsc.frequency.setValueAtTime(160, t);
    bounceOsc.frequency.exponentialRampToValueAtTime(55, t + 0.09);

    bounceGain.gain.setValueAtTime(0.6, t);
    bounceGain.gain.exponentialRampToValueAtTime(0.01, t + 0.09);
    bounceOsc.connect(bounceGain);
    bounceGain.connect(this.masterGain);
    bounceOsc.start(t);
    bounceOsc.stop(t + 0.09);

    // 2. High crisp "bucket" pop
    const popOsc = this.ctx.createOscillator();
    const popGain = this.ctx.createGain();
    popOsc.type = 'sine';
    popOsc.frequency.setValueAtTime(980, t);
    popOsc.frequency.exponentialRampToValueAtTime(1400, t + 0.08);

    popGain.gain.setValueAtTime(0.3, t);
    popGain.gain.exponentialRampToValueAtTime(0.01, t + 0.12);
    popOsc.connect(popGain);
    popGain.connect(this.masterGain);
    popOsc.start(t);
    popOsc.stop(t + 0.12);
  }

  playLetterCollect() {
    if (!this.ctx || !this.masterGain) this.init();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    
    // Net "SWISH!" noise burst (bandpass filtered noise simulating ball sliding through nylon net)
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.18);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2400, t);
    filter.Q.setValueAtTime(3.0, t);

    const swishGain = this.ctx.createGain();
    swishGain.gain.setValueAtTime(0.4, t);
    swishGain.gain.exponentialRampToValueAtTime(0.01, t + 0.18);

    noise.connect(filter);
    filter.connect(swishGain);
    swishGain.connect(this.masterGain);
    noise.start(t);
    noise.stop(t + 0.18);

    // Rewarding arena jingle chords (C5, E5, G5, C6)
    const freqs = [523.25, 659.25, 783.99, 1046.50]; 
    freqs.forEach((f, i) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'sine';
        osc.frequency.value = f;
        
        const start = t + (i * 0.04);
        const dur = 0.28;

        gain.gain.setValueAtTime(0.25, start);
        gain.gain.exponentialRampToValueAtTime(0.01, start + dur);

        osc.connect(gain);
        gain.connect(this.masterGain!);
        osc.start(start);
        osc.stop(start + dur);
    });
  }

  playJump(isDouble = false) {
    if (!this.ctx || !this.masterGain) this.init();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    
    // Sneaker squeak on polished hardwood floor!
    const squeakOsc = this.ctx.createOscillator();
    const squeakGain = this.ctx.createGain();
    squeakOsc.type = 'sawtooth';
    
    const startFreq = isDouble ? 2200 : 1600;
    const peakFreq = isDouble ? 2800 : 2200;
    const endFreq = isDouble ? 1900 : 1400;

    squeakOsc.frequency.setValueAtTime(startFreq, t);
    squeakOsc.frequency.linearRampToValueAtTime(peakFreq, t + 0.04);
    squeakOsc.frequency.exponentialRampToValueAtTime(endFreq, t + 0.12);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2000, t);
    filter.Q.setValueAtTime(2.5, t);

    squeakGain.gain.setValueAtTime(0.25, t);
    squeakGain.gain.exponentialRampToValueAtTime(0.01, t + 0.13);

    squeakOsc.connect(filter);
    filter.connect(squeakGain);
    squeakGain.connect(this.masterGain);

    squeakOsc.start(t);
    squeakOsc.stop(t + 0.13);
  }

  playDunk() {
    if (!this.ctx || !this.masterGain) this.init();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;

    // 1. Heavy Breakaway Rim Rattle & Metallic Spring Vibration
    const rimOsc1 = this.ctx.createOscillator();
    const rimOsc2 = this.ctx.createOscillator();
    const rimGain = this.ctx.createGain();

    rimOsc1.type = 'triangle';
    rimOsc2.type = 'sawtooth';

    rimOsc1.frequency.setValueAtTime(230, t);
    rimOsc1.frequency.exponentialRampToValueAtTime(130, t + 0.26);

    rimOsc2.frequency.setValueAtTime(360, t);
    rimOsc2.frequency.exponentialRampToValueAtTime(175, t + 0.22);

    const rimFilter = this.ctx.createBiquadFilter();
    rimFilter.type = 'bandpass';
    rimFilter.frequency.setValueAtTime(450, t);
    rimFilter.Q.setValueAtTime(3.8, t);

    rimGain.gain.setValueAtTime(0.75, t);
    rimGain.gain.exponentialRampToValueAtTime(0.01, t + 0.38);

    rimOsc1.connect(rimFilter);
    rimOsc2.connect(rimFilter);
    rimFilter.connect(rimGain);
    rimGain.connect(this.masterGain);

    rimOsc1.start(t);
    rimOsc2.start(t);
    rimOsc1.stop(t + 0.38);
    rimOsc2.stop(t + 0.38);

    // 2. Subwoofer Arena Bass Thump (Backboard & Glass Shockwave)
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(95, t);
    subOsc.frequency.exponentialRampToValueAtTime(38, t + 0.28);

    subGain.gain.setValueAtTime(0.85, t);
    subGain.gain.exponentialRampToValueAtTime(0.01, t + 0.28);

    subOsc.connect(subGain);
    subGain.connect(this.masterGain);
    subOsc.start(t);
    subOsc.stop(t + 0.28);

    // 3. Crisp Nylon Net Swish Burst
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.2);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const netFilter = this.ctx.createBiquadFilter();
    netFilter.type = 'bandpass';
    netFilter.frequency.setValueAtTime(2600, t + 0.04);
    netFilter.Q.setValueAtTime(2.4, t);

    const netGain = this.ctx.createGain();
    netGain.gain.setValueAtTime(0, t);
    netGain.gain.setValueAtTime(0.55, t + 0.04);
    netGain.gain.exponentialRampToValueAtTime(0.01, t + 0.24);

    noise.connect(netFilter);
    netFilter.connect(netGain);
    netGain.connect(this.masterGain);
    noise.start(t + 0.04);
    noise.stop(t + 0.25);

    // 4. Instant Crowd Cheering Swell
    ambientAudio.triggerCheerSwell(0.95);
  }

  playDamage() {
    if (!this.ctx || !this.masterGain) this.init();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    
    // 1. Referee Whistle (dual-frequency warble)
    const whistle1 = this.ctx.createOscillator();
    const whistle2 = this.ctx.createOscillator();
    const whistleGain = this.ctx.createGain();

    whistle1.type = 'sine';
    whistle2.type = 'sine';
    whistle1.frequency.setValueAtTime(2500, t);
    whistle2.frequency.setValueAtTime(2780, t);

    whistleGain.gain.setValueAtTime(0.35, t);
    whistleGain.gain.exponentialRampToValueAtTime(0.01, t + 0.25);

    whistle1.connect(whistleGain);
    whistle2.connect(whistleGain);
    whistleGain.connect(this.masterGain);

    whistle1.start(t);
    whistle2.start(t);
    whistle1.stop(t + 0.25);
    whistle2.stop(t + 0.25);

    // 2. Physical player collision thud
    const thud = this.ctx.createOscillator();
    const thudGain = this.ctx.createGain();
    thud.type = 'triangle';
    thud.frequency.setValueAtTime(140, t);
    thud.frequency.exponentialRampToValueAtTime(40, t + 0.18);

    thudGain.gain.setValueAtTime(0.5, t);
    thudGain.gain.exponentialRampToValueAtTime(0.01, t + 0.18);

    thud.connect(thudGain);
    thudGain.connect(this.masterGain);
    thud.start(t);
    thud.stop(t + 0.18);

    // Arena crowd gasps in reaction to the collision
    ambientAudio.triggerCrowdGasp();
  }

  playLightFlicker() {
    if (!this.ctx || !this.masterGain) this.init();
    if (!this.ctx || !this.masterGain) return;

    const now = performance.now();
    if (now - this.lastFlickerTime < 600) return; // Debounce so it doesn't trigger repeatedly in one burst
    this.lastFlickerTime = now;

    const t = this.ctx.currentTime;
    // Stadium Halogen Ballast hum & electrical arc pop
    const arcOsc = this.ctx.createOscillator();
    const arcGain = this.ctx.createGain();

    arcOsc.type = 'sawtooth';
    arcOsc.frequency.setValueAtTime(120, t);
    arcOsc.frequency.exponentialRampToValueAtTime(60, t + 0.1);

    arcGain.gain.setValueAtTime(0.045, t);
    arcGain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

    arcOsc.connect(arcGain);
    arcGain.connect(this.masterGain);

    arcOsc.start(t);
    arcOsc.stop(t + 0.1);
  }

  playSlowMoStart() {
    if (!this.ctx || !this.masterGain) this.init();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;

    // 1. Deep Sub-Bass Dilation Sweep
    const bassOsc = this.ctx.createOscillator();
    const bassGain = this.ctx.createGain();
    bassOsc.type = 'sine';
    bassOsc.frequency.setValueAtTime(240, t);
    bassOsc.frequency.exponentialRampToValueAtTime(38, t + 0.65);

    bassGain.gain.setValueAtTime(0.35, t);
    bassGain.gain.exponentialRampToValueAtTime(0.001, t + 0.9);

    bassOsc.connect(bassGain);
    bassGain.connect(this.masterGain);

    bassOsc.start(t);
    bassOsc.stop(t + 0.9);

    // 2. Filtered Air Whoosh (Wind Tunnel Time-Freeze effect)
    try {
      const bufferSize = this.ctx.sampleRate * 0.7;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, t);
      filter.frequency.exponentialRampToValueAtTime(180, t + 0.65);
      filter.Q.setValueAtTime(4.0, t);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.18, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);

      whiteNoise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.masterGain);

      whiteNoise.start(t);
      whiteNoise.stop(t + 0.7);
    } catch {
      // Fallback if audio buffer fails
    }
  }

  playSlowMoEnd() {
    if (!this.ctx || !this.masterGain) this.init();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;

    // Rising velocity whoosh resuming real-time action
    const snapOsc = this.ctx.createOscillator();
    const snapGain = this.ctx.createGain();

    snapOsc.type = 'triangle';
    snapOsc.frequency.setValueAtTime(65, t);
    snapOsc.frequency.exponentialRampToValueAtTime(320, t + 0.28);

    snapGain.gain.setValueAtTime(0.15, t);
    snapGain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);

    snapOsc.connect(snapGain);
    snapGain.connect(this.masterGain);

    snapOsc.start(t);
    snapOsc.stop(t + 0.32);
  }

  playBuzzer() {
    if (!this.ctx || !this.masterGain) this.init();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    
    // Iconic Arena Game-Over Horn / Shot Clock Buzzer
    const buzzer = this.ctx.createOscillator();
    const buzzerGain = this.ctx.createGain();
    buzzer.type = 'sawtooth';
    buzzer.frequency.setValueAtTime(145, t);

    buzzerGain.gain.setValueAtTime(0.4, t);
    buzzerGain.gain.exponentialRampToValueAtTime(0.01, t + 0.65);

    buzzer.connect(buzzerGain);
    buzzerGain.connect(this.masterGain);
    buzzer.start(t);
    buzzer.stop(t + 0.65);

    // Crowd groan / silence
    ambientAudio.onGameStatusChange(GameStatus.GAME_OVER);
  }
}

export const audio = new AudioController();
