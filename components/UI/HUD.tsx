/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Heart, Zap, Trophy, Flame, Play, ArrowUpCircle, Activity, PlusCircle, RotateCcw, Sparkles, Volume2, VolumeX, Gauge, Shirt } from 'lucide-react';
import { useStore } from '../../store';
import { GameStatus, GEMINI_COLORS, ShopItem, RUN_SPEED_BASE, BASKET_TARGET, SKINS, getDailySeedLabel } from '../../types';
import { audio } from '../System/Audio';
import { ambientAudio } from '../System/AmbientAudio';
import { crowdAudioController } from '../System/CrowdAudioController';
import { ScoreMultiplierBadge } from './ScoreMultiplierBadge';
import { PauseMenu } from './PauseMenu';

// Animated score count-up (quick tween on every score change)
const AnimatedNumber: React.FC<{ value: number; className?: string; id?: string }> = ({ value, className, id }) => {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);
  const rafRef = useRef(0);

  useEffect(() => {
    const from = prevRef.current;
    const to = value;
    if (from === to) {
      setDisplay(to);
      return;
    }
    const start = performance.now();
    cancelAnimationFrame(rafRef.current);
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 350);
      const eased = t * t * (3 - 2 * t);
      setDisplay(Math.round(from + (to - from) * eased));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        prevRef.current = to;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value]);

  return <span id={id} className={className}>{display.toLocaleString()}</span>;
};

/* ------------------------------------------------------------------ */
/*  SLAM CAM dunk timing mini-game (release at the sweet spot)        */
/* ------------------------------------------------------------------ */
const DunkTimingMeter: React.FC = () => {
  const isDunkSlowMo = useStore(state => state.isDunkSlowMo);
  const dunkCamTarget = useStore(state => state.dunkCamTarget);
  const [pos, setPos] = useState(0.5);
  const locked = useRef(false);

  useEffect(() => {
    if (!isDunkSlowMo) {
      locked.current = false;
      setPos(0.5);
      return;
    }
    locked.current = false;
    const start = performance.now();
    let raf = 0;
    let alive = true;
    let started = false;
    const tick = (now: number) => {
      if (!alive) return;
      if (!started) {
        started = true;
        raf = requestAnimationFrame(tick);
        return;
      }
      setPos(((((now - start) * 0.9) % 1.0) + 1.0) % 1.0);
      raf = requestAnimationFrame(tick);
    };
    const startDelay = window.setTimeout(() => { raf = requestAnimationFrame(tick); }, 300);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      clearTimeout(startDelay);
    };
  }, [isDunkSlowMo]);

  const resolve = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const game = useStore.getState();
    if (!game.isDunkSlowMo || locked.current) return;
    locked.current = true;

    const distToCenter = Math.abs(pos - 0.5);
    let zone: 'perfect' | 'good' | 'miss' = 'miss';
    if (distToCenter < 0.1) zone = 'perfect';
    else if (distToCenter < 0.26) zone = 'good';

    window.dispatchEvent(new CustomEvent('dunk-timing', {
      detail: { zone, position: game.dunkCamTarget }
    }));
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.key === ' ' || e.key === 'ArrowUp') && useStore.getState().isDunkSlowMo) {
        e.preventDefault();
        resolve();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos]);

  if (!isDunkSlowMo) return null;

  return (
    <div className="absolute left-1/2 -translate-x-1/2 bottom-24 md:bottom-28 pointer-events-auto flex flex-col items-center z-[60]">
      <button
        onClick={resolve}
        className="dunk-meter relative overflow-hidden"
        style={{ width: 'min(72vw, 320px)', height: 28 }}
        title="Dunk timing!"
      >
        <div className="absolute inset-y-0 dunk-meter-perfect" style={{ left: '46%', width: '8%' }} />
        <div className="absolute inset-y-0 dunk-meter-good-l" style={{ left: '37%', width: '9%' }} />
        <div className="absolute inset-y-0 dunk-meter-good-r" style={{ left: '54%', width: '9%' }} />
        <div className="dunk-meter-marker absolute top-0 bottom-0" style={{ left: `${pos * 100}%` }} />
      </button>
      <div className="font-cyber text-[10px] md:text-[11px] font-bold tracking-[0.3em] uppercase text-amber-200 mt-2 anim-blink">
        <span className="keycap">SPACE</span> Release at the Sweet Spot
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Mini cinematic banner played on quarter advances & match start     */
/* ------------------------------------------------------------------ */

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
    description: "Unlock 'He's On Fire!': Press Enter or tap to blaze through obstacles for 5s.",
    cost: 3000,
    icon: Flame,
    oneTime: true
  }
];

/* ------------------------------------------------------------------ */
/*  Mini cinematic banner played on quarter advances & match start     */
/* ------------------------------------------------------------------ */
const CenterBanner: React.FC<{ text: string; sub?: string; accent?: 'orange' | 'gold' | 'red' }> = ({ text, sub, accent = 'orange' }) => {
  const bar =
    accent === 'gold'
      ? { from: 'from-amber-400/80', to: 'to-yellow-600/80' }
      : accent === 'red'
      ? { from: 'from-red-500/80', to: 'to-red-800/80' }
      : { from: 'from-orange-500/80', to: 'to-red-600/80' };
  const glow =
    accent === 'gold'
      ? 'text-amber-300 glow-amber'
      : accent === 'red'
      ? 'text-red-300'
      : 'text-orange-300 glow-orange';

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-40">
      <div className="anim-slam-jam flex flex-col items-center">
        {/* Horizontal strike lines */}
        <div className={`w-64 md:w-96 h-1.5 mb-3 anim-strike bg-gradient-to-r ${bar.from} ${bar.to}`} />
        <span className={`font-athletic text-4xl md:text-6xl font-black tracking-[0.18em] text-outline ${glow}`}>
          {text}
        </span>
        {sub && (
          <span className="mt-2 font-cyber text-xs md:text-sm tracking-[0.35em] text-white/85 text-outline-thin uppercase">
            {sub}
          </span>
        )}
        <div className={`w-64 md:w-96 h-1.5 mt-3 anim-strike bg-gradient-to-r ${bar.to} ${bar.from}`} />
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  PRO LOCKER ROOM — halftime shop                                   */
/* ------------------------------------------------------------------ */
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
    <div className="absolute inset-0 z-[100] pointer-events-auto overflow-y-auto flex items-center justify-center p-4 menu-splash-bg">
      <div className="scanlines relative w-full max-w-4xl panel-angle-right bg-[#0a0f28]/92 border border-orange-500/30 p-6 md:p-8 shadow-[0_0_80px_rgba(255,90,20,0.25)] anim-panel-pop" style={{ clipPath: 'polygon(18px 0, 100% 0, 100% calc(100% - 18px), calc(100% - 18px) 100%, 0 100%, 0 18px)' }}>
        {/* Ambient glow blobs */}
        <div className="absolute -top-20 -right-20 w-56 h-56 bg-orange-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-56 h-56 bg-blue-600/25 rounded-full blur-3xl pointer-events-none" />

        <div className="text-center mb-6 relative">
          <div className="inline-flex items-center space-x-2 bg-orange-500/15 border border-orange-500/40 px-4 py-1.5 rounded-full text-orange-300 text-xs md:text-sm font-cyber font-bold tracking-[0.3em] uppercase mb-2">
            <Flame className="w-4 h-4 fill-orange-500" />
            <span>Half-Time Gear Up</span>
          </div>
          <h2 className="text-4xl md:text-6xl font-black text-white font-athletic tracking-[0.1em] glow-orange">
            PRO LOCKER ROOM
          </h2>
          <div className="flex items-center justify-center text-amber-300 font-semibold mt-3">
            <span className="text-xs md:text-sm mr-2 uppercase tracking-[0.2em] text-slate-300">Available match points</span>
            <AnimatedNumber value={score} className="text-xl md:text-3xl font-black glow-amber score-ticker" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5 mb-8 relative">
          {items.map(item => {
            const Icon = item.icon;
            const canAfford = score >= item.cost;
            return (
              <div key={item.id} className={`shop-item ${canAfford ? 'shop-item-buyable' : 'shop-item-locked'} bg-gradient-to-b from-[#141c3f] to-[#0a0f28] border ${canAfford ? 'border-orange-500/50' : 'border-white/10'} p-5 flex flex-col items-center text-center`}>
                <div className={`p-3.5 rounded-2xl mb-3 ${canAfford ? 'bg-orange-500/20 text-orange-300' : 'bg-white/5 text-slate-500'}`}>
                  <Icon className="w-7 h-7" />
                </div>
                <h3 className="text-lg md:text-xl font-black text-white font-athletic tracking-[0.1em] mb-1">{item.name}</h3>
                <p className={`text-xs md:text-sm mb-4 min-h-12 flex items-center justify-center leading-relaxed ${canAfford ? 'text-slate-300' : 'text-slate-500'}`}>
                  {item.description}
                </p>
                <button
                  onClick={() => buyItem(item.id as any, item.cost)}
                  disabled={!canAfford}
                  className={`btn-game w-full py-2.5 px-4 text-sm md:text-base ${
                    canAfford ? 'btn-primary' : 'bg-slate-800/60 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  {item.cost.toLocaleString()} PTS
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex justify-center relative">
          <button
            onClick={closeShop}
            className="btn-game btn-primary flex items-center px-10 md:px-14 py-3.5 text-lg md:text-2xl"
          >
            Back to Court <Play className="ml-3 w-5 h-5 fill-white" />
            <span className="btn-shine" />
          </button>
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  PROGRESSION: daily seed tag (same obstacle layout all day)         */
/* ------------------------------------------------------------------ */
const DailySeedTag: React.FC<{ className?: string }> = ({ className = '' }) => (
  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-slate-500/30 bg-black/25 text-slate-400 font-cyber text-[9px] font-bold tracking-[0.2em] uppercase ${className}`} title="Today's daily seeded layout — everyone plays the same court graph today">
    🎲 Daily Seed {getDailySeedLabel()}
  </span>
);

/* ------------------------------------------------------------------ */
/*  Full screen overlays (MENU / GAME OVER / VICTORY)                 */
/* ------------------------------------------------------------------ */
const ScoreStat: React.FC<{ label: string; value: string; color?: string }> = ({ label, value, color = 'text-white' }) => (
  <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 last:border-0">
    <span className="text-[11px] md:text-xs font-cyber font-bold tracking-[0.25em] uppercase text-slate-400">{label}</span>
    <span className={`font-athletic text-xl md:text-2xl score-ticker ${color}`}>{value}</span>
  </div>
);

/* ------------------------------------------------------------------ */
/*  MENU HERO: live 3D jersey preview of the selected skin            */
/* ------------------------------------------------------------------ */
const HERO_HEAD_GEO = new THREE.SphereGeometry(0.22, 20, 20);
const HERO_TORSO_GEO = new THREE.CylinderGeometry(0.21, 0.28, 0.62, 10);
const HERO_SHORTS_GEO = new THREE.CylinderGeometry(0.26, 0.3, 0.3, 10);
const HERO_LEG_GEO = new THREE.BoxGeometry(0.12, 0.34, 0.12);
const HERO_SHOE_GEO = new THREE.BoxGeometry(0.16, 0.1, 0.3);
const HERO_ARM_GEO = new THREE.BoxGeometry(0.1, 0.34, 0.1);
const HERO_HEADBAND_GEO = new THREE.TorusGeometry(0.2, 0.045, 8, 24);
const HERO_BALL_GEO = new THREE.SphereGeometry(0.24, 20, 20);

const HeroFigure: React.FC<{ jersey: string; shorts: string; accent: string }> = ({ jersey, shorts, accent }) => {
  const group = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!group.current) return;
    group.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.7) * 0.35 + Math.PI * 0.12;
    group.current.position.y = Math.sin(state.clock.elapsedTime * 1.4) * 0.06;
  });
  return (
    <group ref={group} position={[0, -0.4, 0]}>
      <mesh castShadow geometry={HERO_LEG_GEO} position={[-0.1, -0.35, 0]}><meshStandardMaterial color="#1e293b" /></mesh>
      <mesh castShadow geometry={HERO_LEG_GEO} position={[0.1, -0.35, 0]}><meshStandardMaterial color="#1e293b" /></mesh>
      <mesh geometry={HERO_SHOE_GEO} position={[-0.12, -0.58, 0.06]}><meshStandardMaterial color="#ffffff" /></mesh>
      <mesh geometry={HERO_SHOE_GEO} position={[0.12, -0.58, 0.06]}><meshStandardMaterial color="#ffffff" /></mesh>
      <mesh geometry={HERO_ARM_GEO} position={[-0.28, -0.05, 0]} rotation={[0, 0, 0.25]}><meshStandardMaterial color={jersey} /></mesh>
      <mesh geometry={HERO_ARM_GEO} position={[0.28, -0.05, 0]} rotation={[0, 0, -0.25]}><meshStandardMaterial color={jersey} /></mesh>
      <mesh castShadow geometry={HERO_TORSO_GEO} position={[0, 0.02, 0]}><meshStandardMaterial color={jersey} /></mesh>
      <mesh geometry={HERO_SHORTS_GEO} position={[0, -0.28, 0]}><meshStandardMaterial color={shorts} /></mesh>
      <mesh geometry={HERO_HEAD_GEO} position={[0, 0.42, 0]}><meshStandardMaterial color="#c68642" /></mesh>
      <mesh geometry={HERO_HEADBAND_GEO} position={[0, 0.45, 0]} rotation={[Math.PI / 2, 0, 0]}><meshStandardMaterial color={accent} /></mesh>
      <mesh geometry={HERO_BALL_GEO} position={[0.42, 0.18, 0.12]}><meshStandardMaterial color="#f97316" /></mesh>
    </group>
  );
};

const MenuHero: React.FC<{ skinId: string }> = ({ skinId }) => {
  const skin = SKINS.find(s => s.id === skinId) || SKINS[0];
  return (
    <div className="pointer-events-none absolute right-2 md:right-6 bottom-6 w-24 h-36 md:w-32 md:h-48 opacity-90" aria-hidden>
      <Canvas dpr={[1, 2]} camera={{ position: [0.4, 1.7, 4.4], fov: 34 }} gl={{ alpha: true, antialias: true }}>
        <ambientLight intensity={1.1} />
        <directionalLight position={[2.5, 4, 3]} intensity={1.4} color="#fff3df" />
        <pointLight position={[-3, 1, -2]} intensity={0.5} color="#bae6fd" />
        <HeroFigure jersey={skin.jersey} shorts={skin.shorts} accent={skin.accent} />
      </Canvas>
    </div>
  );
};

const MenuScreen: React.FC<{ startGame: () => void; isMuted: boolean; onToggleMute: (e: React.MouseEvent) => void }> = ({ startGame, isMuted, onToggleMute }) => {
  const { skinId, setSkin, bestDistance, dailyBest, playDailyChallenge } = useStore();
  const unlockedPref = bestDistance;
  const unlockedSkins = SKINS.filter(s => unlockedPref >= s.unlockAtBest);

  return (
    <div id="menu-screen" className="menu-splash-bg scanlines absolute inset-0 flex items-center justify-center z-[100] p-4 pointer-events-auto overflow-hidden">
      <MenuHero skinId={skinId} />
      {/* Animated court circle decorations */}
      <div className="menu-court-line w-[130vw] h-[130vw] -top-[115vw] left-1/2 -translate-x-1/2" />
      <div className="menu-court-line w-[90vw] h-[90vw] -bottom-[80vw] -left-[30vw]" />
      <div className="menu-court-line w-[80vw] h-[80vw] -bottom-[70vw] -right-[30vw]" />
      {/* Vignette */}
      <div className="vignette-overlay" />

      <div className="relative w-full max-w-lg anim-panel-pop">
        {/* Top badge */}
        <div className="flex justify-center mb-2">
          <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-orange-500/20 border border-orange-400/40 text-orange-300 text-[11px] font-cyber font-bold tracking-[0.35em] uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-ping" />
            Daylight Arena Championship
          </div>
        </div>
        <div className="flex justify-center mb-4">
          <DailySeedTag />
        </div>

        {/* Title block */}
        <div className="text-center relative">
          <div className="w-16 h-16 mx-auto bg-gradient-to-b from-[#263a75] to-[#0d1534] border border-orange-500/40 rounded-2xl flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(255,120,40,0.35)]">
            <span className="text-3xl">🏀</span>
          </div>
          <h1 className="font-athletic text-6xl md:text-7xl font-black leading-none text-white glow-orange tracking-[0.06em]">
            SLAM RUNNER
          </h1>
          <div className="flex items-center justify-center gap-3 mt-3">
            <div className="h-px w-14 bg-gradient-to-r from-transparent to-orange-500/70" />
            <p className="font-cyber text-xs md:text-sm text-orange-200 font-bold tracking-[0.4em] uppercase">Varsity Endurance</p>
            <div className="h-px w-14 bg-gradient-to-l from-transparent to-orange-500/70" />
          </div>
        </div>

        {/* Body */}
        <div className="mt-7">
          {/* Objective badges */}
          <div className="grid grid-cols-3 gap-2.5 mb-7">
            <div className="panel-angle bg-gradient-to-b from-[#131b3c]/95 to-[#0a0f28]/95 border border-white/10 p-3 text-center">
              <span className="text-2xl">🏀</span>
              <p className="mt-1.5 text-[11px] font-cyber font-bold text-orange-300 uppercase tracking-widest">Dribble</p>
            </div>
            <div className="panel-angle bg-gradient-to-b from-[#131b3c]/95 to-[#0a0f28]/95 border border-white/10 p-3 text-center">
              <span className="text-2xl">🛡️</span>
              <p className="mt-1.5 text-[11px] font-cyber font-bold text-sky-300 uppercase tracking-widest">Dodge</p>
            </div>
            <div className="panel-angle bg-gradient-to-b from-[#131b3c]/95 to-[#0a0f28]/95 border border-white/10 p-3 text-center">
              <span className="text-2xl">🔥</span>
              <p className="mt-1.5 text-[11px] font-cyber font-bold text-red-300 uppercase tracking-widest">Slam Dunk</p>
            </div>
          </div>

          {/* Main action button */}
          <button
            id="menu-start-btn"
            onClick={() => {
              audio.init();
              ambientAudio.startAmbience();
              crowdAudioController.init();
              startGame();
            }}
            className="btn-game btn-primary w-full py-4 px-6 text-2xl md:text-3xl font-black flex items-center justify-center"
          >
            <span className="relative z-10 flex items-center tracking-[0.12em]">
              TIP-OFF MATCH <Play className="ml-3 w-6 h-6 fill-white" />
            </span>
            <span className="btn-shine" />
          </button>

          {/* Daily Challenge: same seeded layout all day */}
          <button
            id="menu-daily-btn"
            onClick={() => {
              audio.init();
              ambientAudio.startAmbience();
              crowdAudioController.init();
              playDailyChallenge();
            }}
            className="mt-3 w-full btn-game btn-secondary flex items-center justify-center py-3 gap-2 text-base tracking-[0.2em]"
            title="Play today's seeded layout — best distance is tracked per seed"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span className="font-black">DAILY CHALLENGE</span>
            <span className="font-mono text-[11px] text-amber-200 bg-black/30 px-1.5 py-0.5 rounded-full">SEED {getDailySeedLabel()}</span>
          </button>
          <div className="mt-1.5 text-center">
            <DailySeedTag className="text-[8px]" />
            {dailyBest > 0 && (
              <span className="ml-2 inline-block font-athletic text-xs font-black text-amber-300 tracking-[0.2em]">
                Today&apos;s Best: {Math.floor(dailyBest)} YD 🏅
              </span>
            )}
          </div>

          {/* Audio toggle */}
          <button
            id="menu-audio-toggle"
            onClick={onToggleMute}
            className="mt-3 w-full btn-game btn-secondary flex items-center justify-center py-2.5 gap-2 text-sm tracking-[0.25em]"
            title={isMuted ? "Unmute Arena Sounds" : "Mute Arena Sounds"}
            aria-label={isMuted ? "Unmute Arena Sounds" : "Mute Arena Sounds"}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-orange-300" />}
            {isMuted ? 'ARENA SOUND OFF' : 'ARENA SOUND ON'}
          </button>

          {/* Jersey skin selector */}
          <div className="mt-4 panel-angle bg-gradient-to-b from-[#131b3c]/95 to-[#0a0f28]/95 border border-white/10 p-3">
            <div className="flex items-center justify-between mb-2.5">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-cyber font-bold text-slate-300 uppercase tracking-[0.25em]">
                <Shirt className="w-3.5 h-3.5 text-orange-300" /> Jersey
              </span>
              <span className="text-[10px] font-mono text-slate-500 font-bold">
                BEST {Math.floor(bestDistance)} YD
              </span>
            </div>
            <div className="flex gap-2 justify-between">
              {SKINS.map(s => {
                const unlocked = unlockedSkins.some(u => u.id === s.id);
                const selected = skinId === s.id;
                return (
                  <button
                    key={s.id}
                    disabled={!unlocked}
                    onClick={() => { audio.playClick(); setSkin(s.id); }}
                    title={unlocked ? s.name : `Unlock at ${s.unlockAtBest} YD`}
                    className={`flex-1 flex flex-col items-center gap-1.5 py-2 px-1 border rounded-lg transition-all ${
                      selected ? 'border-orange-400 bg-orange-500/15 shadow-[0_0_14px_rgba(255,140,40,0.35)]'
                      : 'border-white/10 bg-black/20 hover:border-white/25'
                    } ${unlocked ? 'cursor-pointer' : 'cursor-not-allowed opacity-45'}`}
                  >
                    <span className="w-7 h-9 rounded-sm border border-black/40 shadow-inner" style={{ background: `linear-gradient(0deg, ${s.shorts} 0%, ${s.jersey} 62%)`, borderTop: `3px solid ${s.accent}` }} />
                    <span className="text-[9px] font-cyber font-bold uppercase tracking-wider text-slate-300">
                      {selected ? 'ACTIVE' : unlocked ? s.name : `🔒 ${s.unlockAtBest}`}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Controls guide */}
          <div className="mt-6 text-center space-y-1.5">
            <p className="text-slate-300 text-xs font-bold tracking-[0.2em] uppercase">
              <span className="keycap">←</span> <span className="keycap">→</span> Dribble &nbsp;•&nbsp; <span className="keycap">↑</span>/<span className="keycap">Space</span> Dunk &nbsp;•&nbsp; <span className="keycap">Enter</span> On-Fire &nbsp;•&nbsp; <span className="keycap">Swipe</span> Mobile
            </p>
            <p className="text-slate-500 text-[11px] font-medium tracking-wide">
              Collect <b className="text-orange-300">B-A-S-K-E-T</b> letters to advance quarters, boost your pace, and reach the pro locker room.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const GameOverScreen: React.FC<{ restart: () => void; score: number; level: number; gemsCollected: number; distance: number; bestDistance: number; isNewRecord: boolean; isDailyChallenge: boolean; isDailyRecord: boolean; dailyBest: number }> = ({ restart, score, level, gemsCollected, distance, bestDistance, isNewRecord, isDailyChallenge, isDailyRecord, dailyBest }) => (
  <div className="absolute inset-0 z-[100] text-white pointer-events-auto flex items-center justify-center p-4 bg-black/55 scanlines">
    <div className="scanlines relative w-full max-w-md border border-red-500/40 bg-gradient-to-b from-[#1a0b15]/95 to-[#0a0610]/98 p-7 md:p-8 shadow-[0_0_90px_rgba(255,40,40,0.2)] anim-panel-pop" style={{ clipPath: 'polygon(18px 0, 100% 0, 100% calc(100% - 18px), calc(100% - 18px) 100%, 0 100%, 0 18px)' }}>
      <div className="absolute -top-16 -right-16 w-48 h-48 bg-red-600/20 rounded-full blur-3xl pointer-events-none" />

      <div className="text-center mb-5">
        <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-red-500/15 border border-red-500/40 text-red-300 text-xs font-cyber font-bold tracking-[0.3em] uppercase mb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 anim-blink" />
          Final Buzzer
        </div>
        <h1 className="font-athletic text-5xl md:text-6xl font-black tracking-[0.08em] text-white anim-flicker">
          GAME OVER
        </h1>
        <div className="mx-auto mt-3 h-1 w-40 bg-gradient-to-r from-red-600 to-transparent" />
      </div>

      {isNewRecord && (
        <div className="mb-4 text-center">
          <span className="inline-flex items-center gap-2 font-athletic text-lg md:text-xl font-black tracking-[0.15em] text-amber-300 glow-amber anim-slam-jam border border-amber-400/50 bg-amber-500/10 px-5 py-1.5 rounded-full">
            <Sparkles className="w-4 h-4" /> NEW RECORD! <Sparkles className="w-4 h-4" />
          </span>
        </div>
      )}

      {isDailyRecord && (
        <div className="mb-4 text-center">
          <span className="inline-flex items-center gap-2 font-athletic text-lg md:text-xl font-black tracking-[0.15em] text-amber-300 glow-amber anim-slam-jam border border-amber-400/50 bg-amber-500/10 px-5 py-1.5 rounded-full">
            <Trophy className="w-4 h-4" /> NEW DAILY BEST <Trophy className="w-4 h-4" />
          </span>
        </div>
      )}

      <div className="mb-6 border border-white/10 bg-black/30">
        <ScoreStat label="Quarter Reached" value={`Q${level} / 3`} color="text-red-300" />
        <ScoreStat label="Basketballs Collected" value={`${gemsCollected}`} color="text-orange-300" />
        <ScoreStat label="Best Court Distance" value={`${Math.max(Math.floor(bestDistance), Math.floor(distance))} YDS`} color="text-sky-300" />
        {isDailyChallenge && (
          <ScoreStat label="Daily Challenge Best" value={`${Math.floor(dailyBest)} YDS`} color="text-amber-300" />
        )}
        <div className="flex items-center justify-between px-4 py-3.5 bg-gradient-to-r from-red-900/40 to-transparent">
          <span className="font-cyber font-bold text-[11px] md:text-xs tracking-[0.25em] uppercase text-red-200">Final Score</span>
          <AnimatedNumber value={score} className="font-athletic text-3xl md:text-4xl text-red-300 score-ticker glow-orange" />
        </div>
      </div>
      <div className="flex justify-center mb-3"><DailySeedTag /></div>

      <button
        onClick={() => {
          audio.init();
          ambientAudio.startAmbience();
          restart();
        }}
        className="btn-game btn-primary w-full py-3.5 text-xl font-black flex items-center justify-center tracking-[0.1em]"
      >
        <RotateCcw className="mr-3 w-5 h-5" /> Play Again / Rematch
        <span className="btn-shine" />
      </button>
      <p className="mt-3 text-center text-[11px] text-slate-500 font-medium">You gave it everything. The crowd waits for your return.</p>
    </div>
  </div>
);

const VictoryScreen: React.FC<{ restart: () => void; score: number; gemsCollected: number; distance: number; bestDistance: number; isNewRecord: boolean; isDailyRecord: boolean }> = ({ restart, score, gemsCollected, distance, bestDistance, isNewRecord, isDailyRecord }) => (
  <div className="absolute inset-0 z-[100] text-white pointer-events-auto flex items-center justify-center p-4 bg-black/55 scanlines">
    <div className="scanlines relative w-full max-w-lg border border-amber-400/50 bg-gradient-to-b from-[#1c1708]/95 to-[#0d0a03]/98 p-7 md:p-8 text-center shadow-[0_0_100px_rgba(255,190,40,0.22)] anim-panel-pop" style={{ clipPath: 'polygon(18px 0, 100% 0, 100% calc(100% - 18px), calc(100% - 18px) 100%, 0 100%, 0 18px)' }}>
      <div className="absolute -top-16 -right-16 w-48 h-48 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-yellow-600/20 rounded-full blur-3xl pointer-events-none" />

      <div className="w-20 h-20 bg-gradient-to-b from-[#2a2410] to-[#0f0c02] border border-amber-400/50 rounded-3xl mx-auto flex items-center justify-center mb-4 text-4xl anim-pulse-glow shadow-[0_0_40px_rgba(255,200,60,0.35)]">
        🏆
      </div>
      <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-300 text-xs font-cyber font-bold tracking-[0.3em] uppercase mb-3">
        <Sparkles className="w-3.5 h-3.5" /> Championship Victory
      </div>
      <h1 className="font-athletic text-5xl md:text-6xl font-black tracking-[0.06em] text-white glow-amber">CHAMPIONS!</h1>
      <p className="text-orange-300 font-cyber font-bold text-xs md:text-sm tracking-[0.3em] uppercase mt-2 mb-6">MVP Performance — You Conquered the Court</p>

      {isNewRecord && (
        <div className="mb-6 inline-flex items-center gap-2 font-athletic text-lg md:text-xl font-black tracking-[0.15em] text-amber-300 glow-amber anim-slam-jam border border-amber-400/50 bg-amber-500/10 px-6 py-2 rounded-full">
          <Sparkles className="w-4 h-4" /> NEW RECORD! <Sparkles className="w-4 h-4" />
        </div>
      )}
      {isDailyRecord && (
        <div className="mb-6 inline-flex items-center gap-2 font-athletic text-lg md:text-xl font-black tracking-[0.15em] text-amber-300 glow-amber anim-slam-jam border border-amber-400/50 bg-amber-500/10 px-6 py-2 rounded-full">
          <Trophy className="w-4 h-4" /> NEW DAILY BEST <Trophy className="w-4 h-4" />
        </div>
      )}

      <div className="mb-6 border border-amber-400/20 bg-black/30 text-left">
        <ScoreStat label="Championship Score" value={score.toLocaleString()} color="text-amber-300" />
        <ScoreStat label="Basketballs" value={`${gemsCollected}`} color="text-orange-300" />
        <ScoreStat label="Best Court Distance" value={`${Math.max(Math.floor(bestDistance), Math.floor(distance))} YDS`} color="text-sky-300" />
      </div>

      <button
        onClick={() => {
          audio.init();
          ambientAudio.startAmbience();
          restart();
        }}
        className="btn-game btn-primary w-full py-4 text-xl font-black flex items-center justify-center tracking-[0.1em]"
        style={{ background: 'linear-gradient(180deg,#ffd166 0%,#f5a623 55%,#b97c00 100%)' }}
      >
        <Play className="mr-3 w-5 h-5 fill-white" /> Start New Tournament
        <span className="btn-shine" />
      </button>
    </div>
  </div>
);

/* ------------------------------------------------------------------ */
/*  Main HUD                                                          */
/* ------------------------------------------------------------------ */
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
    dribbleMultiplier,
    pauseGame,
    resumeGame,
    isMuted,
    toggleMute,
    bestDistance,
    isNewRecord,
    setSkin,
    isIntro,
    endIntro,
    dailyBest,
    isDailyChallenge,
    isDailyRecord
  } = useStore();

  // Respect OS-level "reduce motion" preference (a11y)
  const reducedMotion =
    typeof matchMedia !== 'undefined' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches;

  const [dunkAlert, setDunkAlert] = useState<{ text: string; points: number; multiplier?: number; id: number } | null>(null);
  const [damageKey, setDamageKey] = useState(0);
  const [tipOff, setTipOff] = useState<{ key: number } | null>(null);
  const [runIn, setRunIn] = useState<{ key: number } | null>(null);
  const [quarterNote, setQuarterNote] = useState<{ key: number; q: number } | null>(null);
  const [showtimeCard, setShowtimeCard] = useState<{ key: number; lane: number } | null>(null);
  const [showtimeMissed, setShowtimeMissed] = useState<{ key: number } | null>(null);
  const [showtimeFlash, setShowtimeFlash] = useState<{ key: number } | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const showtimeTimeout = useRef(0);
  const prevStatus = useRef(status);
  const prevLevel = useRef(level);
  const prevImmortal = useRef(isImmortalityActive);

  // Speed lines (precomputed random streaks)
  const speedLines = useMemo(() => (
    Array.from({ length: 12 }, (_, i) => ({
      id: i,
      top: `${8 + Math.random() * 84}%`,
      duration: `${0.45 + Math.random() * 0.45}s`,
      delay: `${-Math.random() * 0.9}s`,
      width: `${70 + Math.random() * 160}px`,
      opacity: 0.25 + Math.random() * 0.4,
    }))
  ), []);

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

  // Auto-pause when the tab loses focus so the run isn't lost
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) pauseGame();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [pauseGame]);

  // First-run tutorial overlay (dismissed permanently)
  useEffect(() => {
    try {
      if (!localStorage.getItem('slamrunner_tutorial')) setShowTutorial(true);
    } catch {
      setShowTutorial(true);
    }
  }, []);

  const dismissTutorial = () => {
    setShowTutorial(false);
    try {
      localStorage.setItem('slamrunner_tutorial', '1');
    } catch {
      /* ignore */
    }
  };

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

  // Screen red flash when taking damage
  useEffect(() => {
    const handleHit = () => setDamageKey(Date.now());
    window.addEventListener('player-hit', handleHit);
    return () => window.removeEventListener('player-hit', handleHit);
  }, []);

  // "TIP-OFF!" intro splash on every match start
  useEffect(() => {
    if (status === GameStatus.PLAYING && prevStatus.current !== GameStatus.PLAYING) {
      setTipOff({ key: Date.now() });
      setRunIn({ key: Date.now() });
      const t = setTimeout(() => setTipOff(null), 1100);
      return () => clearTimeout(t);
    }
    prevStatus.current = status;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // RUN-IN lock-in: auto-ends the cinematic after 2.6s of PLAYING time.
  // If the player pauses mid-intro, the timer is cancelled & restarts on resume,
  // so input never unlocks in the middle of the camera sweep.
  useEffect(() => {
    if (isIntro && status === GameStatus.PLAYING) {
      const introT = setTimeout(() => {
        setRunIn(null);
        endIntro();
      }, 2600);
      return () => clearTimeout(introT);
    }
  }, [isIntro, status, endIntro]);

  // SHOWTIME LANE checkpoint announce + miss banners
  useEffect(() => {
    const onAnnounce = (e: any) => {
      window.clearTimeout(showtimeTimeout.current);
      showtimeTimeout.current = window.setTimeout(() => setShowtimeCard(null), 2200);
      setShowtimeCard({ key: Date.now(), lane: e.detail?.lane ?? 0 });
    };
    const onMiss = () => {
      window.clearTimeout(showtimeTimeout.current);
      showtimeTimeout.current = window.setTimeout(() => setShowtimeMissed(null), 1400);
      setShowtimeMissed({ key: Date.now() });
      setTimeout(() => setShowtimeCard(null), 300);
    };
    window.addEventListener('showtime-announce', onAnnounce);
    window.addEventListener('showtime-missed', onMiss);
    return () => {
      window.removeEventListener('showtime-announce', onAnnounce);
      window.removeEventListener('showtime-missed', onMiss);
    };
  }, []);

  // GOLDEN OVERDRIVE: orange showtime tint flash the moment Immortality ignites
  useEffect(() => {
    if (isImmortalityActive && !prevImmortal.current) {
      setShowtimeFlash({ key: Date.now() });
      const t = setTimeout(() => setShowtimeFlash(null), 520);
      return () => clearTimeout(t);
    }
    prevImmortal.current = isImmortalityActive;
  }, [isImmortalityActive]);

  // Quarter advance banner
  useEffect(() => {
    if (status === GameStatus.PLAYING && level > 1 && level !== prevLevel.current) {
      setQuarterNote({ key: Date.now(), q: level });
      const t = setTimeout(() => setQuarterNote(null), 1600);
      return () => clearTimeout(t);
    }
    prevLevel.current = level;
  }, [level, status]);

  const target = BASKET_TARGET;
  const isLowLife = lives === 1 && status === GameStatus.PLAYING;
  const showSpeedLines = status === GameStatus.PLAYING && speed >= RUN_SPEED_BASE * 0.98;

  const handleAudioToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleMute();
  };

  if (status === GameStatus.SHOP) {
    return <ShopScreen />;
  }

  // --- MENU SCREEN ---
  if (status === GameStatus.MENU) {
    return <MenuScreen startGame={startGame} isMuted={isMuted} onToggleMute={handleAudioToggle} />;
  }

  // --- GAME OVER SCREEN ---
  if (status === GameStatus.GAME_OVER) {
    return <GameOverScreen restart={restartGame} score={score} level={level} gemsCollected={gemsCollected} distance={distance} bestDistance={bestDistance} isNewRecord={isNewRecord} isDailyChallenge={isDailyChallenge} isDailyRecord={isDailyRecord} dailyBest={dailyBest} />;
  }

  // --- VICTORY SCREEN ---
  if (status === GameStatus.VICTORY) {
    return <VictoryScreen restart={restartGame} score={score} gemsCollected={gemsCollected} distance={distance} bestDistance={bestDistance} isNewRecord={isNewRecord} isDailyRecord={isDailyRecord} />;
  }

  // --- LIVE IN-GAME BROADCAST HUD ---
  return (
    <>
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-3 md:p-5 z-50">
      {/* Damage flash & low-life panic vignette */}
      {!reducedMotion && damageKey > 0 && <div key={damageKey} className="damage-flash" />}
      {!reducedMotion && showtimeFlash && <div key={`sf-${showtimeFlash.key}`} className="showtime-flash" />}
      {isLowLife && (
        <div className="absolute inset-0 pointer-events-none anim-panic" style={{ background: 'radial-gradient(70% 55% at 50% 45%, transparent 55%, rgba(255,30,30,0.28) 100%)' }} />
      )}

      {/* Speed wind streaks */}
      {showSpeedLines && (
        <div className="speed-lines">
          {speedLines.map(l => (
            <div
              key={l.id}
              className="speed-line"
              style={{
                top: l.top,
                width: l.width,
                opacity: l.opacity,
                animationDuration: l.duration,
                animationDelay: l.delay,
              }}
            />
          ))}
        </div>
      )}

      {/* Cinematic overlays */}
      {tipOff && <CenterBanner key={tipOff.key} text="TIP-OFF!" sub="Dribble • Dodge • Slam Dunk" />}
      {isIntro && (
        <div className="absolute top-[42%] left-1/2 -translate-x-1/2 pointer-events-none z-40 anim-slam-jam">
          <div className="font-cyber text-xs md:text-sm font-black tracking-[0.5em] uppercase text-amber-300 text-outline-thin bg-black/50 px-6 py-2 border border-amber-400/40 panel-angle">
            RUN-IN — HANDS OFF THE BALL
          </div>
        </div>
      )}
      {showtimeMissed && (
        <div key={`sm-${showtimeMissed.key}`} className="absolute top-[30%] left-1/2 -translate-x-1/2 pointer-events-none z-40 anim-slam-jam">
          <div className="font-athletic text-3xl md:text-5xl font-black tracking-[0.2em] text-slate-300 text-outline bg-black/55 px-8 py-2 border border-slate-400/40">
            SHOWTIME MISSED
          </div>
          <div className="mt-1.5 text-center font-cyber text-[10px] md:text-xs font-bold tracking-[0.35em] uppercase text-slate-400 bg-black/45 px-4 py-1 text-outline-thin">
            The golden hoop vanished
          </div>
        </div>
      )}
      {showtimeCard && (
        <div key={`st-${showtimeCard.key}`} className="absolute top-[26%] left-1/2 -translate-x-1/2 pointer-events-none z-40 anim-slam-jam">
          <div className="bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-[#271a00] font-athletic text-2xl md:text-4xl px-7 py-1.5 shadow-[0_0_50px_rgba(255,200,30,0.75)] border-2 border-white/80 flex items-center gap-3 tracking-[0.12em] rotate-1" style={{ clipPath: 'polygon(14px 0, 100% 0, calc(100% - 14px) 100%, 0 100%)' }}>
            <span>🏆</span> SHOWTIME LANE <span>🏆</span>
          </div>
          <div className="mt-2 text-center font-cyber text-[10px] md:text-xs font-bold tracking-[0.35em] uppercase text-amber-200 bg-black/60 px-4 py-1 text-outline-thin">
            LAND THE DUNK FOR A GOLDEN 1500-PT SLAM
          </div>
        </div>
      )}
      {quarterNote && <CenterBanner key={quarterNote.key} text={`QUARTER ${quarterNote.q}`} sub="Speed Surge" accent="gold" />}
      {isLowLife && (
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 pointer-events-none z-40">
          <span className="font-cyber text-xs md:text-sm font-black tracking-[0.4em] uppercase text-red-400 anim-blink text-outline-thin">
            ⚠ Stamina Critical ⚠
          </span>
        </div>
      )}

      {/* Top bar */}
      <div className="flex justify-between items-start w-full gap-2">
        {/* Left: Scoreboard */}
        <div className="flex flex-col items-start space-y-2">
          <div className="panel-angle-right bg-gradient-to-b from-[#101a3e]/95 to-[#070b20]/98 border border-orange-500/40 px-4 py-2 hud-panel shadow-[0_6px_24px_rgba(0,0,0,0.5)]">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🏀</span>
              <div>
                <div className="text-[9px] md:text-[11px] font-cyber font-bold text-orange-300 uppercase tracking-[0.3em]">Points</div>
                <AnimatedNumber id="hud-score" value={score} className="text-2xl md:text-4xl font-athletic font-black text-white score-ticker glow-orange leading-none mt-0.5" />
              </div>
              <div className="ml-2 pl-2 border-l border-white/10">
                <div className="text-[9px] font-cyber font-bold text-slate-400 uppercase tracking-widest">Balls</div>
                <div className="text-lg md:text-2xl font-athletic font-black text-amber-300 leading-none mt-0.5">{gemsCollected}</div>
              </div>
            </div>
          </div>

          {/* Dunk streak badge */}
          {dunkStreak > 0 && (
            <div className="panel-angle bg-gradient-to-r from-orange-600 via-amber-500 to-red-600 text-white px-3 py-1.5 flex items-center gap-2 shadow-[0_0_24px_rgba(255,90,20,0.45)] anim-float-in">
              <Flame className="w-3.5 h-3.5 fill-white" />
              <span className="font-athletic text-sm font-black tracking-[0.15em]">
                DUNK STREAK {dunkStreak}X
              </span>
              <span className="hidden sm:inline text-[9px] font-mono font-bold bg-black/25 px-1.5 py-0.5 text-amber-100 tracking-wider">
                {dunkStreak >= 3 ? 'CROWD BEDLAM' : dunkStreak >= 2 ? 'HEATING UP' : 'CROWD HYPED'}
              </span>
            </div>
          )}

          {/* Multiplier combo badge */}
          <ScoreMultiplierBadge />
        </div>

        {/* Center: B-A-S-K-E-T letters + tension */}
        <div className="hidden md:flex flex-col items-center">
          <div id="hud-letters" className="flex space-x-1.5 md:space-x-2.5">
            {target.map((char, idx) => {
              const isCollected = collectedLetters.includes(idx);
              const color = GEMINI_COLORS[idx];
              return (
                <div
                  key={idx}
                  style={{
                    borderColor: isCollected ? color : 'rgba(255,255,255,0.18)',
                    backgroundColor: isCollected ? color : 'rgba(10,14,34,0.85)',
                    color: isCollected ? '#fff' : 'rgba(160,170,200,0.7)',
                    boxShadow: isCollected ? `0 0 18px ${color}88` : '0 2px 8px rgba(0,0,0,0.4)',
                    textShadow: isCollected ? '0 2px 0 rgba(0,0,0,0.4)' : 'none',
                  }}
                  className={`letter-chip ${isCollected ? 'letter-chip-collected' : ''} w-9 h-12 md:w-11 md:h-14 flex items-center justify-center border font-black text-xl md:text-2xl font-athletic`}
                >
                  {char}
                </div>
              );
            })}
          </div>

          {/* Hoop approach tension gauge */}
          {hoopTension > 0.05 && (
            <div className="mt-2 flex flex-col items-center anim-float-in">
              <div className="flex items-center gap-2 text-amber-300 font-cyber text-[9px] md:text-[10px] font-bold tracking-[0.25em] uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                Crowd Tension
                <span className="text-white">{Math.round(hoopTension * 100)}%</span>
              </div>
              <div className="meter-bar mt-1 w-36 md:w-48 h-2">
                <div className="meter-fill" style={{ width: `${hoopTension * 100}%` }} />
              </div>
            </div>
          )}

          {/* On Fire indicator */}
          {isImmortalityActive && (
            <div className="mt-3 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 text-white font-athletic text-lg md:text-2xl px-6 py-1 rounded-full flex items-center gap-2 anim-slam-jam shadow-[0_0_30px_rgba(255,150,30,0.7)]">
              <Flame className="w-5 h-5 fill-white" />
              <span className="tracking-[0.2em]">HE'S ON FIRE!</span>
              <Sparkles className="w-4 h-4 fill-white" />
            </div>
          )}
        </div>

        {/* Right: Hearts, quarter, audio */}
        <div className="flex flex-col items-end space-y-2">
          <div className="panel-angle bg-gradient-to-b from-[#101a3e]/95 to-[#070b20]/98 border border-red-400/30 px-3.5 py-2.5 hud-panel">
            <div className="flex items-center gap-1.5">
              {[...Array(maxLives)].map((_, i) => (
                <Heart
                  key={i}
                  className={`w-5 h-5 md:w-6 md:h-6 transition-colors ${i < lives ? 'text-red-500 fill-red-500 heart-pip' : 'text-white/15 fill-white/10 heart-pip-empty'}`}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="panel-angle bg-gradient-to-b from-[#101a3e]/95 to-[#070b20]/98 border border-white/15 px-3 py-1.5 flex items-center gap-1.5 font-athletic text-base md:text-xl font-black tracking-[0.15em]">
              <span className="text-orange-300">Q{level}</span>
              <span className="text-slate-500 text-xs">/ 3</span>
            </div>
            <button
              id="hud-arena-audio-btn"
              onClick={handleAudioToggle}
              className="pointer-events-auto panel-angle bg-gradient-to-b from-[#101a3e]/95 to-[#070b20]/98 border border-white/15 p-2.5 text-orange-300 active:scale-95 transition-transform flex items-center justify-center"
              title={isMuted ? "Unmute Arena Sound" : "Mute Arena Sound"}
              aria-label={isMuted ? "Unmute Arena Sound" : "Mute Arena Sound"}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile-only letters (compact, below top bar) */}
      <div className="md:hidden flex justify-center mt-3">
        <div className="flex space-x-1.5">
          {target.map((char, idx) => {
            const isCollected = collectedLetters.includes(idx);
            const color = GEMINI_COLORS[idx];
            return (
              <div
                key={idx}
                style={{
                  borderColor: isCollected ? color : 'rgba(255,255,255,0.18)',
                  backgroundColor: isCollected ? color : 'rgba(10,14,34,0.85)',
                  color: isCollected ? '#fff' : 'rgba(160,170,200,0.7)',
                  boxShadow: isCollected ? `0 0 14px ${color}88` : 'none',
                }}
                className={`letter-chip ${isCollected ? 'letter-chip-collected' : ''} w-7 h-9 flex items-center justify-center border font-black text-base font-athletic`}
              >
                {char}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom row: distance + pace meter + hints */}
      <div className="w-full flex justify-between items-end flex-wrap gap-2">
        {/* Mobile tension / on-fire */}
        <div className="md:hidden flex flex-col items-start gap-1.5">
          {hoopTension > 0.05 && (
            <div className="meter-bar w-28 h-1.5">
              <div className="meter-fill" style={{ width: `${hoopTension * 100}%` }} />
            </div>
          )}
          {isImmortalityActive && (
            <span className="font-athletic text-sm text-orange-300 tracking-[0.2em] anim-blink flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 fill-orange-400" /> ON FIRE!
            </span>
          )}
        </div>

        <div className="hidden md:block flex-1" />

        {/* Left control hint */}
        <div className="hidden md:flex flex-col items-start self-end">
          <div className="glass-dark panel-angle px-3 py-2 flex items-center gap-3 text-[10px] font-cyber tracking-[0.2em] text-slate-300">
            <span className="flex items-center gap-1"><span className="keycap">←</span><span className="keycap">→</span> DRIBBLE</span>
            <span className="opacity-30">|</span>
            <span className="flex items-center gap-1"><span className="keycap">↑</span> DUNK</span>
            <span className="opacity-30">|</span>
            <span className="flex items-center gap-1"><span className="keycap">ENTER</span> ON FIRE</span>
            <span className="opacity-30">|</span>
            <span className="flex items-center gap-1"><span className="keycap">ESC</span> PAUSE</span>
          </div>
        </div>

        {/* Pace + distance meter */}
        <div className="flex flex-col items-end gap-1.5 self-end">
          <div className="panel-angle bg-gradient-to-b from-[#101a3e]/95 to-[#070b20]/98 border border-white/15 px-3 py-2 flex items-center gap-2.5 min-w-[210px]">
            <Gauge className="w-4 h-4 text-orange-400" />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-cyber text-[9px] font-bold tracking-[0.25em] uppercase text-slate-400">Pace</span>
                <span className="font-athletic text-sm font-black text-orange-300 score-ticker tracking-wider">
                  {Math.round((speed / RUN_SPEED_BASE) * 100)}%
                </span>
              </div>
              <div className="meter-bar mt-1 h-1.5 w-full">
                <div className="meter-fill" style={{ width: `${Math.min(100, (speed / RUN_SPEED_BASE) * 100)}%` }} />
              </div>
            </div>
            <Zap className="w-3.5 h-3.5 text-amber-300" />
            <div className="font-athletic text-base md:text-lg font-black text-white score-ticker leading-none">
              {Math.floor(distance)}<span className="text-[10px] text-slate-400 ml-0.5">YD</span>
            </div>
          </div>
          {isNewRecord && (
            <div className="self-end mt-1 inline-flex items-center gap-1 font-athletic text-[11px] font-black tracking-[0.25em] text-amber-300 anim-blink drop-shadow-[0_0_8px_rgba(255,200,60,0.8)]">
              <Sparkles className="w-3 h-3 fill-amber-300" /> NEW RECORD
            </div>
          )}
        </div>
      </div>

      {/* Dunk broadcast popup */}
      {dunkAlert && (
        <div
          key={dunkAlert.id}
          className="absolute top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none flex flex-col items-center anim-slam-jam z-30"
        >
          <div className="bg-gradient-to-r from-orange-600 via-amber-500 to-orange-600 text-white font-athletic text-2xl md:text-5xl px-7 py-2.5 shadow-[0_0_60px_rgba(255,120,30,0.65)] border-2 border-white/70 flex items-center gap-3 tracking-[0.15em] -rotate-2" style={{ clipPath: 'polygon(14px 0, 100% 0, calc(100% - 14px) 100%, 0 100%)' }}>
            <span>🏀</span>
            <span className="glow-orange">{dunkAlert.text}</span>
            <span>🔥</span>
          </div>
          <div className="mt-2 bg-black/85 text-amber-300 font-athletic text-lg md:text-2xl px-5 py-0.5 shadow-lg border border-amber-400/40 tracking-wider score-ticker" style={{ clipPath: 'polygon(10px 0, 100% 0, calc(100% - 10px) 100%, 0 100%)' }}>
            +{dunkAlert.points} PTS
            {dunkAlert.multiplier ? <span className="ml-1 text-[60%] text-white/70">x{dunkAlert.multiplier}</span> : null}
          </div>
        </div>
      )}

      {/* Cinematic Slow-Motion Letterboxing & Sideline Broadcast Banner */}
      <div className={`fixed inset-x-0 top-0 pointer-events-none z-50 transition-all duration-300 ease-out ${isDunkSlowMo ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full'}`}>
        <div className="bg-gradient-to-b from-black/95 via-black/80 to-transparent h-12 md:h-16 px-4 md:px-8 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600"></span>
            </span>
            <span className="text-white font-cyber text-xs md:text-sm font-bold tracking-[0.35em] uppercase drop-shadow">SLAM CAM // Side-Profile Replay</span>
          </div>
          <div className="bg-red-600/90 text-white font-cyber text-[10px] md:text-xs font-bold px-3 py-1 rounded-full tracking-wider anim-blink">● 0.2X Slow-Mo</div>
        </div>
      </div>

      <div className={`fixed inset-x-0 bottom-0 pointer-events-none z-50 transition-all duration-300 ease-out ${isDunkSlowMo ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-full'}`}>
        <div className="bg-gradient-to-t from-black/95 via-black/80 to-transparent h-12 md:h-16 px-4 md:px-8 flex items-center justify-between text-slate-300 font-cyber text-[10px] md:text-xs tracking-[0.3em]">
          <span>HIGH-FLYING RIM JAM</span>
          <span className="text-amber-400 font-bold">MONSTER FINISH</span>
        </div>
      </div>

      {/* SLAM CAM Dunk Timing Mini-Game */}
      <DunkTimingMeter />

      {/* First-run tutorial overlay */}
      {showTutorial && status === GameStatus.PLAYING && (
        <div id="tutorial-overlay" className="absolute inset-0 z-[80] pointer-events-none flex items-end justify-center pb-32 md:pb-36 anim-panel-pop">
          <div className="pointer-events-auto panel-angle bg-gradient-to-b from-[#101a3e]/97 to-[#070b20]/98 border border-orange-400/40 p-4 md:p-5 max-w-sm w-[88vw] shadow-[0_0_50px_rgba(255,120,30,0.35)]">
            <div className="flex items-center justify-between mb-2.5">
              <span className="font-cyber text-[10px] font-black tracking-[0.35em] uppercase text-orange-300">How to Play</span>
              <span className="font-athletic text-xs font-black text-white/70 tracking-widest">TIP-OFF</span>
            </div>
            <div className="space-y-2 text-[11px] md:text-xs text-slate-300 font-medium">
              <p className="flex items-center gap-2"><span className="keycap">←</span><span className="keycap">→</span> <span>Switch lanes</span></p>
              <p className="flex items-center gap-2"><span className="keycap">↑</span>/<span className="keycap">space</span> <span>Jump higher for dunks — hold to reach the rim</span></p>
              <p className="flex items-center gap-2"><span className="keycap">space</span> <span className="text-amber-300">Timing!</span> <span>Release the ball at the sweet spot during SLAM CAM</span></p>
              <p className="flex items-center gap-2"><span className="keycap">enter</span> <span>Blaze through obstacles On-Fire (tap on mobile)</span></p>
              <p className="flex items-center gap-2"><span className="keycap">esc</span> <span>Pause the match</span></p>
              <p className="flex items-center gap-2"><span className="keycap">tap</span> <span>On-Fire dash / swipes on mobile</span></p>
            </div>
            <button onClick={dismissTutorial} className="mt-3.5 w-full btn-game btn-primary py-2 text-sm tracking-[0.25em]">
              GOT IT
            </button>
          </div>
        </div>
      )}
    </div>
    <PauseMenu />
    </>
  );
};