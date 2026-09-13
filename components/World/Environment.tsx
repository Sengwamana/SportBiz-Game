import { useShallow } from 'zustand/react/shallow';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../../store';
import { LANE_WIDTH, GameStatus } from '../../types';
import { ArenaSpectators, ArenaArchitecture, ArenaScoreboard } from './ArenaDetails';
import { audio } from '../System/Audio';

// Procedural Canvas Texture for polished Maple Hardwood Basketball Court
function createHardwoodCourtTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');

  if (!ctx) return new THREE.CanvasTexture(canvas);

  // 1. Base Maple Hardwood Plank Background
  const plankHeight = 32;
  const numPlanks = canvas.height / plankHeight;
  const woodShades = ['#e6b87d', '#dfad72', '#eec289', '#d7a266', '#e8bc82', '#dbae74'];

  for (let i = 0; i < numPlanks; i++) {
    const y = i * plankHeight;
    ctx.fillStyle = woodShades[i % woodShades.length];
    ctx.fillRect(0, y, canvas.width, plankHeight);

    // Subtle wood grain lines inside each plank
    ctx.strokeStyle = 'rgba(160, 100, 45, 0.12)';
    ctx.lineWidth = 1;
    for (let j = 0; j < 3; j++) {
      ctx.beginPath();
      const grainY = y + 4 + j * 9;
      ctx.moveTo(0, grainY);
      ctx.bezierCurveTo(256, grainY + (j % 2 === 0 ? 3 : -3), 768, grainY - 2, 1024, grainY + 1);
      ctx.stroke();
    }

    // Plank seams
    ctx.strokeStyle = 'rgba(100, 60, 20, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();

    // Staggered vertical plank joints
    const staggerOffset = (i % 3) * 170;
    for (let x = staggerOffset; x < canvas.width; x += 340) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + plankHeight);
      ctx.stroke();
    }
  }

  // Full-width court: bounded keys, sidelines, half court and three-point arcs.
  ctx.fillStyle = 'rgba(25, 61, 105, 0.82)';
  ctx.fillRect(350, 32, 324, 205);
  ctx.fillRect(350, 787, 324, 205);
  ctx.strokeStyle = '#fff4dc';
  ctx.lineWidth = 4;
  ctx.strokeRect(48, 32, 928, 960);
  ctx.strokeRect(350, 32, 324, 205);
  ctx.strokeRect(350, 787, 324, 205);
  ctx.beginPath(); ctx.moveTo(48, 512); ctx.lineTo(976, 512); ctx.stroke();
  ctx.beginPath(); ctx.arc(512, 512, 112, 0, Math.PI * 2); ctx.stroke();
  for (const end of [0, 1]) {
    ctx.save();
    if (end) { ctx.translate(1024, 1024); ctx.rotate(Math.PI); }
    ctx.beginPath(); ctx.arc(512, 237, 106, 0, Math.PI); ctx.stroke();
    ctx.setLineDash([12, 10]);
    ctx.beginPath(); ctx.arc(512, 237, 106, Math.PI, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(108, 32); ctx.lineTo(108, 116);
    ctx.ellipse(512, 116, 404, 280, 0, Math.PI, 0, true);
    ctx.lineTo(916, 32); ctx.stroke();
    ctx.beginPath(); ctx.arc(512, 87, 55, 0, Math.PI); ctx.stroke();
    for (const y of [95, 140, 185]) {
      ctx.fillStyle = '#fff4dc'; ctx.fillRect(333, y, 17, 4); ctx.fillRect(674, y, 17, 4);
    }
    ctx.restore();
  }

  // Center Court Basketball Graphic
  ctx.fillStyle = '#ea580c';
  ctx.beginPath();
  ctx.arc(512, 512, 70, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4;
  ctx.stroke();

  // Basketball seams on center court logo
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(442, 512);
  ctx.lineTo(582, 512);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(512, 442);
  ctx.lineTo(512, 582);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(480, 512, 45, -Math.PI / 3, Math.PI / 3);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(544, 512, 45, (2 * Math.PI) / 3, (4 * Math.PI) / 3);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

// Moving Basketball Hardwood Floor
const HardwoodCourt: React.FC = () => {
  const speed = useStore(state => state.speed);
  const laneCount = useStore(state => state.laneCount);
  const courtMeshRef = useRef<THREE.Mesh>(null);
  const offsetRef = useRef(0);

  const hardwoodTexture = useMemo(() => {
    const tex = createHardwoodCourtTexture();
    tex.repeat.set(1, 5);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }, []);

  useEffect(() => () => hardwoodTexture.dispose(), [hardwoodTexture]);

  const floorWidth = Math.max(laneCount * LANE_WIDTH + 6, 26);

  useFrame((_, delta) => {
    if (useStore.getState().status !== GameStatus.PLAYING) return;
    offsetRef.current += (speed * Math.min(delta, 0.05)) / 52;
    if (hardwoodTexture) {
      hardwoodTexture.offset.y = offsetRef.current % 1;
    }
  });

  return (
    <group position={[0, -0.01, 0]}>
      {/* Main Polished Hardwood Court */}
      <mesh ref={courtMeshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -40]} receiveShadow>
        <planeGeometry args={[floorWidth, 260]} />
        <meshStandardMaterial
          map={hardwoodTexture}
          roughness={0.28}
          metalness={0.06}
        />
      </mesh>

      {/* Sideline Court Apron / Out of Bounds Border */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-(floorWidth / 2 + 1.2), -0.005, -40]}>
        <planeGeometry args={[2.4, 260]} />
        <meshStandardMaterial color="#1e3a8a" roughness={0.4} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[floorWidth / 2 + 1.2, -0.005, -40]}>
        <planeGeometry args={[2.4, 260]} />
        <meshStandardMaterial color="#1e3a8a" roughness={0.4} />
      </mesh>

      {/* Outer Court Apron (Crisp Light Gray Floor) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-35, -0.02, -40]}>
        <planeGeometry args={[45, 260]} />
        <meshStandardMaterial color="#273448" roughness={0.8} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[35, -0.02, -40]}>
        <planeGeometry args={[45, 260]} />
        <meshStandardMaterial color="#273448" roughness={0.8} />
      </mesh>
    </group>
  );
};

// Lane Guides: Clean Athletic White Court Lane Dividers
const BasketballLaneGuides: React.FC = () => {
  const { laneCount } = useStore(useShallow(state => ({
    laneCount: state.laneCount,
  })));

  const separators = useMemo(() => {
    const lines: number[] = [];
    const startX = -(laneCount * LANE_WIDTH) / 2;
    for (let i = 0; i <= laneCount; i++) {
      lines.push(startX + i * LANE_WIDTH);
    }
    return lines;
  }, [laneCount]);

  return (
    <group position={[0, 0.015, 0]}>
      {separators.map((x, i) => (
        <group key={`sep-${i}`}>
          {/* Main painted white stripe */}
          <mesh position={[x, 0, -30]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.08, 220]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.28} />
          </mesh>
          {/* Subtle warm court accent border for boundary lanes */}
          {(i === 0 || i === laneCount) && (
            <mesh position={[x + (i === 0 ? -0.08 : 0.08), 0, -30]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[0.06, 220]} />
              <meshBasicMaterial color="#ea580c" transparent opacity={0.6} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
};

// 3D Basketball Hoop Component (Stanchion, Tempered Glass Backboard, Orange Rim, Net)
const BasketballHoop: React.FC<{ position: [number, number, number]; rotationY?: number }> = ({ position, rotationY = 0 }) => {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* Weighted Base Stanchion with safety padding */}
      <mesh position={[0, 0.4, 0]} castShadow>
        <boxGeometry args={[1.4, 0.8, 1.8]} />
        <meshStandardMaterial color="#1e3a8a" roughness={0.5} />
      </mesh>

      {/* Main Angled Steel Boom Arm */}
      <mesh position={[0, 2.5, 0.4]} rotation={[0.25, 0, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.14, 4.4, 12]} />
        <meshStandardMaterial color="#0f172a" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Extension Arm toward Court */}
      <mesh position={[0, 4.3, 1.3]} rotation={[-0.4, 0, 0]} castShadow>
        <boxGeometry args={[0.16, 0.16, 1.8]} />
        <meshStandardMaterial color="#0f172a" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Tempered Glass Backboard */}
      <group position={[0, 4.1, 2.1]}>
        {/* Outer Backboard Frame */}
        <mesh>
          <boxGeometry args={[2.4, 1.6, 0.06]} />
          <meshStandardMaterial
            color="#ffffff"
            transparent
            opacity={0.65}
            roughness={0.1}
            metalness={0.1}
          />
        </mesh>
        {/* White / Orange Target Rectangle */}
        <mesh position={[0, -0.2, 0.035]}>
          <planeGeometry args={[0.8, 0.6]} />
          <meshBasicMaterial color="#ea580c" wireframe />
        </mesh>
        {/* Backboard Padding on bottom edge */}
        <mesh position={[0, -0.8, 0]}>
          <boxGeometry args={[2.44, 0.08, 0.08]} />
          <meshStandardMaterial color="#1e3a8a" />
        </mesh>

        {/* Breakaway Orange Rim */}
        <mesh position={[0, -0.5, 0.48]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <torusGeometry args={[0.38, 0.03, 12, 24]} />
          <meshStandardMaterial color="#ff5500" roughness={0.2} metalness={0.3} />
        </mesh>

        {/* White Braided Net (tapered cylinder/cone) */}
        <mesh position={[0, -0.85, 0.48]}>
          <cylinderGeometry args={[0.38, 0.18, 0.7, 12, 4, true]} />
          <meshBasicMaterial color="#ffffff" wireframe transparent opacity={0.75} />
        </mesh>

        {/* Shot Clock on top of Backboard */}
        <mesh position={[0, 1.05, 0]}>
          <boxGeometry args={[0.7, 0.45, 0.2]} />
          <meshStandardMaterial color="#0f172a" />
        </mesh>
        <mesh position={[0, 1.05, 0.11]}>
          <planeGeometry args={[0.55, 0.35]} />
          <meshBasicMaterial color="#ef4444" />
        </mesh>
      </group>
    </group>
  );
};

// Sideline Basketball Rack with 3 balls
const BasketballRack: React.FC<{ position: [number, number, number]; rotationY?: number }> = ({ position, rotationY = 0 }) => {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* Metal Rack Frame */}
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[2.2, 1.0, 0.5]} />
        <meshBasicMaterial color="#64748b" wireframe />
      </mesh>
      {/* 3 Basketballs on top rail */}
      {[-0.6, 0, 0.6].map((x, i) => (
        <mesh key={i} position={[x, 0.85, 0]} castShadow>
          <sphereGeometry args={[0.26, 16, 16]} />
          <meshStandardMaterial color="#ea580c" roughness={0.4} />
        </mesh>
      ))}
    </group>
  );
};

export interface LightingCycleResult {
  sunPosition: [number, number, number];
  sunIntensity: number;
  sunColor: THREE.Color;
  shadowIntensity: number;
  ambientIntensity: number;
  ambientColor: THREE.Color;
  fillPosition: [number, number, number];
  fillIntensity: number;
  fillColor: THREE.Color;
  fogColor: THREE.Color;
  skyColor: THREE.Color;
  phaseName: 'morning' | 'midday' | 'golden_hour' | 'twilight' | 'arena_night';
  cycleProgress: number;
  isFlickering: boolean;
  flickerMultiplier: number;
}

const KEYFRAMES = [
  {
    progress: 0.0,
    sunPosition: [22, 28, 18] as [number, number, number],
    sunIntensity: 1.85,
    sunColorHex: '#fff7ed', // Morning sunrise warmth
    shadowIntensity: 0.86,
    ambientIntensity: 0.82,
    ambientColorHex: '#f1f5f9',
    fillPosition: [-16, 22, -15] as [number, number, number],
    fillIntensity: 0.6,
    fillColorHex: '#bae6fd',
    fogColorHex: '#e2e8f0',
    skyColorHex: '#e0e7ff',
    phaseName: 'morning' as const,
  },
  {
    progress: 0.25,
    sunPosition: [8, 42, 6] as [number, number, number],
    sunIntensity: 2.15,
    sunColorHex: '#ffffff', // Clean high-noon daylight
    shadowIntensity: 0.96, // Sharp, deep vertical shadows
    ambientIntensity: 0.88,
    ambientColorHex: '#ffffff',
    fillPosition: [-15, 25, -20] as [number, number, number],
    fillIntensity: 0.65,
    fillColorHex: '#bae6fd',
    fogColorHex: '#e8ecf2',
    skyColorHex: '#e8ecf2',
    phaseName: 'midday' as const,
  },
  {
    progress: 0.50,
    sunPosition: [-28, 18, -12] as [number, number, number],
    sunIntensity: 1.65,
    sunColorHex: '#f59e0b', // Sunset golden hour
    shadowIntensity: 0.72, // Soft, long angled golden shadows
    ambientIntensity: 0.74,
    ambientColorHex: '#fef3c7',
    fillPosition: [18, 18, 16] as [number, number, number],
    fillIntensity: 0.55,
    fillColorHex: '#fed7aa',
    fogColorHex: '#fde2d0',
    skyColorHex: '#fbbf24',
    phaseName: 'golden_hour' as const,
  },
  {
    progress: 0.72,
    sunPosition: [-16, 30, 22] as [number, number, number],
    sunIntensity: 1.95,
    sunColorHex: '#93c5fd', // Stadium twilight electric glow
    shadowIntensity: 0.90,
    ambientIntensity: 0.68,
    ambientColorHex: '#64748b',
    fillPosition: [16, 26, -18] as [number, number, number],
    fillIntensity: 0.65,
    fillColorHex: '#c084fc',
    fogColorHex: '#334155',
    skyColorHex: '#1e293b',
    phaseName: 'twilight' as const,
  },
  {
    progress: 0.86,
    sunPosition: [16, 38, 14] as [number, number, number],
    sunIntensity: 2.3,
    sunColorHex: '#e0f2fe', // High-power arena halogen floodlight bank
    shadowIntensity: 0.98, // Crisp stadium floodlight cast
    ambientIntensity: 0.58,
    ambientColorHex: '#1e293b',
    fillPosition: [-16, 28, -16] as [number, number, number],
    fillIntensity: 0.75,
    fillColorHex: '#38bdf8',
    fogColorHex: '#0f172a',
    skyColorHex: '#090d16',
    phaseName: 'arena_night' as const,
  },
  {
    progress: 1.0,
    sunPosition: [22, 28, 18] as [number, number, number],
    sunIntensity: 1.85,
    sunColorHex: '#fff7ed',
    shadowIntensity: 0.86,
    ambientIntensity: 0.82,
    ambientColorHex: '#f1f5f9',
    fillPosition: [-16, 22, -15] as [number, number, number],
    fillIntensity: 0.6,
    fillColorHex: '#bae6fd',
    fogColorHex: '#e2e8f0',
    skyColorHex: '#e0e7ff',
    phaseName: 'morning' as const,
  },
];

const cachedKeyframeColors = KEYFRAMES.map(k => ({
  sun: new THREE.Color(k.sunColorHex),
  ambient: new THREE.Color(k.ambientColorHex),
  fill: new THREE.Color(k.fillColorHex),
  fog: new THREE.Color(k.fogColorHex),
  sky: new THREE.Color(k.skyColorHex),
}));

// Reusable result colors to avoid heap allocations in frame render loop
const resultSunColor = new THREE.Color();
const resultAmbientColor = new THREE.Color();
const resultFillColor = new THREE.Color();
const resultFogColor = new THREE.Color();
const resultSkyColor = new THREE.Color();

/**
 * Cycles the environment's sunlight position and shadow intensity periodically
 * to simulate the transition of time or stadium light flickers as the player progresses.
 *
 * @param distance Total meters traversed by player
 * @param elapsedTime Cumulative game clock seconds
 * @returns LightingCycleResult with dynamic lighting coordinates, colors, intensities, and shadow state
 */
export function cycleSunlightAndShadow(
  distance: number,
  elapsedTime: number
): LightingCycleResult {
  // Progression metric combines player distance covered and game time
  const cycleProgress = ((distance * 0.0022 + elapsedTime * 0.016) % 1.0 + 1.0) % 1.0;

  // Find surrounding keyframes
  let idx = 0;
  for (let i = 0; i < KEYFRAMES.length - 1; i++) {
    if (cycleProgress >= KEYFRAMES[i].progress && cycleProgress <= KEYFRAMES[i + 1].progress) {
      idx = i;
      break;
    }
  }

  const k1 = KEYFRAMES[idx];
  const k2 = KEYFRAMES[idx + 1];
  const span = k2.progress - k1.progress;
  const rawT = span > 0 ? (cycleProgress - k1.progress) / span : 0;
  // Smooth cubic ease (smoothstep)
  const smoothT = rawT * rawT * (3 - 2 * rawT);

  // 1. Interpolate 3D Sunlight & Fill positions
  const sunX = k1.sunPosition[0] + (k2.sunPosition[0] - k1.sunPosition[0]) * smoothT;
  const sunY = k1.sunPosition[1] + (k2.sunPosition[1] - k1.sunPosition[1]) * smoothT;
  const sunZ = k1.sunPosition[2] + (k2.sunPosition[2] - k1.sunPosition[2]) * smoothT;

  const fillX = k1.fillPosition[0] + (k2.fillPosition[0] - k1.fillPosition[0]) * smoothT;
  const fillY = k1.fillPosition[1] + (k2.fillPosition[1] - k1.fillPosition[1]) * smoothT;
  const fillZ = k1.fillPosition[2] + (k2.fillPosition[2] - k1.fillPosition[2]) * smoothT;

  // 2. Interpolate Base Intensities & Shadows
  let sunIntensity = k1.sunIntensity + (k2.sunIntensity - k1.sunIntensity) * smoothT;
  let shadowIntensity = k1.shadowIntensity + (k2.shadowIntensity - k1.shadowIntensity) * smoothT;
  let ambientIntensity = k1.ambientIntensity + (k2.ambientIntensity - k1.ambientIntensity) * smoothT;
  let fillIntensity = k1.fillIntensity + (k2.fillIntensity - k1.fillIntensity) * smoothT;

  // 3. Interpolate Colors
  resultSunColor.lerpColors(cachedKeyframeColors[idx].sun, cachedKeyframeColors[idx + 1].sun, smoothT);
  resultAmbientColor.lerpColors(cachedKeyframeColors[idx].ambient, cachedKeyframeColors[idx + 1].ambient, smoothT);
  resultFillColor.lerpColors(cachedKeyframeColors[idx].fill, cachedKeyframeColors[idx + 1].fill, smoothT);
  resultFogColor.lerpColors(cachedKeyframeColors[idx].fog, cachedKeyframeColors[idx + 1].fog, smoothT);
  resultSkyColor.lerpColors(cachedKeyframeColors[idx].sky, cachedKeyframeColors[idx + 1].sky, smoothT);

  // 4. Stadium Light Flicker Simulation
  // Triggers periodically as the player advances:
  // - Every 130 meters for a 14m stretch as player sprints under stadium light towers
  // - Transition zone during twilight-to-night halogen ignition (cycleProgress 0.70 - 0.74)
  const distInSegment = distance % 130;
  const isDistanceFlicker = distInSegment > 0 && distInSegment < 14 && distance > 15;
  const isTransitionFlicker = cycleProgress >= 0.70 && cycleProgress <= 0.74;
  const inFlickerWindow = isDistanceFlicker || isTransitionFlicker;

  let isFlickering = false;
  let flickerMultiplier = 1.0;

  if (inFlickerWindow) {
    // Multi-frequency ballast oscillation & arc dropout
    const tFast = elapsedTime * 42.0;
    const pulse1 = Math.sin(tFast);
    const pulse2 = Math.cos(tFast * 1.73 + distance * 0.3);
    const pulse3 = Math.sin(tFast * 3.14);
    const composite = (pulse1 * 0.5 + pulse2 * 0.3 + pulse3 * 0.2);

    if (composite > 0.15) {
      isFlickering = true;
      flickerMultiplier = 0.32 + 0.46 * Math.abs(pulse1);
    } else if (composite < -0.7) {
      isFlickering = true;
      flickerMultiplier = 0.24;
    }
  }

  // Modulate shadow intensity and direct sunlight with flicker
  shadowIntensity = Math.max(0.08, Math.min(1.0, shadowIntensity * flickerMultiplier));
  sunIntensity = sunIntensity * (0.35 + 0.65 * flickerMultiplier);
  ambientIntensity = ambientIntensity * (0.75 + 0.25 * flickerMultiplier);

  // Global light-truck balance: the authored keyframes are hot for an LDR
  // web renderer at some phases and want to clip the polished hardwood lane
  // to pure white ("white screen"), erasing the court. A gentle scene-wide
  // gain keeps the keyframed day/night curve shape while staying in range.
  const LIGHT_GAIN = 0.78;
  sunIntensity *= LIGHT_GAIN;
  ambientIntensity *= LIGHT_GAIN;
  fillIntensity *= LIGHT_GAIN;

  return {
    sunPosition: [sunX, sunY, sunZ],
    sunIntensity,
    sunColor: resultSunColor,
    shadowIntensity,
    ambientIntensity,
    ambientColor: resultAmbientColor,
    fillPosition: [fillX, fillY, fillZ],
    fillIntensity,
    fillColor: resultFillColor,
    fogColor: resultFogColor,
    skyColor: resultSkyColor,
    phaseName: k1.phaseName,
    cycleProgress,
    isFlickering,
    flickerMultiplier,
  };
}

// Overhead Stadium Light Truss with 4 floodlights
const StadiumFloodlightTruss: React.FC<{ position: [number, number, number] }> = ({ position }) => {
  const lightsRef = useRef<(THREE.PointLight | null)[]>([]);

  useFrame((state) => {
    const distance = useStore.getState().distance;
    const lighting = cycleSunlightAndShadow(distance, state.clock.elapsedTime);
    const targetIntensity = 0.95 * lighting.flickerMultiplier;

    for (let i = 0; i < lightsRef.current.length; i++) {
      const light = lightsRef.current[i];
      if (light) {
        light.intensity = targetIntensity;
        light.color.copy(lighting.sunColor);
      }
    }
  });

  return (
    <group position={position}>
      {/* Structural horizontal truss beam */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[34, 0.6, 0.6]} />
        <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.3} />
      </mesh>

      {/* Light banks pointing down at the court */}
      {[-12, -4, 4, 12].map((x, i) => (
        <group key={i} position={[x, -0.4, 0]}>
          <mesh rotation={[0.4, 0, 0]}>
            <boxGeometry args={[2.2, 1.0, 0.4]} />
            <meshStandardMaterial color="#1e293b" />
          </mesh>
          {/* Glowing lens */}
          <mesh position={[0, -0.15, 0.15]} rotation={[0.4, 0, 0]}>
            <planeGeometry args={[2.0, 0.8]} />
            <meshBasicMaterial color="#fffbeb" />
          </mesh>
          {/* Light source */}
          <pointLight
            ref={el => { lightsRef.current[i] = el; }}
            color="#fff7ed"
            intensity={0.9}
            distance={35}
            decay={2}
            position={[0, -1, 1]}
          />
        </group>
      ))}
    </group>
  );
};

const FLAG_GEO = new THREE.ConeGeometry(0.6, 1.7, 3, 1);
const ArenaCornerFlags: React.FC = () => {
  const flagRefs = useRef<(THREE.Mesh | null)[]>([]);

  useFrame((state, delta) => {
    flagRefs.current.forEach((f, i) => {
      if (f) {
        f.rotation.y += delta * (i % 2 === 0 ? 1.2 : -1.2);
      }
    });
  });

  const corners: [number, number][] = [
    [-14, -38],
    [14, -38],
    [-14, -118],
    [14, -118],
  ];

  return (
    <group>
      {corners.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 1.1, 0]}>
            <cylinderGeometry args={[0.06, 0.08, 2.2, 8]} />
            <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.3} />
          </mesh>
          <mesh
            ref={el => { flagRefs.current[i] = el; }}
            position={[0, 2.1, 0]}
            rotation={[Math.PI / 2, 0, 0]}
            geometry={FLAG_GEO}
            scale={[1, 1, 1]}
          >
            <meshStandardMaterial color={i % 2 === 0 ? '#ea580c' : '#2563eb'} side={THREE.DoubleSide} roughness={0.5} />
          </mesh>
        </group>
      ))}
    </group>
  );
};

const ARENA_HAZE = new THREE.Color('#172333');
const ARENA_SKY = new THREE.Color('#111b29');

// Indoor arena with dynamic court lighting.
export const Environment: React.FC = () => {
  const sunLightRef = useRef<THREE.DirectionalLight>(null);
  const fillLightRef = useRef<THREE.DirectionalLight>(null);
  const ambientLightRef = useRef<THREE.AmbientLight>(null);
  const wasFlickering = useRef(false);

  useFrame((state, delta) => {
    const distance = useStore.getState().distance;
    const lighting = cycleSunlightAndShadow(distance, state.clock.elapsedTime);

    // 1. Dynamic Sunlight position, intensity, color & shadow intensity
    if (sunLightRef.current) {
      sunLightRef.current.position.set(
        lighting.sunPosition[0],
        lighting.sunPosition[1],
        lighting.sunPosition[2]
      );
      sunLightRef.current.intensity = lighting.sunIntensity;
      sunLightRef.current.color.copy(lighting.sunColor);
      if (sunLightRef.current.shadow) {
        sunLightRef.current.shadow.intensity = lighting.shadowIntensity;
      }
    }

    // 2. Ambient light modulation
    if (ambientLightRef.current) {
      ambientLightRef.current.intensity = lighting.ambientIntensity;
      ambientLightRef.current.color.copy(lighting.ambientColor);
    }

    // 3. Fill light position and color
    if (fillLightRef.current) {
      fillLightRef.current.position.set(
        lighting.fillPosition[0],
        lighting.fillPosition[1],
        lighting.fillPosition[2]
      );
      fillLightRef.current.intensity = lighting.fillIntensity;
      fillLightRef.current.color.copy(lighting.fillColor);
    }

    // 4. Smooth Scene Atmosphere / Fog and Background transition
    if (state.scene.background instanceof THREE.Color) {
      state.scene.background.lerp(ARENA_SKY, delta * 3);
    }
    if (state.scene.fog && 'color' in state.scene.fog) {
      (state.scene.fog as THREE.Fog).color.lerp(ARENA_HAZE, delta * 3);
    }

    // 5. Audio cue for stadium light flicker ignition
    if (lighting.isFlickering && !wasFlickering.current) {
      audio.playLightFlicker();
    }
    wasFlickering.current = lighting.isFlickering;
  });

  return (
    <>
      {/* Light Mode Bright Arena Atmosphere with Dynamic Transition */}
      <color attach="background" args={['#e8ecf2']} />
      <fog attach="fog" args={['#d8e3f5', 70, 200]} />

      {/* Dynamic Sunlight & Shadow Engine */}
      <ambientLight ref={ambientLightRef} intensity={0.82} color="#ffffff" />
      <directionalLight
        ref={sunLightRef}
        position={[15, 35, 15]}
        intensity={1.8}
        color="#fffbeb"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-bias={-0.00015}
        shadow-camera-left={-22}
        shadow-camera-right={22}
        shadow-camera-top={32}
        shadow-camera-bottom={-32}
        shadow-camera-near={0.5}
        shadow-camera-far={120}
      />
      <directionalLight
        ref={fillLightRef}
        position={[-15, 25, -20]}
        intensity={0.65}
        color="#bae6fd"
      />

      {/* Polished Hardwood Basketball Court */}
      <HardwoodCourt />
      <BasketballLaneGuides />

      {/* Basketball Hoops along the Sidelines */}
      <BasketballHoop position={[-9.5, 0, -25]} rotationY={Math.PI / 2} />
      <BasketballHoop position={[9.5, 0, -25]} rotationY={-Math.PI / 2} />
      <BasketballHoop position={[-9.5, 0, -85]} rotationY={Math.PI / 2} />
      <BasketballHoop position={[9.5, 0, -85]} rotationY={-Math.PI / 2} />
      <BasketballHoop position={[-9.5, 0, -145]} rotationY={Math.PI / 2} />
      <BasketballHoop position={[9.5, 0, -145]} rotationY={-Math.PI / 2} />

      {/* Sideline Basketball Racks */}
      <BasketballRack position={[-10.2, 0, -50]} rotationY={Math.PI / 2} />
      <BasketballRack position={[10.2, 0, -50]} rotationY={-Math.PI / 2} />
      <BasketballRack position={[-10.2, 0, -110]} rotationY={Math.PI / 2} />
      <BasketballRack position={[10.2, 0, -110]} rotationY={-Math.PI / 2} />

      {/* Stadium Bleachers & Arena Sideline Walls */}
      <ArenaArchitecture />

      {/* Instanced Spectator Crowd */}
      <ArenaSpectators />

      {/* Arena Corner Flags */}
      <ArenaCornerFlags />

      {/* Overhead Arena Roof Light Trusses */}
      <StadiumFloodlightTruss position={[0, 18, -30]} />
      <StadiumFloodlightTruss position={[0, 18, -90]} />
      <StadiumFloodlightTruss position={[0, 18, -150]} />

      {/* Majestic Center Court Jumbotron */}
      <ArenaScoreboard />
    </>
  );
};
