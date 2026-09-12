/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { audio } from './Audio';
import { GameStatus } from '../../types';

/**
 * AmbientAudioManager
 * Procedurally generates realistic indoor basketball arena acoustics:
 * - Continuous crowd murmur & stadium bowl resonance
 * - Dynamic cheering swells that scale with game speed, level, and intensity
 * - Authentic court events: tip-off cheers, letter score roars, defense chants, rhythmic arena claps, crowd gasps
 * - Muffled locker room acoustics when visiting the shop
 */
export class AmbientAudioManager {
  private ctx: AudioContext | null = null;
  private ambientGain: GainNode | null = null;
  private crowdFilter: BiquadFilterNode | null = null;
  private murmurSource: AudioBufferSourceNode | null = null;
  private roomDroneOsc: OscillatorNode | null = null;
  private roomDroneGain: GainNode | null = null;

  private isRunning = false;
  private currentIntensity = 0.2; // 0.0 to 1.0
  private cheerTimer: any = null;
  private chantTimer: any = null;
  private currentStatus: GameStatus = GameStatus.MENU;
  private isMuted = false;

  constructor() {
    // Lazy initialized when audio.init() or user interacts
  }

  /**
   * Initializes or hooks into the shared Web Audio Context
   */
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

    if (this.ctx && !this.ambientGain) {
      this.setupAudioGraph();
    }
  }

  private setupAudioGraph() {
    if (!this.ctx) return;

    // Master ambient bus
    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.setValueAtTime(0.001, this.ctx.currentTime);

    // Multi-band filter shaping arena acoustic space (dampens harsh highs, warms human vocal formants)
    this.crowdFilter = this.ctx.createBiquadFilter();
    this.crowdFilter.type = 'lowpass';
    this.crowdFilter.frequency.setValueAtTime(1100, this.ctx.currentTime);
    this.crowdFilter.Q.setValueAtTime(1.2, this.ctx.currentTime);

    // Connect to audio controller master gain or context destination
    if (audio.masterGain) {
      this.crowdFilter.connect(this.ambientGain);
      this.ambientGain.connect(audio.masterGain);
    } else {
      this.crowdFilter.connect(this.ambientGain);
      this.ambientGain.connect(this.ctx.destination);
    }
  }

  /**
   * Generates a seamless 8-second pink/brown noise buffer with human crowd murmur formants
   */
  private createCrowdMurmurBuffer(): AudioBuffer | null {
    if (!this.ctx) return null;

    const sampleRate = this.ctx.sampleRate;
    const duration = 8.0;
    const frameCount = Math.floor(sampleRate * duration);
    const buffer = this.ctx.createBuffer(2, frameCount, sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

      for (let i = 0; i < frameCount; i++) {
        const white = Math.random() * 2 - 1;
        // Pink noise filter algorithm (Paul Kellet's method)
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
        b6 = white * 0.115926;

        // Subtle slow swell modulation simulating crowd conversation waves
        const swell = 0.85 + 0.15 * Math.sin((i / frameCount) * Math.PI * 4 + channel);
        data[i] = pink * 0.08 * swell;
      }
    }

    return buffer;
  }

  /**
   * Starts playing the continuous basketball stadium atmosphere
   */
  public startAmbience() {
    this.init();
    if (!this.ctx || !this.ambientGain || !this.crowdFilter) return;

    if (this.isRunning) {
      this.updateIntensity(this.currentIntensity);
      return;
    }

    this.isRunning = true;
    const t = this.ctx.currentTime;

    // 1. Continuous crowd murmur loop
    const buffer = this.createCrowdMurmurBuffer();
    if (buffer) {
      this.murmurSource = this.ctx.createBufferSource();
      this.murmurSource.buffer = buffer;
      this.murmurSource.loop = true;
      this.murmurSource.connect(this.crowdFilter);
      this.murmurSource.start();
    }

    // 2. Deep arena stadium bowl sub-resonance (indoor hardwood acoustic presence ~65Hz)
    this.roomDroneOsc = this.ctx.createOscillator();
    this.roomDroneGain = this.ctx.createGain();
    this.roomDroneOsc.type = 'sine';
    this.roomDroneOsc.frequency.setValueAtTime(65, t);
    this.roomDroneGain.gain.setValueAtTime(0.04, t);

    this.roomDroneOsc.connect(this.roomDroneGain);
    this.roomDroneGain.connect(this.ambientGain);
    this.roomDroneOsc.start();

    // Fade in
    this.ambientGain.gain.cancelScheduledValues(t);
    this.ambientGain.gain.setTargetAtTime(0.24, t, 0.6);

    // Initial Tip-Off Excitement
    this.triggerTipOff();

    // Start automated intensity-driven crowd cheer loop
    this.scheduleNextCheer();
    this.scheduleNextChant();
  }

  /**
   * Updates ambient stadium intensity based on current game velocity, level, and combos
   * @param intensity Float between 0.0 (calm) and 1.0 (fever pitch / on-fire)
   */
  public updateIntensity(intensity: number) {
    this.currentIntensity = Math.min(1.0, Math.max(0.05, intensity));
    if (!this.ctx || !this.ambientGain || !this.crowdFilter || !this.isRunning) return;

    const t = this.ctx.currentTime;

    if (this.currentStatus === GameStatus.SHOP) {
      // Muffled tunnel acoustics when in the Locker Room
      this.crowdFilter.frequency.setTargetAtTime(360, t, 0.4);
      this.ambientGain.gain.setTargetAtTime(0.12, t, 0.4);
      return;
    }

    // Dynamic volume & frequency response to intensity:
    // Low intensity: warm gentle background (~900Hz, volume ~0.20)
    // High intensity / max pace: energetic bright stadium presence (~2600Hz, volume ~0.42)
    const targetFreq = 900 + this.currentIntensity * 1700;
    const targetVolume = this.isMuted ? 0 : 0.18 + this.currentIntensity * 0.24;

    this.crowdFilter.frequency.setTargetAtTime(targetFreq, t, 0.5);
    this.ambientGain.gain.setTargetAtTime(targetVolume, t, 0.5);

    // Increase stadium sub-bass vibration slightly with intensity
    if (this.roomDroneGain) {
      this.roomDroneGain.gain.setTargetAtTime(0.03 + this.currentIntensity * 0.04, t, 0.5);
    }
  }

  /**
   * Triggered when game state changes
   */
  public onGameStatusChange(status: GameStatus) {
    this.currentStatus = status;

    if (status === GameStatus.PLAYING) {
      if (!this.isRunning) {
        this.startAmbience();
      } else {
        this.updateIntensity(this.currentIntensity);
      }
    } else if (status === GameStatus.SHOP) {
      // Step into the Locker Room: muffle crowd noise
      this.updateIntensity(this.currentIntensity);
    } else if (status === GameStatus.GAME_OVER) {
      this.triggerGameOver();
    } else if (status === GameStatus.VICTORY) {
      this.triggerVictory();
    } else if (status === GameStatus.MENU) {
      this.stopAmbience();
    }
  }

  /**
   * Periodic scheduler that fires ambient crowd swells and cheers based on game intensity
   */
  private scheduleNextCheer() {
    if (this.cheerTimer) clearTimeout(this.cheerTimer);
    if (!this.isRunning || this.currentStatus !== GameStatus.PLAYING) return;

    // Higher intensity = shorter intervals between crowd cheers & reactions
    // Low: 9 - 14s, High: 3 - 6s
    const minDelay = 3000 + (1 - this.currentIntensity) * 6000;
    const randomDelay = Math.random() * (4000 * (1 - this.currentIntensity * 0.6));
    const delay = minDelay + randomDelay;

    this.cheerTimer = setTimeout(() => {
      if (this.isRunning && this.currentStatus === GameStatus.PLAYING) {
        // Organic crowd cheer swell
        this.triggerCheerSwell(0.3 + this.currentIntensity * 0.6);
        this.scheduleNextCheer();
      }
    }, delay);
  }

  /**
   * Periodic scheduler for basketball chants and rhythmic claps ("DE-FENSE!", etc.)
   */
  private scheduleNextChant() {
    if (this.chantTimer) clearTimeout(this.chantTimer);
    if (!this.isRunning || this.currentStatus !== GameStatus.PLAYING) return;

    // Chants become much more frequent at higher levels/intensity
    const delay = 12000 + (1 - this.currentIntensity) * 14000 + Math.random() * 5000;

    this.chantTimer = setTimeout(() => {
      if (this.isRunning && this.currentStatus === GameStatus.PLAYING) {
        if (Math.random() < 0.6 + this.currentIntensity * 0.4) {
          if (this.currentIntensity > 0.4) {
            this.triggerDefenseChant();
          } else {
            this.triggerRhythmicClaps();
          }
        }
        this.scheduleNextChant();
      }
    }, delay);
  }

  /**
   * Synthesizes a realistic crowd cheer roar burst ("YEEAAAHHH / WOOO!")
   * @param energy Float from 0.1 to 1.0 determining peak loudness and duration
   */
  public triggerCheerSwell(energy = 0.5) {
    if (!this.ctx || !this.ambientGain) this.init();
    if (!this.ctx || !this.ambientGain) return;

    const t = this.ctx.currentTime;
    const duration = 1.0 + energy * 1.5;

    // 1. Filtered noise burst shaped with attack-sustain-decay envelope
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = buffer;

    // Formant vocal filter sweeping up and down ("Ahhh -> Ohhh")
    const vocalFilter = this.ctx.createBiquadFilter();
    vocalFilter.type = 'bandpass';
    vocalFilter.frequency.setValueAtTime(650, t);
    vocalFilter.frequency.exponentialRampToValueAtTime(1300 + energy * 500, t + duration * 0.35);
    vocalFilter.frequency.exponentialRampToValueAtTime(750, t + duration);
    vocalFilter.Q.setValueAtTime(2.2, t);

    // High presence filter for excitement crispness
    const highFilter = this.ctx.createBiquadFilter();
    highFilter.type = 'peaking';
    highFilter.frequency.setValueAtTime(2400, t);
    highFilter.gain.setValueAtTime(energy * 6, t);

    const cheerGain = this.ctx.createGain();
    const peakVolume = 0.12 + energy * 0.28;

    cheerGain.gain.setValueAtTime(0.001, t);
    // Smooth crowd roar attack
    cheerGain.gain.exponentialRampToValueAtTime(peakVolume, t + duration * 0.3);
    // Sustained excitement
    cheerGain.gain.setValueAtTime(peakVolume * 0.9, t + duration * 0.6);
    // Tapering echo
    cheerGain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    noiseSource.connect(vocalFilter);
    vocalFilter.connect(highFilter);
    highFilter.connect(cheerGain);
    cheerGain.connect(this.ambientGain);

    noiseSource.start(t);
    noiseSource.stop(t + duration);

    // 2. Harmonic vocal undertone (multiple detuned oscillators simulating choir of voices)
    const fundamentalFreqs = [220, 277.18, 329.63]; // A3, C#4, E4 Major chord harmony
    fundamentalFreqs.forEach((freq, idx) => {
      const voice = this.ctx!.createOscillator();
      const voiceGain = this.ctx!.createGain();

      voice.type = 'sawtooth';
      voice.frequency.setValueAtTime(freq + (idx * 2 - 2), t);
      // Pitch inflects upwards with excitement
      voice.frequency.linearRampToValueAtTime(freq * 1.08, t + duration * 0.35);
      voice.frequency.exponentialRampToValueAtTime(freq * 0.96, t + duration);

      const voiceFilter = this.ctx!.createBiquadFilter();
      voiceFilter.type = 'lowpass';
      voiceFilter.frequency.setValueAtTime(800 + energy * 400, t);

      voiceGain.gain.setValueAtTime(0.001, t);
      voiceGain.gain.exponentialRampToValueAtTime(0.04 * energy, t + duration * 0.25);
      voiceGain.gain.exponentialRampToValueAtTime(0.001, t + duration * 0.85);

      voice.connect(voiceFilter);
      voiceFilter.connect(voiceGain);
      voiceGain.connect(this.ambientGain!);

      voice.start(t);
      voice.stop(t + duration * 0.85);
    });
  }

  /**
   * Tip-off whistle & arena roar when starting match
   */
  public triggerTipOff() {
    if (!this.ctx || !this.ambientGain) this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;

    // Referee tip-off whistle
    const w1 = this.ctx.createOscillator();
    const w2 = this.ctx.createOscillator();
    const wGain = this.ctx.createGain();

    w1.type = 'sine';
    w2.type = 'sine';
    w1.frequency.setValueAtTime(2600, t + 0.1);
    w2.frequency.setValueAtTime(2900, t + 0.1);

    wGain.gain.setValueAtTime(0.001, t);
    wGain.gain.exponentialRampToValueAtTime(0.28, t + 0.15);
    wGain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);

    w1.connect(wGain);
    w2.connect(wGain);
    wGain.connect(this.ambientGain || this.ctx.destination);

    w1.start(t + 0.1);
    w2.start(t + 0.1);
    w1.stop(t + 0.55);
    w2.stop(t + 0.55);

    // Tip-off opening cheer
    setTimeout(() => {
      this.triggerCheerSwell(0.85);
    }, 280);
  }

  /**
   * Triggered when collecting a B-A-S-K-E-T letter or making an elite play
   */
  public triggerLetterCheer(letterIndex: number) {
    // Letters further into the word generate bigger cheers
    const progressFactor = (letterIndex + 1) / 6;
    const energy = 0.55 + progressFactor * 0.45;
    this.triggerCheerSwell(energy);

    // If completing the word, also play triumphant arena organ chord
    if (letterIndex >= 5) {
      this.triggerArenaFanfare();
    }
  }

  /**
   * Arena Organ Fanfare / Stinger
   */
  public triggerArenaFanfare() {
    if (!this.ctx || !this.ambientGain) return;
    const t = this.ctx.currentTime + 0.15;

    // Triumphant Arena Organ Chords (C5 - G5 - C6)
    const chordNotes = [
      [523.25, 659.25, 783.99], // C Major
      [587.33, 739.99, 880.00], // D Major
      [659.25, 830.61, 987.77], // E Major
      [1046.50, 1318.51, 1567.98] // High C Octave
    ];

    chordNotes.forEach((chord, chordIdx) => {
      const startTime = t + chordIdx * 0.18;
      const dur = chordIdx === 3 ? 0.8 : 0.16;

      chord.forEach(freq => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.001, startTime);
        gain.gain.exponentialRampToValueAtTime(0.12, startTime + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + dur);

        osc.connect(gain);
        gain.connect(this.ambientGain!);

        osc.start(startTime);
        osc.stop(startTime + dur);
      });
    });
  }

  /**
   * Rhythmic arena clapping cadence: CLAP ... CLAP ... CLAP-CLAP-CLAP
   */
  public triggerRhythmicClaps() {
    if (!this.ctx || !this.ambientGain) return;
    const t = this.ctx.currentTime;

    const clapTimes = [0, 0.45, 0.9, 1.2, 1.45];
    clapTimes.forEach(offset => {
      this.playSingleClap(t + offset);
    });
  }

  /**
   * Iconic arena "DE-FENSE!" crowd chant with cadence claps
   */
  public triggerDefenseChant() {
    if (!this.ctx || !this.ambientGain) return;
    const t = this.ctx.currentTime;

    // Low vocal chant pulses ("DE - FENSE!")
    const chantNotes = [
      { freq: 164.81, time: t + 0.05, dur: 0.3 }, // "DE-" (E3)
      { freq: 146.83, time: t + 0.45, dur: 0.45 } // "-FENSE!" (D3)
    ];

    chantNotes.forEach(note => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const filter = this.ctx!.createBiquadFilter();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(note.freq, note.time);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(550, note.time);
      filter.Q.setValueAtTime(2.0, note.time);

      gain.gain.setValueAtTime(0.001, note.time);
      gain.gain.exponentialRampToValueAtTime(0.15, note.time + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, note.time + note.dur);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ambientGain!);

      osc.start(note.time);
      osc.stop(note.time + note.dur);
    });

    // Followed by 3 rapid claps: clap-clap-clap
    setTimeout(() => {
      if (this.ctx && this.ambientGain) {
        const now = this.ctx.currentTime;
        this.playSingleClap(now + 0.05);
        this.playSingleClap(now + 0.28);
        this.playSingleClap(now + 0.52);
      }
    }, 950);
  }

  /**
   * Single synthetic stadium clap from thousands of hands
   */
  private playSingleClap(time: number) {
    if (!this.ctx || !this.ambientGain) return;

    const bufferSize = Math.floor(this.ctx.sampleRate * 0.09);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400, time);
    filter.Q.setValueAtTime(1.5, time);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.2, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.09);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ambientGain);

    noise.start(time);
    noise.stop(time + 0.09);
  }

  /**
   * Crowd gasp reaction when player hits a hurdle or rival defender
   */
  public triggerCrowdGasp() {
    if (!this.ctx || !this.ambientGain) return;
    const t = this.ctx.currentTime;

    const bufferSize = Math.floor(this.ctx.sampleRate * 0.65);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    // Pitch sweeps downward ("OOOHHH...")
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(950, t);
    filter.frequency.exponentialRampToValueAtTime(420, t + 0.55);
    filter.Q.setValueAtTime(2.5, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.exponentialRampToValueAtTime(0.22, t + 0.12);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.65);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ambientGain);

    noise.start(t);
    noise.stop(t + 0.65);
  }

  /**
   * Championship victory standing ovation
   */
  private triggerVictory() {
    this.triggerCheerSwell(1.0);
    this.triggerArenaFanfare();

    // Secondary wave of cheering
    setTimeout(() => {
      this.triggerCheerSwell(0.95);
      this.triggerRhythmicClaps();
    }, 1400);

    setTimeout(() => {
      this.triggerCheerSwell(1.0);
    }, 3200);
  }

  /**
   * Game Over disappointment groan
   */
  private triggerGameOver() {
    if (this.cheerTimer) clearTimeout(this.cheerTimer);
    if (this.chantTimer) clearTimeout(this.chantTimer);

    // Collective arena groans + fades down
    this.triggerCrowdGasp();

    if (this.ctx && this.ambientGain) {
      const t = this.ctx.currentTime;
      this.ambientGain.gain.cancelScheduledValues(t);
      this.ambientGain.gain.setTargetAtTime(0.02, t, 1.2);
    }
  }

  /**
   * Stops and resets all ambient nodes
   */
  public stopAmbience() {
    this.isRunning = false;
    if (this.cheerTimer) clearTimeout(this.cheerTimer);
    if (this.chantTimer) clearTimeout(this.chantTimer);

    if (this.ctx && this.ambientGain) {
      const t = this.ctx.currentTime;
      this.ambientGain.gain.cancelScheduledValues(t);
      this.ambientGain.gain.setTargetAtTime(0.001, t, 0.4);
    }

    setTimeout(() => {
      if (!this.isRunning) {
        if (this.murmurSource) {
          try {
            this.murmurSource.stop();
            this.murmurSource.disconnect();
          } catch {}
          this.murmurSource = null;
        }
        if (this.roomDroneOsc) {
          try {
            this.roomDroneOsc.stop();
            this.roomDroneOsc.disconnect();
          } catch {}
          this.roomDroneOsc = null;
        }
      }
    }, 500);
  }

  /**
   * Toggle mute
   */
  public setMute(muted: boolean) {
    this.isMuted = muted;
    if (this.ctx && this.ambientGain) {
      const t = this.ctx.currentTime;
      this.ambientGain.gain.setTargetAtTime(muted ? 0 : 0.2 + this.currentIntensity * 0.2, t, 0.1);
    }
  }

  /**
   * Sets volume multiplier
   */
  public setVolume(volume: number) {
    const clamped = Math.max(0, Math.min(1, volume));
    this.isMuted = clamped === 0;
    if (this.ctx && this.ambientGain) {
      const t = this.ctx.currentTime;
      const targetGain = clamped * (0.2 + this.currentIntensity * 0.2);
      this.ambientGain.gain.setTargetAtTime(targetGain, t, 0.05);
    }
  }
}

export const ambientAudio = new AmbientAudioManager();
