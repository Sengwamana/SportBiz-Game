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
import { GameObject, ObjectType, LANE_WIDTH, SPAWN_DISTANCE, REMOVE_DISTANCE, GameStatus, GEMINI_COLORS, BASKET_TARGET } from '../../types';
import { audio } from '../System/Audio';
import { ambientAudio } from '../System/AmbientAudio';
import { crowdAudioController } from '../System/CrowdAudioController';

// Geometry Constants
const OBSTACLE_HEIGHT = 1.6;

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
  return Math.floor(Math.random() * (max * 2 + 1)) - max;
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

  // Audio cue when cinematic slow-mo ends and normal speed snaps back
  useEffect(() => {
    if (prevDunkSlowMo.current && !isDunkSlowMo && status === GameStatus.PLAYING) {
      audio.playSlowMoEnd();
    }
    prevDunkSlowMo.current = isDunkSlowMo;
  }, [isDunkSlowMo, status]);

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
    } else if (isLevelUp && level > 1) {
      // Clear distant objects to place Shop Portal
      objectsRef.current = objectsRef.current.filter(obj => obj.position[2] > -80);

      // Arena cheer and organ fanfare for quarter advancement
      ambientAudio.triggerCheerSwell(0.9);
      ambientAudio.triggerArenaFanfare();

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
            if (dunkStreak > 0) {
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
          if (dx < 0.92) {
            const isDamageSource = obj.type === ObjectType.OBSTACLE || obj.type === ObjectType.ALIEN || obj.type === ObjectType.MISSILE;

            // Player is invincible during cinematic slow-mo slam dunk
            if (isDamageSource && isDunkSlowMo) {
              continue;
            }

            if (isDamageSource) {
              const playerBottom = playerPos.y;
              const playerTop = playerPos.y + 1.8;

              let objBottom = obj.position[1] - 0.5;
              let objTop = obj.position[1] + 0.5;

              if (obj.type === ObjectType.OBSTACLE) {
                objBottom = 0;
                objTop = OBSTACLE_HEIGHT;
              } else if (obj.type === ObjectType.MISSILE) {
                objBottom = 0.3;
                objTop = 1.3;
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
                    audio.playDunk();
                  } else {
                    audio.playGemCollect();
                  }
                  collectGem(obj.points || 50);
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

      const isLetterDue = distanceTraveled.current >= nextLetterDistance.current;

      if (isLetterDue) {
        const lane = getRandomLane(laneCount);
        const target = BASKET_TARGET; // ['B', 'A', 'S', 'K', 'E', 'T']

        const availableIndices = target.map((_, i) => i).filter(i => !collectedLetters.includes(i));

        if (availableIndices.length > 0) {
          const chosenIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
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
      } else if (Math.random() > 0.08) {
        const roll = Math.random();

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
          if (Math.random() < 0.45) {
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
          const spawnRival = level >= 2 && Math.random() < 0.22;

          if (spawnRival) {
            const availableLanes: number[] = [];
            const maxLane = Math.floor(laneCount / 2);
            for (let i = -maxLane; i <= maxLane; i++) availableLanes.push(i);
            availableLanes.sort(() => Math.random() - 0.5);

            let defenderCount = 1;
            const p = Math.random();
            if (p > 0.7) defenderCount = Math.min(2, availableLanes.length);
            if (p > 0.9 && availableLanes.length >= 3) defenderCount = 3;

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
            availableLanes.sort(() => Math.random() - 0.5);

            let countToSpawn = 1;
            const p = Math.random();
            if (p > 0.80) countToSpawn = Math.min(3, availableLanes.length);
            else if (p > 0.50) countToSpawn = Math.min(2, availableLanes.length);

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
              if (Math.random() < 0.35) {
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
  const { laneCount } = useStore();

  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.position.set(data.position[0], 0, data.position[2]);
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
      } else if (data.type !== ObjectType.OBSTACLE) {
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
            <group position={[0, 2.85, 0]}>
              {/* Tempered Glass Backboard */}
              <mesh geometry={HOOP_BACKBOARD_GEO} castShadow>
                <meshStandardMaterial color="#ffffff" transparent opacity={0.7} roughness={0.1} metalness={0.2} />
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
              <mesh position={[0, -0.4, 0.42]} rotation={[Math.PI / 2, 0, 0]} geometry={HOOP_RIM_GEO} castShadow>
                <meshStandardMaterial color="#ff5500" metalness={0.3} roughness={0.2} emissive="#ff4400" emissiveIntensity={0.5} />
              </mesh>

              {/* White Braided Nylon Net */}
              <mesh position={[0, -0.68, 0.42]} geometry={HOOP_NET_GEO}>
                <meshBasicMaterial color="#ffffff" wireframe transparent opacity={0.8} />
              </mesh>

              {/* Pulsating Golden Slam Zone Halo */}
              <mesh position={[0, -0.4, 0.42]} rotation={[Math.PI / 2, 0, 0]} geometry={HOOP_HALO_GEO}>
                <meshBasicMaterial color="#f59e0b" transparent opacity={0.65} />
              </mesh>
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
