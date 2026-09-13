/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Text3D, Center } from '@react-three/drei';
import { v4 as uuidv4 } from 'uuid';
import { useStore } from '../../store';
import { GameObject, ObjectType, LANE_WIDTH, SPAWN_DISTANCE, REMOVE_DISTANCE, GameStatus, GEMINI_COLORS, BASKET_TARGET, RUN_SPEED_BASE, getDailySeed } from '../../types';
import { audio } from '../System/Audio';
import { ambientAudio } from '../System/AmbientAudio';
import { crowdAudioController } from '../System/CrowdAudioController';
import { announcer } from '../System/Announcer';

// Daily-seeded Spawn PRNG: identical obstacle layout every match that day → scores are comparable
function mulberry32Seed(a: number) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const spawnRng = mulberry32Seed(getDailySeed());

// Active Showtime Lane hoop awaiting the SLAM CAM timing resolution
let showtimePending: GameObject | null = null;

// Geometry Constants
const OBSTACLE_HEIGHT = 1.6;
// Spawn-free grace period at the start of a run (gives the player a clear opening)
const GRACE_DISTANCE = RUN_SPEED_BASE * 1.5;
// Showtime Lane dunk checkpoints every 500 yards of court distance
const SHOWTIME_INTERVAL = 500;
// Pulsing telegraph circle under oncoming dangers
const TELEGRAPH_GEO = new THREE.CircleGeometry(1.0, 28);

// Basketball Training Dummy Geometries
const DUMMY_BASE_GEO = new THREE.CylinderGeometry(0.48, 0.52, 0.12, 16);
const DUMMY_POLE_GEO = new THREE.CylinderGeometry(0.05, 0.05, 1.4, 8);
const DUMMY_BODY_GEO = new THREE.BoxGeometry(0.65, 0.7, 0.12);
const DUMMY_ARMS_GEO = new THREE.BoxGeometry(0.85, 0.45, 0.08);
const DUMMY_HEAD_GEO = new THREE.BoxGeometry(0.26, 0.28, 0.12);

// Basketball Collectible Geometry
const BASKETBALL_COLLECT_GEO = new THREE.SphereGeometry(0.32, 20, 20);
const BASKETBALL_SEAMS_GEO = new THREE.SphereGeometry(0.325, 12, 12);

// Rival Defender Geometries (Level 2+)
const RIVAL_BODY_GEO = new THREE.CylinderGeometry(0.3, 0.22, 0.75, 8);
const RIVAL_HEAD_GEO = new THREE.BoxGeometry(0.28, 0.3, 0.28);
const RIVAL_ARMS_GEO = new THREE.BoxGeometry(1.2, 0.15, 0.15);

// Fast Bullet Basketball Pass (replacing Missile)
const BULLET_BALL_GEO = new THREE.SphereGeometry(0.3, 16, 16);
const BULLET_RING_GEO = new THREE.TorusGeometry(0.38, 0.03, 12, 24);

// Lateral Sweep Defense Geometries (Moving Wall + Ground Sweeper)
const WALL_GEO = new THREE.BoxGeometry(LANE_WIDTH * 1.6, OBSTACLE_HEIGHT, 0.28);
const WALL_STRIPE_GEO = new THREE.PlaneGeometry(LANE_WIDTH * 1.6, 0.32);
const SWEEP_GEO = new THREE.CylinderGeometry(0.08, 0.08, LANE_WIDTH * 3.2, 10);
const SWEEP_END_GEO = new THREE.SphereGeometry(0.44, 12, 12);

// Showtime Lane golden halo ring (pre-slam target zone)
const SHOWTIME_HALO_GEO = new THREE.TorusGeometry(0.82, 0.05, 10, 30);

// Basketball Dunk Hoop Geometries
const HOOP_BACKBOARD_GEO = new THREE.BoxGeometry(1.6, 1.1, 0.05);
const HOOP_TARGET_GEO = new THREE.PlaneGeometry(0.55, 0.42);
const HOOP_RIM_GEO = new THREE.TorusGeometry(0.35, 0.035, 12, 24);
const HOOP_NET_GEO = new THREE.CylinderGeometry(0.35, 0.18, 0.55, 12, 4, true);
const HOOP_STANCHION_GEO = new THREE.CylinderGeometry(0.08, 0.09, 3.2, 8);
const HOOP_ARM_GEO = new THREE.BoxGeometry(0.12, 0.12, 1.2);
const HOOP_HALO_GEO = new THREE.TorusGeometry(0.46, 0.02, 8, 24);
const SHADOW_HOOP_GEO = new THREE.CircleGeometry(0.8, 24);

// Shadow Geometries
const SHADOW_LETTER_GEO = new THREE.PlaneGeometry(1.8, 0.6);
const SHADOW_BALL_GEO = new THREE.CircleGeometry(0.45, 24);
const SHADOW_DEFENDER_GEO = new THREE.CircleGeometry(0.6, 24);
const SHADOW_DEFAULT_GEO = new THREE.CircleGeometry(0.5, 16);

// Shop Geometries
const SHOP_FRAME_GEO = new THREE.BoxGeometry(1, 6.8, 1.2);
const SHOP_BACK_GEO = new THREE.BoxGeometry(1, 5, 1.4);
const SHOP_OUTLINE_GEO = new THREE.BoxGeometry(1, 7.0, 0.8);
const SHOP_FLOOR_GEO = new THREE.PlaneGeometry(1, 4.5);

const PARTICLE_COUNT = 600;
const BASE_LETTER_INTERVAL = 150;

const getLetterInterval = (level: number) => {
  return BASE_LETTER_INTERVAL * Math.pow(1.5, Math.max(0, level - 1));
};

const MISSILE_SPEED = 28;

// Font for 3D Text
const FONT_URL = "https://cdn.jsdelivr.net/npm/three/examples/fonts/helvetiker_bold.typeface.json";

// --- Particle System (Basketball Sparks & Arena Confetti) ---
const ParticleSystem: React.FC = () => {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const particles = useMemo(() => new Array(PARTICLE_COUNT).fill(0).map(() => ({
    life: 0,
    pos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    rot: new THREE.Vector3(),
    rotVel: new THREE.Vector3(),
    color: new THREE.Color()
  })), []);

  useEffect(() => {
    const handleExplosion = (e: CustomEvent) => {
      const { position, color } = e.detail;
      let spawned = 0;
      const burstAmount = 35;

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const p = particles[i];
        if (p.life <= 0) {
          p.life = 1.0 + Math.random() * 0.4;
          p.pos.set(position[0], position[1], position[2]);

          const theta = Math.random() * Math.PI * 2;
          const phi = Math.acos(2 * Math.random() - 1);
          const speed = 2 + Math.random() * 9;

          p.vel.set(
            Math.sin(phi) * Math.cos(theta),
            Math.sin(phi) * Math.sin(theta),
            Math.cos(phi)
          ).multiplyScalar(speed);

          p.rot.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
          p.rotVel.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(6);

          p.color.set(color);

          spawned++;
          if (spawned >= burstAmount) break;
        }
      }
    };

    window.addEventListener('particle-burst', handleExplosion as any);
    return () => window.removeEventListener('particle-burst', handleExplosion as any);
  }, [particles]);

  useFrame((_, delta) => {
    if (!mesh.current) return;
    const safeDelta = Math.min(delta, 0.1);

    particles.forEach((p, i) => {
      if (p.life > 0) {
        p.life -= safeDelta * 1.5;
        p.pos.addScaledVector(p.vel, safeDelta);
        p.vel.y -= safeDelta * 6;
        p.vel.multiplyScalar(0.98);

        p.rot.x += p.rotVel.x * safeDelta;
        p.rot.y += p.rotVel.y * safeDelta;

        dummy.position.copy(p.pos);
        const scale = Math.max(0, p.life * 0.22);
        dummy.scale.set(scale, scale, scale);

        dummy.rotation.set(p.rot.x, p.rot.y, p.rot.z);
        dummy.updateMatrix();

        mesh.current!.setMatrixAt(i, dummy.matrix);
        mesh.current!.setColorAt(i, p.color);
      } else {
        dummy.scale.set(0, 0, 0);
        dummy.updateMatrix();
        mesh.current!.setMatrixAt(i, dummy.matrix);
      }
    });

    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, PARTICLE_COUNT]}>
      <octahedronGeometry args={[0.45, 0]} />
      <meshBasicMaterial toneMapped={false} transparent opacity={0.9} />
    </instancedMesh>
  );
};

const getRandomLane = (laneCount: number) => {
  const max = Math.floor(laneCount / 2);
  return Math.floor(spawnRng() * (max * 2 + 1)) - max;
};

export const LevelManager: React.FC = () => {
  const {
    status,
    speed,
    collectGem,
    collectLetter,
    collectedLetters,
    laneCount,
    setDistance,
    openShop,
    level,
    addScore,
    isImmortalityActive,
    startDunkCinematic,
    isDunkSlowMo,
    timeScale,
    dunkStreak,
    incrementDunkStreak,
    resetDunkStreak,
    setHoopTension
  } = useStore();

  const objectsRef = useRef<GameObject[]>([]);
  const [, setRenderTrigger] = useState(0);
  const prevStatus = useRef(status);
  const prevLevel = useRef(level);
  const prevDunkSlowMo = useRef(isDunkSlowMo);

  const playerObjRef = useRef<THREE.Object3D | null>(null);
  const distanceTraveled = useRef(0);
  const nextLetterDistance = useRef(BASE_LETTER_INTERVAL);
  const showtimeNext = useRef(SHOWTIME_INTERVAL);

  // Audio cue when cinematic slow-mo ends and normal speed snaps back
  useEffect(() => {
    if (prevDunkSlowMo.current && !isDunkSlowMo && status === GameStatus.PLAYING) {
      audio.playSlowMoEnd();
    }
    prevDunkSlowMo.current = isDunkSlowMo;
  }, [isDunkSlowMo, status]);

  // Dunk timing mini-game resolution (PERFECT / GOOD / MISS) + Showtime Lane bonus
  useEffect(() => {
    const handleTiming = (e: any) => {
      const detail = e.detail || {};
      const zone = detail.zone || 'miss';
      const position = detail.position || null;

      // Showtime Lane checkpoint resolution: gold-tier rewards for a flawless finish
      if (showtimePending) {
        const pending = showtimePending;
        showtimePending = null;
        if (zone === 'perfect') {
          addScore(1500);
          audio.playComboPing(true);
          window.dispatchEvent(new CustomEvent('screen-shake', {
            detail: { intensity: 0.9, duration: 0.45 }
          }));
          if (position) {
            for (let i = 0; i < 5; i++) {
              window.dispatchEvent(new CustomEvent('particle-burst', {
                detail: { position: [position[0], 2 + i * 0.5, position[2]], color: '#ffd700' }
              }));
            }
          }
          announcer.say('Showtime!');
          window.dispatchEvent(new CustomEvent('dunk-success', {
            detail: { position, points: 1500, text: 'SHOWTIME SLAM!' }
          }));
          window.dispatchEvent(new CustomEvent('score-popup', {
            detail: {
              position: position ? [pending.position[0], 3.4, pending.position[2]] : [0, 3, 0],
              text: 'SHOWTIME!',
              sub: '+1500',
              color: '#ffd700',
              scale: 2.0,
            }
          }));
        } else if (zone === 'good') {
          addScore(400);
          audio.playComboPing(false);
          window.dispatchEvent(new CustomEvent('score-popup', {
            detail: {
              position: position ? [pending.position[0], 2.6, pending.position[2]] : [0, 3, 0],
              text: 'SOLID FINISH',
              sub: '+400',
              color: '#fbbf24',
              scale: 1.15,
            }
          }));
        } else {
          window.dispatchEvent(new CustomEvent('score-popup', {
            detail: {
              position: position ? [pending.position[0], 2.4, pending.position[2]] : [0, 3, 0],
              text: 'SHOWTIME MISSED',
              sub: 'No bonus',
              color: '#94a3b8',
              scale: 0.9,
            }
          }));
        }
        return;
      }

      if (zone === 'perfect') {
        addScore(750);
        audio.playComboPing(true);
        window.dispatchEvent(new CustomEvent('screen-shake', {
          detail: { intensity: 0.55, duration: 0.3 }
        }));
        if (position) {
          for (let i = 0; i < 3; i++) {
            window.dispatchEvent(new CustomEvent('particle-burst', {
              detail: { position: [position[0], 2 + i * 0.4, position[2]], color: '#ffd700' }
            }));
          }
        }
        announcer.onDunk(true);
        window.dispatchEvent(new CustomEvent('score-popup', {
          detail: {
            position: position ? [position[0], position[1] || 3, position[2]] : [0, 3, 0],
            text: 'PERFECT!',
            sub: '+750',
            color: '#ffd700',
            scale: 1.6,
          }
        }));
      } else if (zone === 'good') {
        addScore(250);
        audio.playComboPing(false);
        if (position) {
          window.dispatchEvent(new CustomEvent('particle-burst', {
            detail: { position: [position[0], 2.4, position[2]], color: '#fbbf24' }
          }));
        }
        window.dispatchEvent(new CustomEvent('score-popup', {
          detail: {
            position: position ? [position[0], position[1] || 3, position[2]] : [0, 3, 0],
            text: 'GOOD RELEASE',
            sub: '+250',
            color: '#fbbf24',
            scale: 1.2,
          }
        }));
      }
    };

    window.addEventListener('dunk-timing', handleTiming);
    return () => window.removeEventListener('dunk-timing', handleTiming);
  }, [addScore]);

  // Handle resets and transitions
  useEffect(() => {
    const isRestart = status === GameStatus.PLAYING && prevStatus.current === GameStatus.GAME_OVER;
    const isMenuReset = status === GameStatus.MENU;
    const isLevelUp = level !== prevLevel.current && status === GameStatus.PLAYING;
    const isVictoryReset = status === GameStatus.PLAYING && prevStatus.current === GameStatus.VICTORY;

    if (isMenuReset || isRestart || isVictoryReset) {
      objectsRef.current = [];
      setRenderTrigger(t => t + 1);

      distanceTraveled.current = 0;
      nextLetterDistance.current = getLetterInterval(1);
      showtimeNext.current = SHOWTIME_INTERVAL;
      showtimePending = null;
    } else if (isLevelUp && level > 1) {
      // Clear distant objects to place Shop Portal
      objectsRef.current = objectsRef.current.filter(obj => obj.position[2] > -80);

      // Arena cheer and organ fanfare for quarter advancement
      ambientAudio.triggerCheerSwell(0.9);
      ambientAudio.triggerArenaFanfare();
      announcer.onLevelUp(level);

      // Arena confetti cannon burst
      const confettiColors = ['#f59e0b', '#2563eb', '#dc2626', '#10b981', '#ea580c', '#7c3aed'];
      confettiColors.forEach((c, i) => {
        window.dispatchEvent(new CustomEvent('particle-burst', {
          detail: { position: [(i - 2.5) * 1.1, 3, -35], color: c }
        }));
      });

      // Spawn Locker Room Portal
      objectsRef.current.push({
        id: uuidv4(),
        type: ObjectType.SHOP_PORTAL,
        position: [0, 0, -100],
        active: true,
      });

      nextLetterDistance.current = distanceTraveled.current - SPAWN_DISTANCE + getLetterInterval(level);
      setRenderTrigger(t => t + 1);
    } else if (status === GameStatus.GAME_OVER || status === GameStatus.VICTORY) {
      setDistance(Math.floor(distanceTraveled.current));
    }

    prevStatus.current = status;
    prevLevel.current = level;
  }, [status, level, setDistance]);

  useFrame(state => {
    if (!playerObjRef.current) {
      const group = state.scene.getObjectByName('PlayerGroup');
      if (group && group.children.length > 0) {
        playerObjRef.current = group.children[0];
      }
    }
  });

  useFrame((_, delta) => {
    if (status !== GameStatus.PLAYING) return;

    // Apply timeScale for slow-motion cinematic replays
    const safeDelta = Math.min(delta, 0.05) * timeScale;
    const dist = speed * safeDelta;
    distanceTraveled.current += dist;

    let hasChanges = false;
    const playerPos = new THREE.Vector3(0, 0, 0);

    if (playerObjRef.current) {
      playerObjRef.current.getWorldPosition(playerPos);
    }

    const currentObjects = objectsRef.current;
    const keptObjects: GameObject[] = [];
    const newSpawns: GameObject[] = [];

    for (const obj of currentObjects) {
      let moveAmount = dist;

      // Fast bullet basketball pass moves faster
      if (obj.type === ObjectType.MISSILE) {
        moveAmount += MISSILE_SPEED * safeDelta;
      }

      // Showtime Lane checkpoint announcement before the golden hoop comes into view
      if (obj.type === ObjectType.HOOP && obj.isShowtime && !obj.hasAnnounced && obj.position[2] > -110) {
        obj.hasAnnounced = true;
        crowdAudioController.triggerStreakDunkCheer(2, obj.position);
        window.dispatchEvent(new CustomEvent('showtime-announce', {
          detail: { position: obj.position, lane: obj.position[0] }
        }));
        hasChanges = true;
      }

      // Lateral oscillation for moving walls / sweepers
      if (obj.type === ObjectType.MOVING_WALL || obj.type === ObjectType.SWEEPER) {
        const a = obj.amplitude ?? 0;
        const w = obj.oscSpeed ?? 1.6;
        const p = obj.phase ?? 0;
        obj.position[0] = (obj.baseX ?? 0) + Math.sin(state.clock.elapsedTime * w + p) * a;

        // Reserve a clear lane: the moving wall never invades the outermost half-lanes,
        // while the ground sweeper stays its swing fully inside the playable corridor.
        const maxLane = Math.floor(laneCount / 2);
        const bound = obj.type === ObjectType.MOVING_WALL
          ? Math.max(0, (maxLane - 0.85) * LANE_WIDTH)
          : Math.max(0, (maxLane - 0.45) * LANE_WIDTH);
        obj.position[0] = THREE.MathUtils.clamp(obj.position[0], -bound, bound);
      }

      const prevZ = obj.position[2];
      obj.position[2] += moveAmount;

      // Rival Defender throws a bullet basketball pass when in range
      if (obj.type === ObjectType.ALIEN && obj.active && !obj.hasFired) {
        if (obj.position[2] > -90) {
          obj.hasFired = true;

          newSpawns.push({
            id: uuidv4(),
            type: ObjectType.MISSILE,
            position: [obj.position[0], 0.8, obj.position[2] + 2],
            active: true,
            color: '#ea580c'
          });
          hasChanges = true;

          window.dispatchEvent(new CustomEvent('particle-burst', {
            detail: { position: obj.position, color: '#f59e0b' }
          }));
        }
      }

      let keep = true;
      if (obj.active) {
        const zThreshold = 2.0;
        const inZZone = (prevZ < playerPos.z + zThreshold) && (obj.position[2] > playerPos.z - zThreshold);

        // Shop Portal collision
        if (obj.type === ObjectType.SHOP_PORTAL) {
          const dz = Math.abs(obj.position[2] - playerPos.z);
          if (dz < 2.2) {
            openShop();
            obj.active = false;
            hasChanges = true;
            keep = false;
          }
        } else if (obj.type === ObjectType.HOOP) {
          // Missed hoop detection if passed without dunking
          if (!obj.isDunked && !obj.hasMissed && obj.position[2] > playerPos.z + 1.8) {
            obj.hasMissed = true;
            if (obj.isShowtime) {
              window.dispatchEvent(new CustomEvent('showtime-missed', {
                detail: { position: obj.position }
              }));
            } else if (dunkStreak > 0) {
              crowdAudioController.triggerMissedHoopGroan(dunkStreak);
              resetDunkStreak();
            }
          }

          // Basketball Hoop Dunk Collision
          const dz = Math.abs(obj.position[2] - playerPos.z);
          const dx = Math.abs(obj.position[0] - playerPos.x);

          if (dx < 0.95 && dz < 1.6) {
            // Player leaps into the rim zone to execute a monster slam dunk!
            const isAirborne = playerPos.y > 1.2;
            if (isAirborne && !obj.isDunked) {
              obj.isDunked = true;
              obj.active = false;
              hasChanges = true;

              // Showtime Lane checkpoint: watch the SLAM CAM timing resolution for the bonus
              if (obj.isShowtime) {
                showtimePending = obj;
                setTimeout(() => {
                  if (showtimePending === obj) {
                    showtimePending = null;
                    // Silent-timeout penalty: the timing window expired un-released
                    window.dispatchEvent(new CustomEvent('showtime-missed', {
                      detail: { position: obj.position }
                    }));
                    window.dispatchEvent(new CustomEvent('score-popup', {
                      detail: {
                        position: [obj.position[0], 3.0, obj.position[2]],
                        text: 'SHOWTIME MISSED',
                        sub: 'Timing window expired',
                        color: '#94a3b8',
                        scale: 0.9,
                      }
                    }));
                  }
                }, 4500);
              }

              // Modulate crowd cheering volume dynamically based on current dunk success streak
              incrementDunkStreak();
              const currentStreak = dunkStreak + 1;
              crowdAudioController.triggerStreakDunkCheer(currentStreak, obj.position);
              setHoopTension(0);

              // 1. Trigger cinematic slow-motion pause & side-profile camera
              startDunkCinematic([obj.position[0], 2.45, obj.position[2]]);
              audio.playSlowMoStart();

              // 2. Camera Screen Shake triggered by collision system
              window.dispatchEvent(new CustomEvent('screen-shake', {
                detail: { intensity: 0.95, duration: 0.45 }
              }));

              // 3. Broadcast Dunk Event
              window.dispatchEvent(new CustomEvent('dunk-success', {
                detail: {
                  position: obj.position,
                  points: 300,
                  text: 'SLAM DUNK!'
                }
              }));
              window.dispatchEvent(new CustomEvent('score-popup', {
                detail: {
                  position: [obj.position[0], 2.6, obj.position[2]],
                  text: 'SLAM DUNK!',
                  sub: '+300',
                  color: '#f59e0b',
                  scale: 1.4,
                }
              }));
              announcer.onDunk(false);

              // 4. Heavy metallic rim rattle & stadium roar
              audio.playDunk();
              addScore(300);

              // 5. Fiery rim sparks & net shimmer burst
              window.dispatchEvent(new CustomEvent('particle-burst', {
                detail: { position: [obj.position[0], 2.45, obj.position[2]], color: '#ea580c' }
              }));
              window.dispatchEvent(new CustomEvent('particle-burst', {
                detail: { position: [obj.position[0], 2.2, obj.position[2]], color: '#fbbf24' }
              }));
              window.dispatchEvent(new CustomEvent('particle-burst', {
                detail: { position: [obj.position[0], 2.6, obj.position[2]], color: '#ffffff' }
              }));
            }
          }
        } else if (inZZone) {
          const dx = Math.abs(obj.position[0] - playerPos.x);
          // Hitbox forgiveness: player must overlap ~80% of damage-source width to be clipped
          if (dx < 0.8) {
            const isDamageSource = obj.type === ObjectType.OBSTACLE || obj.type === ObjectType.ALIEN || obj.type === ObjectType.MISSILE || obj.type === ObjectType.MOVING_WALL || obj.type === ObjectType.SWEEPER;

            // Player is invincible during cinematic slow-mo slam dunk
            if (isDamageSource && isDunkSlowMo) {
              continue;
            }

            if (isDamageSource) {
              const playerBottom = playerPos.y;
              const playerTop = playerPos.y + 1.8;

              let objBottom = obj.position[1] - 0.5;
              let objTop = obj.position[1] + 0.5;

              if (obj.type === ObjectType.OBSTACLE || obj.type === ObjectType.MOVING_WALL) {
                objBottom = 0;
                objTop = OBSTACLE_HEIGHT;
              } else if (obj.type === ObjectType.MISSILE) {
                objBottom = 0.3;
                objTop = 1.3;
              } else if (obj.type === ObjectType.SWEEPER) {
                objBottom = 0.25;
                objTop = 1.05;
              }

              const isHit = (playerBottom < objTop) && (playerTop > objBottom);

              if (isHit) {
                if (isImmortalityActive) {
                  // Power Smash through defender/obstacle while ON FIRE!
                  window.dispatchEvent(new CustomEvent('screen-shake', {
                    detail: { intensity: 0.75, duration: 0.35 }
                  }));
                  window.dispatchEvent(new CustomEvent('dunk-success', {
                    detail: {
                      position: obj.position,
                      points: 200,
                      text: 'POWER CRUSH!'
                    }
                  }));
                  window.dispatchEvent(new CustomEvent('score-popup', {
                    detail: {
                      position: [obj.position[0], 1.4, obj.position[2]],
                      text: 'POWER CRUSH!',
                      sub: '+200',
                      color: '#ff7700',
                      scale: 1.3,
                    }
                  }));
                  announcer.onPower();
                  audio.playDunk();
                  addScore(200);
                  obj.active = false;
                  hasChanges = true;
                  window.dispatchEvent(new CustomEvent('particle-burst', {
                    detail: { position: obj.position, color: '#ff7700' }
                  }));
                } else {
                  window.dispatchEvent(new Event('player-hit'));
                  obj.active = false;
                  hasChanges = true;
                  announcer.onPlayerHit();

                  if (obj.type === ObjectType.MISSILE) {
                    window.dispatchEvent(new CustomEvent('particle-burst', {
                      detail: { position: obj.position, color: '#ea580c' }
                    }));
                  }
                }
              }
            } else {
              // Collectible (Basketball or Letter)
              const dy = Math.abs(obj.position[1] - playerPos.y);
              if (dy < 2.5) {
                if (obj.type === ObjectType.GEM) {
                  const isElevatedBall = obj.position[1] >= 1.8;
                  const isAirborne = playerPos.y > 1.2;

                  if (isElevatedBall && isAirborne) {
                    // Elevated Dunk performed!
                    incrementDunkStreak();
                    const nextStreak = dunkStreak + 1;
                    crowdAudioController.triggerStreakDunkCheer(nextStreak, obj.position);
                    setHoopTension(0);

                    window.dispatchEvent(new CustomEvent('screen-shake', {
                      detail: { intensity: 0.85, duration: 0.4 }
                    }));
                    window.dispatchEvent(new CustomEvent('dunk-success', {
                      detail: {
                        position: obj.position,
                        points: obj.points || 150,
                        text: 'ALLEY-OOP DUNK!'
                      }
                    }));
                    window.dispatchEvent(new CustomEvent('score-popup', {
                      detail: {
                        position: [obj.position[0], 1.8, obj.position[2]],
                        text: 'ALLEY-OOP!',
                        sub: `+${(obj.points || 150)}`,
                        color: '#fbbf24',
                        scale: 1.2,
                      }
                    }));
                    announcer.onDunk(false);
                    audio.playDunk();
                  } else {
                    audio.playGemCollect();
                  }
                  collectGem(obj.points || 50);
                  if (!(isElevatedBall && isAirborne)) {
                    window.dispatchEvent(new CustomEvent('score-popup', {
                      detail: {
                        position: [obj.position[0], 1, obj.position[2]],
                        text: `+${(obj.points || 50)}`,
                        sub: '',
                        color: obj.points && obj.points >= 100 ? '#ffd700' : '#ea580c',
                        scale: 0.9,
                      }
                    }));
                  }
                }
                if (obj.type === ObjectType.LETTER && obj.targetIndex !== undefined) {
                  if (playerPos.y > 1.3) {
                    window.dispatchEvent(new CustomEvent('screen-shake', {
                      detail: { intensity: 0.65, duration: 0.35 }
                    }));
                  }
                  collectLetter(obj.targetIndex);
                  audio.playLetterCollect();
                  ambientAudio.triggerLetterCheer(obj.targetIndex);
                  window.dispatchEvent(new CustomEvent('score-popup', {
                    detail: {
                      position: [obj.position[0], 1.6, obj.position[2]],
                      text: obj.value || 'LETTER',
                      sub: 'COLLECTED',
                      color: obj.color || '#ffffff',
                      scale: 1.1,
                    }
                  }));
                  window.dispatchEvent(new CustomEvent('letter-trail', {
                    detail: { position: obj.position }
                  }));
                }

                window.dispatchEvent(new CustomEvent('particle-burst', {
                  detail: {
                    position: obj.position,
                    color: obj.color || '#ea580c'
                  }
                }));

                obj.active = false;
                hasChanges = true;
              }
            }
          }
        }
      }

      if (obj.position[2] > REMOVE_DISTANCE) {
        keep = false;
        hasChanges = true;
      }

      if (keep) {
        keptObjects.push(obj);
      }
    }

    if (newSpawns.length > 0) {
      keptObjects.push(...newSpawns);
    }

    // CrowdAudioController: Calculate distance to nearest upcoming hoop & modulate crowd tension
    let nearestHoopDist = 999;
    for (const o of keptObjects) {
      if (o.type === ObjectType.HOOP && o.active && !o.isDunked) {
        const dist = playerPos.z - o.position[2]; // positive when hoop is ahead of player
        if (dist >= -1.0 && dist < nearestHoopDist) {
          nearestHoopDist = dist;
        }
      }
    }

    if (nearestHoopDist < 999) {
      crowdAudioController.updateHoopProximity(nearestHoopDist, dunkStreak);
      const normalizedTension = Math.max(0, Math.min(1, (42 - Math.max(4, nearestHoopDist)) / 38));
      setHoopTension(normalizedTension);
    } else {
      crowdAudioController.updateHoopProximity(999, dunkStreak);
      setHoopTension(0);
    }

    // 2. Spawning Logic
    let furthestZ = 0;
    const staticObjects = keptObjects.filter(o => o.type !== ObjectType.MISSILE);

    if (staticObjects.length > 0) {
      furthestZ = Math.min(...staticObjects.map(o => o.position[2]));
    } else {
      furthestZ = -20;
    }

    if (furthestZ > -SPAWN_DISTANCE) {
      const minGap = 12 + (speed * 0.4);
      const spawnZ = Math.min(furthestZ - minGap, -SPAWN_DISTANCE);

      // Startup grace period: give the player a clear straightaway off the tip-off
      if (distanceTraveled.current < GRACE_DISTANCE) {
        return;
      }

      const isLetterDue = distanceTraveled.current >= nextLetterDistance.current;

      if (isLetterDue) {
        const lane = getRandomLane(laneCount);
        const target = BASKET_TARGET; // ['B', 'A', 'S', 'K', 'E', 'T']

        const availableIndices = target.map((_, i) => i).filter(i => !collectedLetters.includes(i));

        if (availableIndices.length > 0) {
          const chosenIndex = availableIndices[Math.floor(spawnRng() * availableIndices.length)];
          const val = target[chosenIndex];
          const color = GEMINI_COLORS[chosenIndex];

          keptObjects.push({
            id: uuidv4(),
            type: ObjectType.LETTER,
            position: [lane * LANE_WIDTH, 1.1, spawnZ],
            active: true,
            color: color,
            value: val,
            targetIndex: chosenIndex
          });

          nextLetterDistance.current += getLetterInterval(level);
          hasChanges = true;
        } else {
          // Fallback to Golden Basketball
          keptObjects.push({
            id: uuidv4(),
            type: ObjectType.GEM,
            position: [lane * LANE_WIDTH, 1.2, spawnZ],
            active: true,
            color: '#f59e0b',
            points: 100
          });
          hasChanges = true;
        }
      } else if (distanceTraveled.current >= showtimeNext.current) {
        // SHOWTIME LANE: Golden dunk checkpoint every 500 yards
        const lane = getRandomLane(laneCount);
        const laneX = lane * LANE_WIDTH;

        keptObjects.push({
          id: uuidv4(),
          type: ObjectType.HOOP,
          position: [laneX, 2.45, spawnZ],
          active: true,
          color: '#ffd700',
          points: 1500,
          isShowtime: true
        });

        showtimeNext.current += SHOWTIME_INTERVAL;
        hasChanges = true;
      } else if (spawnRng() > 0.08) {
        const roll = spawnRng();

        if (roll < 0.28) {
          // Basketball Hoop Dunk Opportunity!
          const lane = getRandomLane(laneCount);
          const laneX = lane * LANE_WIDTH;

          keptObjects.push({
            id: uuidv4(),
            type: ObjectType.HOOP,
            position: [laneX, 2.45, spawnZ],
            active: true,
            color: '#ff5500',
            points: 300
          });

          // Chance for an obstacle right beneath/before the hoop for a soaring leap & dunk
          if (spawnRng() < 0.45) {
            keptObjects.push({
              id: uuidv4(),
              type: ObjectType.OBSTACLE,
              position: [laneX, OBSTACLE_HEIGHT / 2, spawnZ + 2.4],
              active: true,
              color: '#ea580c'
            });
          }
          hasChanges = true;
        } else if (roll < 0.78) {
          const advancedRoll = spawnRng();

          if (level >= 2 && advancedRoll < (level >= 3 ? 0.42 : 0.3)) {
            // ADVANCED DEFENSE: one laterally-moving danger (moving wall Q2+, ground sweeper Q3+)
            const movingWall = level >= 3 && spawnRng() < 0.5;
            const baseLane = Math.floor((spawnRng() * laneCount) - Math.floor(laneCount / 2));
            const baseX = baseLane * LANE_WIDTH;

            keptObjects.push({
              id: uuidv4(),
              type: movingWall ? ObjectType.MOVING_WALL : ObjectType.SWEEPER,
              position: [baseX, movingWall ? OBSTACLE_HEIGHT / 2 : 0.65, spawnZ],
              active: true,
              color: movingWall ? '#fb923c' : '#facc15',
              baseX,
              amplitude: movingWall ? LANE_WIDTH * 1.7 : LANE_WIDTH * 1.4,
              phase: spawnRng() * Math.PI * 2,
              oscSpeed: movingWall ? 1.35 : 2.2
            });

            // A static dummy on a remaining lane keeps pressure while the lane is clear
            const maxLane = Math.floor(laneCount / 2);
            const otherLane = baseLane < 0 ? baseLane + 1 : baseLane > 0 ? baseLane - 1 : (spawnRng() < 0.5 ? -1 : 1);
            if (maxLane >= 1 && spawnRng() < 0.55) {
              keptObjects.push({
                id: uuidv4(),
                type: ObjectType.OBSTACLE,
                position: [otherLane * LANE_WIDTH, OBSTACLE_HEIGHT / 2, spawnZ],
                active: true,
                color: '#ea580c'
              });
            }
            hasChanges = true;
          } else {
            const spawnRival = level >= 2 && spawnRng() < 0.22;

            if (spawnRival) {
              const availableLanes: number[] = [];
              const maxLane = Math.floor(laneCount / 2);
              for (let i = -maxLane; i <= maxLane; i++) availableLanes.push(i);
              availableLanes.sort(() => spawnRng() - 0.5);

              // Guaranteed clear lane: always leave at least one lane open
              const maxBlock = Math.max(1, availableLanes.length - 1);

              let defenderCount = 1;
              const p = spawnRng();
              if (p > 0.7) defenderCount = Math.min(2, maxBlock);
              if (p > 0.9 && availableLanes.length >= 3) defenderCount = Math.min(3, maxBlock);

              for (let k = 0; k < defenderCount; k++) {
                const lane = availableLanes[k];
                keptObjects.push({
                  id: uuidv4(),
                  type: ObjectType.ALIEN,
                  position: [lane * LANE_WIDTH, 1.2, spawnZ],
                  active: true,
                  color: '#7c3aed',
                  hasFired: false
                });
              }
            } else {
              // Standard Obstacle: Basketball D-Man Training Dummy
              const availableLanes: number[] = [];
              const maxLane = Math.floor(laneCount / 2);
              for (let i = -maxLane; i <= maxLane; i++) availableLanes.push(i);
              availableLanes.sort(() => spawnRng() - 0.5);

              // Guaranteed clear lane: always leave at least one lane open
              const maxBlock = Math.max(1, availableLanes.length - 1);

              let countToSpawn = 1;
              const p = spawnRng();
              if (p > 0.80) countToSpawn = Math.min(3, maxBlock);
              else if (p > 0.50) countToSpawn = Math.min(2, maxBlock);

              for (let i = 0; i < countToSpawn; i++) {
                const lane = availableLanes[i];
                const laneX = lane * LANE_WIDTH;

                keptObjects.push({
                  id: uuidv4(),
                  type: ObjectType.OBSTACLE,
                  position: [laneX, OBSTACLE_HEIGHT / 2, spawnZ],
                  active: true,
                  color: '#ea580c'
                });

                // Chance for Golden Basketball on top of dummy
                if (spawnRng() < 0.35) {
                  keptObjects.push({
                    id: uuidv4(),
                    type: ObjectType.GEM,
                    position: [laneX, OBSTACLE_HEIGHT + 0.9, spawnZ],
                    active: true,
                    color: '#f59e0b',
                    points: 100
                  });
                }
              }
            }
          }
        } else {
          // Ground Basketball Collectible
          const lane = getRandomLane(laneCount);
          keptObjects.push({
            id: uuidv4(),
            type: ObjectType.GEM,
            position: [lane * LANE_WIDTH, 1.1, spawnZ],
            active: true,
            color: '#ea580c',
            points: 50
          });
        }
        hasChanges = true;
      }
    }

    if (hasChanges) {
      objectsRef.current = keptObjects;
      setRenderTrigger(t => t + 1);
    }
  });

  return (
    <group>
      <ParticleSystem />
      {objectsRef.current.map(obj => {
        if (!obj.active) return null;
        return <GameEntity key={obj.id} data={obj} />;
      })}
    </group>
  );
};

const GameEntity: React.FC<{ data: GameObject }> = React.memo(({ data }) => {
  const groupRef = useRef<THREE.Group>(null);
  const visualRef = useRef<THREE.Group>(null);
  const shadowRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const rimRef = useRef<THREE.Mesh>(null);
  const netRef = useRef<THREE.Mesh>(null);
  const boardRef = useRef<THREE.Group>(null);
  const boardMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const netMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const punchRef = useRef(0);
  const boardFlash = useRef(0);
  const { laneCount } = useStore();

  // Hoop rim / net / backboard reaction when slammed
  useEffect(() => {
    const handleDunk = (e: any) => {
      const pos = e.detail?.position;
      if (!pos || data.type !== ObjectType.HOOP) return;
      const dx = Math.abs(pos[0] - data.position[0]);
      const dz = Math.abs(pos[2] - data.position[2]);
      if (dx < 1.2 && dz < 1.2) {
        punchRef.current = 1;
        boardFlash.current = 1;
      }
    };
    window.addEventListener('dunk-success', handleDunk);
    return () => window.removeEventListener('dunk-success', handleDunk);
  }, [data]);

  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.position.set(data.position[0], 0, data.position[2]);
    }

    // Danger telegraph: pulsing ground glow under oncoming threats
    const isTelegraphable =
      data.type === ObjectType.OBSTACLE ||
      data.type === ObjectType.ALIEN ||
      data.type === ObjectType.MISSILE ||
      data.type === ObjectType.HOOP ||
      data.type === ObjectType.MOVING_WALL ||
      data.type === ObjectType.SWEEPER;
    const telegraphOn = isTelegraphable && data.position[2] > -35;
    if (glowRef.current) {
      if (telegraphOn) {
        glowRef.current.visible = true;
        const pulse = 0.5 + 0.5 * Math.sin(state.clock.elapsedTime * 7);
        (glowRef.current.material as THREE.MeshBasicMaterial).opacity = 0.10 + pulse * 0.24;
        const s = 1 + pulse * 0.14;
        glowRef.current.scale.set(s, s, 1);
      } else {
        glowRef.current.visible = false;
      }
    }

    // Slam dunk rim punch / net wobble / backboard shake + broadcast-grade flash
    if (punchRef.current > 0) {
      punchRef.current = Math.max(0, punchRef.current - delta * 2.4);
      const p = punchRef.current;
      if (rimRef.current) {
        rimRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 38) * 0.14 * p;
      }
      if (netRef.current) {
        netRef.current.scale.set(
          1 + Math.sin(state.clock.elapsedTime * 24) * 0.06 * p,
          1 + Math.sin(state.clock.elapsedTime * 30) * 0.09 * p,
          1
        );
        netRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 33) * 0.1 * p;
      }
      if (boardRef.current) {
        boardRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 20) * 0.035 * p;
      }
    }

    // Tempered-glass backboard ignites with a warm emissive flash + net lightens on thunder
    if (boardFlash.current > 0) {
      boardFlash.current = Math.max(0, boardFlash.current - delta * 3.2);
      if (boardMatRef.current) {
        boardMatRef.current.emissiveIntensity = boardFlash.current * 2.4;
      }
      if (netMatRef.current) {
        netMatRef.current.color.set('#fff7ed');
      }
    } else if (netMatRef.current) {
      netMatRef.current.color.set('#ffffff');
    }

    // Showtime halo breathes to draw the eye ahead of the golden hoop
    if (haloRef.current) {
      haloRef.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 6.5) * 0.09);
    }

    if (visualRef.current) {
      const baseHeight = data.position[1];

      if (data.type === ObjectType.SHOP_PORTAL) {
        visualRef.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 2) * 0.015);
      } else if (data.type === ObjectType.MISSILE) {
        // Fast spinning bullet pass
        visualRef.current.rotation.x += delta * 18;
        visualRef.current.position.y = baseHeight;
      } else if (data.type === ObjectType.ALIEN) {
        // Defensive slide bobbing
        visualRef.current.position.y = baseHeight + Math.sin(state.clock.elapsedTime * 4) * 0.12;
        visualRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 2) * 0.2;
      } else if (data.type !== ObjectType.OBSTACLE && data.type !== ObjectType.MOVING_WALL && data.type !== ObjectType.SWEEPER) {
        // Basketball / Letter Bobbing & Spinning
        visualRef.current.rotation.y += delta * 3.5;
        const bobOffset = Math.sin(state.clock.elapsedTime * 4 + data.position[0]) * 0.12;
        visualRef.current.position.y = baseHeight + bobOffset;

        if (shadowRef.current) {
          const shadowScale = 1 - bobOffset;
          shadowRef.current.scale.setScalar(shadowScale);
        }
      } else {
        visualRef.current.position.y = baseHeight;
      }
    }
  });

  const shadowGeo = useMemo(() => {
    if (data.type === ObjectType.LETTER) return SHADOW_LETTER_GEO;
    if (data.type === ObjectType.GEM) return SHADOW_BALL_GEO;
    if (data.type === ObjectType.SHOP_PORTAL) return null;
    if (data.type === ObjectType.ALIEN) return SHADOW_DEFENDER_GEO;
    if (data.type === ObjectType.MISSILE) return SHADOW_BALL_GEO;
    if (data.type === ObjectType.HOOP) return SHADOW_HOOP_GEO;
    return SHADOW_DEFAULT_GEO;
  }, [data.type]);

  const isGoldBall = data.points && data.points >= 100;

  return (
    <group ref={groupRef} position={[data.position[0], 0, data.position[2]]}>
      {data.type !== ObjectType.SHOP_PORTAL && shadowGeo && (
        <mesh ref={shadowRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} geometry={shadowGeo}>
          <meshBasicMaterial color="#0f172a" opacity={0.32} transparent />
        </mesh>
      )}

      {/* Danger Telegraph Glow (lights up as dangers approach) */}
      <mesh ref={glowRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.045, 0]} geometry={TELEGRAPH_GEO} visible={false}>
        <meshBasicMaterial
          color={
            data.type === ObjectType.ALIEN ? '#a78bfa' :
            data.type === ObjectType.MISSILE ? '#f87171' :
            data.type === ObjectType.HOOP ? (data.isShowtime ? '#ffd700' : '#fbbf24') :
            data.type === ObjectType.MOVING_WALL ? '#fb923c' :
            data.type === ObjectType.SWEEPER ? '#facc15' : '#fb923c'
          }
          transparent opacity={0}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      <group ref={visualRef} position={[0, data.position[1], 0]}>
        {/* --- PRO LOCKER ROOM PORTAL --- */}
        {data.type === ObjectType.SHOP_PORTAL && (
          <group>
            {/* Architectural Entrance Frame */}
            <mesh position={[0, 2.9, 0]} geometry={SHOP_FRAME_GEO} scale={[laneCount * LANE_WIDTH + 2.5, 1, 1]} castShadow>
              <meshStandardMaterial color="#1e3a8a" roughness={0.3} metalness={0.5} />
            </mesh>
            {/* Entrance Interior */}
            <mesh position={[0, 2.2, 0]} geometry={SHOP_BACK_GEO} scale={[laneCount * LANE_WIDTH + 0.5, 1, 1]}>
              <meshBasicMaterial color="#0f172a" />
            </mesh>
            {/* Neon Court Accents */}
            <mesh position={[0, 3.1, 0]} geometry={SHOP_OUTLINE_GEO} scale={[laneCount * LANE_WIDTH + 2.7, 1, 1]}>
              <meshBasicMaterial color="#ea580c" wireframe transparent opacity={0.5} />
            </mesh>
            <Center position={[0, 4.9, 0.7]}>
              <Text3D font={FONT_URL} size={1.0} height={0.25} bevelEnabled bevelThickness={0.02} bevelSize={0.02}>
                LOCKER ROOM
                <meshStandardMaterial color="#f59e0b" emissive="#ea580c" emissiveIntensity={0.6} />
              </Text3D>
            </Center>
            {/* Runway Court Carpet */}
            <mesh position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]} geometry={SHOP_FLOOR_GEO} scale={[laneCount * LANE_WIDTH, 1, 1]}>
              <meshBasicMaterial color="#ea580c" transparent opacity={0.4} />
            </mesh>
          </group>
        )}

        {/* --- BASKETBALL HOOP (DUNK TARGET) --- */}
        {data.type === ObjectType.HOOP && (
          <group position={[0, -data.position[1], 0]}>
            {/* Stanchion Pole positioned at edge of the lane */}
            <mesh position={[1.15, 1.6, 0.4]} castShadow geometry={HOOP_STANCHION_GEO}>
              <meshStandardMaterial color="#0f172a" metalness={0.7} roughness={0.3} />
            </mesh>
            {/* Overhanging Arm extending over the center of the lane */}
            <mesh position={[0.58, 2.9, 0.2]} rotation={[0, 0, -0.38]} castShadow geometry={HOOP_ARM_GEO}>
              <meshStandardMaterial color="#0f172a" metalness={0.7} roughness={0.3} />
            </mesh>

            {/* Backboard Assembly at dunk height */}
            <group ref={boardRef} position={[0, 2.85, 0]}>
              {/* Tempered Glass Backboard */}
              <mesh geometry={HOOP_BACKBOARD_GEO} castShadow>
                <meshStandardMaterial
                  ref={boardMatRef}
                  color="#ffffff"
                  transparent
                  opacity={0.7}
                  roughness={0.1}
                  metalness={0.2}
                  emissive={data.isShowtime ? '#ffd700' : '#ea580c'}
                  emissiveIntensity={data.isShowtime ? 0.55 : 0}
                />
              </mesh>
              {/* Inner Target Square */}
              <mesh position={[0, -0.15, 0.03]} geometry={HOOP_TARGET_GEO}>
                <meshBasicMaterial color="#ea580c" wireframe />
              </mesh>
              {/* Backboard Bottom Safety Padding */}
              <mesh position={[0, -0.5, 0]}>
                <boxGeometry args={[1.62, 0.06, 0.07]} />
                <meshStandardMaterial color="#1e3a8a" />
              </mesh>

              {/* Breakaway Orange Steel Rim */}
              <mesh ref={rimRef} position={[0, -0.4, 0.42]} rotation={[Math.PI / 2, 0, 0]} geometry={HOOP_RIM_GEO} castShadow>
                <meshStandardMaterial color="#ff5500" metalness={0.3} roughness={0.2} emissive="#ff4400" emissiveIntensity={0.5} />
              </mesh>

              {/* White Braided Nylon Net */}
              <mesh ref={netRef} position={[0, -0.68, 0.42]} geometry={HOOP_NET_GEO}>
                <meshBasicMaterial ref={netMatRef} color="#ffffff" wireframe transparent opacity={0.8} />
              </mesh>

              {/* Pulsating Golden Slam Zone Halo */}
              <mesh position={[0, -0.4, 0.42]} rotation={[Math.PI / 2, 0, 0]} geometry={HOOP_HALO_GEO}>
                <meshBasicMaterial color={data.isShowtime ? '#ffd700' : '#f59e0b'} transparent opacity={data.isShowtime ? 0.95 : 0.65} />
              </mesh>

              {/* SHOWTIME LANE: outer gold halo + pulsing beacon lamp */}
              {data.isShowtime && (
                <group>
                  <mesh ref={haloRef} position={[0, -0.4, 0.42]} rotation={[Math.PI / 2, 0, 0]} geometry={SHOWTIME_HALO_GEO}>
                    <meshBasicMaterial color="#ffd700" transparent opacity={0.85} />
                  </mesh>
                  <mesh position={[0, 0.7, 0]}>
                    <boxGeometry args={[0.5, 0.4, 0.18]} />
                    <meshBasicMaterial color="#0f172a" />
                  </mesh>
                  <mesh position={[0, 0.7, 0.1]}>
                    <planeGeometry args={[0.34, 0.24]} />
                    <meshBasicMaterial color="#ffd700" />
                  </mesh>
                </group>
              )}

            </group>
          </group>
        )}

        {/* --- D-MAN DEFENSE DUMMY (OBSTACLE) --- */}
        {data.type === ObjectType.OBSTACLE && (
          <group position={[0, -OBSTACLE_HEIGHT / 2, 0]}>
            {/* Weighted Floor Stand */}
            <mesh position={[0, 0.06, 0]} geometry={DUMMY_BASE_GEO} castShadow>
              <meshStandardMaterial color="#0f172a" roughness={0.6} metalness={0.4} />
            </mesh>
            {/* Steel Pole */}
            <mesh position={[0, 0.75, 0]} geometry={DUMMY_POLE_GEO} castShadow>
              <meshStandardMaterial color="#64748b" metalness={0.8} roughness={0.2} />
            </mesh>
            {/* Orange Training Silhouette Torso */}
            <mesh position={[0, 1.1, 0]} geometry={DUMMY_BODY_GEO} castShadow>
              <meshStandardMaterial color="#ea580c" roughness={0.4} />
            </mesh>
            {/* "D-UP" printed jersey marking */}
            <mesh position={[0, 1.1, 0.07]}>
              <planeGeometry args={[0.42, 0.35]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
            {/* Raised Blocking Arms */}
            <mesh position={[0, 1.48, 0]} geometry={DUMMY_ARMS_GEO} castShadow>
              <meshStandardMaterial color="#ea580c" roughness={0.4} />
            </mesh>
            {/* Head */}
            <mesh position={[0, 1.62, 0]} geometry={DUMMY_HEAD_GEO} castShadow>
              <meshStandardMaterial color="#0f172a" roughness={0.5} />
            </mesh>
          </group>
        )}

        {/* --- MOVING WALL (LEVEL 2+) --- */}
        {data.type === ObjectType.MOVING_WALL && (
          <group>
            {/* Hazard Body */}
            <mesh geometry={WALL_GEO} castShadow>
              <meshStandardMaterial color="#7f1d1d" roughness={0.55} />
            </mesh>
            {/* Hazard Warning Stripes */}
            <mesh position={[0, 0, 0.15]} geometry={WALL_STRIPE_GEO} rotation={[Math.PI / 2, 0, 0]}>
              <meshBasicMaterial color="#fb923c" />
            </mesh>
          </group>
        )}

        {/* --- GROUND SWEEPER (LEVEL 3+) --- */}
        {data.type === ObjectType.SWEEPER && (
          <group>
            {/* Low-Sweeping Hazard Beam */}
            <mesh geometry={SWEEP_GEO} rotation={[0, 0, Math.PI / 2]} castShadow>
              <meshStandardMaterial color="#713f12" roughness={0.5} />
            </mesh>
            {/* Warning End Caps */}
            <mesh position={[LANE_WIDTH * 1.6, 0, 0]} geometry={SWEEP_END_GEO} castShadow>
              <meshStandardMaterial color="#facc15" emissive="#facc15" emissiveIntensity={0.5} roughness={0.35} />
            </mesh>
            <mesh position={[-LANE_WIDTH * 1.6, 0, 0]} geometry={SWEEP_END_GEO} castShadow>
              <meshStandardMaterial color="#facc15" emissive="#facc15" emissiveIntensity={0.5} roughness={0.35} />
            </mesh>
          </group>
        )}

        {/* --- RIVAL DEFENDER (LEVEL 2+) --- */}
        {data.type === ObjectType.ALIEN && (
          <group>
            {/* Rival Jersey */}
            <mesh castShadow geometry={RIVAL_BODY_GEO}>
              <meshStandardMaterial color="#7c3aed" roughness={0.5} />
            </mesh>
            {/* Head with Headband */}
            <mesh position={[0, 0.52, 0]} castShadow geometry={RIVAL_HEAD_GEO}>
              <meshStandardMaterial color="#a16207" roughness={0.7} />
            </mesh>
            <mesh position={[0, 0.56, 0]}>
              <boxGeometry args={[0.3, 0.08, 0.3]} />
              <meshBasicMaterial color="#f59e0b" />
            </mesh>
            {/* Wide Outstretched Guarding Arms */}
            <mesh position={[0, 0.2, 0]} castShadow geometry={RIVAL_ARMS_GEO}>
              <meshStandardMaterial color="#a16207" roughness={0.6} />
            </mesh>
            {/* Jersey Number #99 */}
            <mesh position={[0, 0.1, 0.23]}>
              <planeGeometry args={[0.22, 0.22]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
          </group>
        )}

        {/* --- BULLET BASKETBALL PASS (FAST OBSTACLE) --- */}
        {data.type === ObjectType.MISSILE && (
          <group>
            <mesh castShadow geometry={BULLET_BALL_GEO}>
              <meshStandardMaterial color="#ea580c" roughness={0.3} emissive="#ff5500" emissiveIntensity={0.8} />
            </mesh>
            {/* High-speed motion ring */}
            <mesh position={[0, 0, 0.25]} geometry={BULLET_RING_GEO}>
              <meshBasicMaterial color="#f59e0b" transparent opacity={0.7} />
            </mesh>
            <mesh position={[0, 0, 0.5]} geometry={BULLET_RING_GEO}>
              <meshBasicMaterial color="#ffffff" transparent opacity={0.4} />
            </mesh>
          </group>
        )}

        {/* --- BASKETBALL COLLECTIBLE (GEM) --- */}
        {data.type === ObjectType.GEM && (
          <group>
            <mesh castShadow geometry={BASKETBALL_COLLECT_GEO}>
              <meshStandardMaterial
                color={isGoldBall ? '#f59e0b' : '#ea580c'}
                metalness={isGoldBall ? 0.8 : 0.1}
                roughness={isGoldBall ? 0.2 : 0.4}
                emissive={isGoldBall ? '#ffd700' : '#ea580c'}
                emissiveIntensity={isGoldBall ? 0.8 : 0.3}
              />
            </mesh>
            {/* Black Channel Seams */}
            <mesh geometry={BASKETBALL_SEAMS_GEO}>
              <meshBasicMaterial color={isGoldBall ? '#78350f' : '#0f172a'} wireframe />
            </mesh>
            {isGoldBall && (
              <pointLight color="#fbbf24" intensity={1.5} distance={3} />
            )}
          </group>
        )}

        {/* --- VARSITY ATHLETIC LETTER (B-A-S-K-E-T) --- */}
        {data.type === ObjectType.LETTER && (
          <group scale={[1.4, 1.4, 1.4]}>
            <Center>
              <Text3D
                font={FONT_URL}
                size={0.85}
                height={0.45}
                bevelEnabled
                bevelThickness={0.03}
                bevelSize={0.03}
                bevelSegments={5}
              >
                {data.value}
                <meshStandardMaterial
                  color={data.color}
                  roughness={0.25}
                  metalness={0.2}
                  emissive={data.color}
                  emissiveIntensity={0.4}
                />
              </Text3D>
            </Center>
          </group>
        )}
      </group>
    </group>
  );
});
