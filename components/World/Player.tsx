import { useShallow } from 'zustand/react/shallow';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../../store';
import { LANE_WIDTH, GameStatus, SKINS } from '../../types';
import { audio } from '../System/Audio';

// Physics Constants
const GRAVITY = 50;
const JUMP_FORCE = 16; // Results in ~2.56 height (v^2 / 2g)

// Geometries for Basketball Player
const HEAD_GEO = new THREE.BoxGeometry(0.26, 0.28, 0.28);
const HEADBAND_GEO = new THREE.BoxGeometry(0.28, 0.08, 0.3);
const HAIR_GEO = new THREE.BoxGeometry(0.27, 0.1, 0.29);

const JERSEY_TORSO_GEO = new THREE.CylinderGeometry(0.26, 0.2, 0.65, 8);
const JERSEY_NUMBER_GEO = new THREE.PlaneGeometry(0.18, 0.24);

const SHORTS_GEO = new THREE.CylinderGeometry(0.22, 0.24, 0.35, 8);
const ARM_GEO = new THREE.BoxGeometry(0.11, 0.55, 0.11);
const SLEEVE_GEO = new THREE.BoxGeometry(0.12, 0.28, 0.12);
const WRISTBAND_GEO = new THREE.BoxGeometry(0.13, 0.07, 0.13);

const LEG_GEO = new THREE.BoxGeometry(0.13, 0.6, 0.13);
const SNEAKER_BASE_GEO = new THREE.BoxGeometry(0.18, 0.12, 0.32);
const SNEAKER_SOLE_GEO = new THREE.BoxGeometry(0.19, 0.04, 0.34);

const BASKETBALL_GEO = new THREE.SphereGeometry(0.24, 24, 24);
const SHADOW_GEO = new THREE.CircleGeometry(0.55, 32);

// Soft radial contact shadow texture
const SOFT_SHADOW_TEX = (() => {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  g.addColorStop(0, 'rgba(10, 15, 35, 1)');
  g.addColorStop(0.45, 'rgba(10, 15, 35, 0.65)');
  g.addColorStop(0.8, 'rgba(10, 15, 35, 0.16)');
  g.addColorStop(1, 'rgba(10, 15, 35, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
})();

export const Player: React.FC = () => {
  const groupRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const shadowRef = useRef<THREE.Mesh>(null);
  const ballRef = useRef<THREE.Group>(null);

  // Limb Refs for Animation
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);

  const { status, laneCount, takeDamage, hasDoubleJump, activateImmortality, isImmortalityActive, dribbleStreak, dribbleMultiplier, incrementDribbleStreak, skinId, isIntro } = useStore(useShallow(state => ({
    status: state.status,
    laneCount: state.laneCount,
    takeDamage: state.takeDamage,
    hasDoubleJump: state.hasDoubleJump,
    activateImmortality: state.activateImmortality,
    isImmortalityActive: state.isImmortalityActive,
    dribbleStreak: state.dribbleStreak,
    dribbleMultiplier: state.dribbleMultiplier,
    incrementDribbleStreak: state.incrementDribbleStreak,
    skinId: state.skinId,
    isIntro: state.isIntro,
  })));

  const [lane, setLane] = React.useState(0);
  const targetX = useRef(0);
  const prevLane = useRef(0);

  // Dribble Bounce & Impact Detection
  const prevDribblePhase = useRef(0);
  const lastBounceTime = useRef(0);

  // Physics State
  const isJumping = useRef(false);
  const velocityY = useRef(0);
  const jumpsPerformed = useRef(0);
  const spinRotation = useRef(0); // For double jump 360 slam flip
  const dunkFollowThrough = useRef(0); // For downward rim-hang snap on successful dunk
  const jumpHeld = useRef(false); // Variable jump height
  const bufferJumpAt = useRef(0); // Input buffering window
  const impactSquash = useRef(0); // Squash amount after landing
  const jumpStretch = useRef(0); // Stretch amount on takeoff

  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const isInvincible = useRef(false);
  const lastDamageTime = useRef(0);

  // Materials
  const materials = useMemo(() => {
    const isFire = isImmortalityActive;
    const skin = SKINS.find(s => s.id === skinId) || SKINS[0];
    return {
      jersey: new THREE.MeshStandardMaterial({
        color: isFire ? '#ff7700' : skin.jersey, // Team color or Flaming Orange
        roughness: 0.5,
      }),
      jerseyTrim: new THREE.MeshBasicMaterial({
        color: isFire ? '#ffff00' : skin.accent,
      }),
      skin: new THREE.MeshStandardMaterial({
        color: '#c68642', // Warm athlete skin tone
        roughness: 0.8,
      }),
      hair: new THREE.MeshStandardMaterial({
        color: '#1e293b',
        roughness: 0.9,
      }),
      headband: new THREE.MeshStandardMaterial({
        color: isFire ? '#ffff00' : '#ef4444',
      }),
      shorts: new THREE.MeshStandardMaterial({
        color: isFire ? '#ea580c' : skin.shorts,
        roughness: 0.6,
      }),
      sneaker: new THREE.MeshStandardMaterial({
        color: isFire ? '#ffdd00' : '#ffffff',
        roughness: 0.3,
      }),
      sneakerAccent: new THREE.MeshStandardMaterial({
        color: isFire ? '#ff4400' : skin.accent,
        roughness: 0.4,
      }),
      sneakerSole: new THREE.MeshStandardMaterial({
        color: '#0f172a',
        roughness: 0.7,
      }),
      basketball: new THREE.MeshStandardMaterial({
        color: isFire ? '#ffaa00' : '#ea580c',
        emissive: isFire ? '#ff4400' : '#000000',
        emissiveIntensity: isFire ? 1.5 : 0,
        roughness: 0.45,
      }),
      ballSeams: new THREE.MeshBasicMaterial({
        color: isFire ? '#ffffff' : '#0f172a',
        wireframe: true,
      }),
      fireAura: new THREE.MeshBasicMaterial({
        color: '#ffaa00',
        wireframe: true,
        transparent: true,
        opacity: 0.4,
      }),
      shadow: new THREE.MeshBasicMaterial({
        color: '#0f172a',
        opacity: 0.42,
        transparent: true,
        map: SOFT_SHADOW_TEX,
        depthWrite: false,
      }),
    };
  }, [isImmortalityActive, skinId]);

  // Reset State on Game Start
  useEffect(() => {
    if (status === GameStatus.PLAYING) {
      isJumping.current = false;
      jumpsPerformed.current = 0;
      velocityY.current = 0;
      spinRotation.current = 0;
      if (groupRef.current) groupRef.current.position.y = 0;
      if (bodyRef.current) bodyRef.current.rotation.x = 0;
    }
  }, [status]);

  // Clamp lane if laneCount changes
  useEffect(() => {
    const maxLane = Math.floor(laneCount / 2);
    if (Math.abs(lane) > maxLane) {
      setLane(l => Math.max(Math.min(l, maxLane), -maxLane));
    }
  }, [laneCount, lane]);

  // Listen for successful dunk collision to trigger rim snap follow-through
  useEffect(() => {
    const handleDunkSuccess = () => {
      dunkFollowThrough.current = 0.55;
    };
    window.addEventListener('dunk-success', handleDunkSuccess);
    return () => window.removeEventListener('dunk-success', handleDunkSuccess);
  }, []);

  // Lane Crossover Sound & Visual Event
  useEffect(() => {
    if (status === GameStatus.PLAYING && prevLane.current !== lane) {
      audio.playCrossover();
      window.dispatchEvent(new CustomEvent('crossover-turn', {
        detail: { lane, direction: lane > prevLane.current ? 1 : -1 }
      }));
      prevLane.current = lane;
    }
  }, [lane, status]);

  // Jump Controller
  const triggerJump = () => {
    const maxJumps = hasDoubleJump ? 2 : 1;
    jumpStretch.current = 1;

    if (!isJumping.current) {
      // First Jump: Soaring Layup / Dunk elevation
      audio.playJump(false);
      isJumping.current = true;
      jumpsPerformed.current = 1;
      velocityY.current = JUMP_FORCE;
    } else if (jumpsPerformed.current < maxJumps) {
      // Double Jump: 360 Windmill Jam Flip in mid-air
      audio.playJump(true);
      jumpsPerformed.current += 1;
      velocityY.current = JUMP_FORCE;
      spinRotation.current = 0;
    }
  };

  // Keyboard controls
  useEffect(() => {
    const isJumpKey = (key: string) => key === 'ArrowUp' || key === 'w' || key === ' ';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (status !== GameStatus.PLAYING) return;
      // RUN-IN lock-in: ball is still centralized / hands off until the intro camera settles
      if (isIntro) return;
      const maxLane = Math.floor(laneCount / 2);

      if (e.key === 'ArrowLeft' || e.key === 'a') setLane(l => Math.max(l - 1, -maxLane));
      else if (e.key === 'ArrowRight' || e.key === 'd') setLane(l => Math.min(l + 1, maxLane));
      else if (isJumpKey(e.key)) {
        bufferJumpAt.current = performance.now();
        jumpHeld.current = true;
        triggerJump();
        if (e.key === ' ') e.preventDefault(); // Prevent page scroll
      } else if (e.key === 'Enter') {
        activateImmortality();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (isJumpKey(e.key)) {
        jumpHeld.current = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [status, laneCount, hasDoubleJump, activateImmortality, isIntro]);

  // Cancel hold state if the game leaves PLAYING
  useEffect(() => {
    if (status !== GameStatus.PLAYING) jumpHeld.current = false;
  }, [status]);

  // Touch controls
  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (status !== GameStatus.PLAYING) return;
      if (isIntro) return;
      const deltaX = e.changedTouches[0].clientX - touchStartX.current;
      const deltaY = e.changedTouches[0].clientY - touchStartY.current;
      const maxLane = Math.floor(laneCount / 2);

      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 30) {
        if (deltaX > 0) setLane(l => Math.min(l + 1, maxLane));
        else setLane(l => Math.max(l - 1, -maxLane));
      } else if (Math.abs(deltaY) > Math.abs(deltaX) && deltaY < -30) {
        bufferJumpAt.current = performance.now();
        jumpHeld.current = true;
        triggerJump();
        window.setTimeout(() => { jumpHeld.current = false; }, 180);
      } else if (Math.abs(deltaX) < 12 && Math.abs(deltaY) < 12) {
        activateImmortality();
      }
    };

    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchend', handleTouchEnd);
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [status, laneCount, hasDoubleJump, activateImmortality, isIntro]);

  // Animation Loop
  useFrame((state, delta) => {
    if (!groupRef.current) return;
    if (status !== GameStatus.PLAYING && status !== GameStatus.SHOP) return;

    const timeScale = useStore.getState().timeScale;
    const isDunkSlowMo = useStore.getState().isDunkSlowMo;
    const effectiveDelta = delta * timeScale;

    // 1. Horizontal Lane Smooth Interpolation
    targetX.current = lane * LANE_WIDTH;
    groupRef.current.position.x = THREE.MathUtils.lerp(
      groupRef.current.position.x,
      targetX.current,
      effectiveDelta * 16
    );

    // 2. Physics (Jump & Gravity)
    if (isJumping.current) {
      // Variable jump height: reduced gravity while holding, until apex
      const gravity = (jumpHeld.current && velocityY.current > 0) ? GRAVITY * 0.5 : GRAVITY;
      groupRef.current.position.y += velocityY.current * effectiveDelta;
      velocityY.current -= gravity * effectiveDelta;

      // Floor Landing
      if (groupRef.current.position.y <= 0) {
        const impact = Math.min(1, Math.abs(velocityY.current) / JUMP_FORCE);
        const wasAirborne = groupRef.current.position.y > 0.001;
        groupRef.current.position.y = 0;
        isJumping.current = false;
        jumpsPerformed.current = 0;
        velocityY.current = 0;
        if (bodyRef.current) bodyRef.current.rotation.x = 0;

        // Landing squash based on impact force
        if (wasAirborne && impact > 0.05) {
          impactSquash.current = Math.max(impactSquash.current, impact * 0.85);
        }

        // Landing juice: camera dip + dust on meaningful impacts
        if (wasAirborne && impact > 0.2) {
          const p = groupRef.current.position;
          window.dispatchEvent(new CustomEvent('camera-dip', {
            detail: { intensity: impact * 0.6 }
          }));
          window.dispatchEvent(new CustomEvent('player-landed', {
            detail: { x: p.x, z: p.z, intensity: impact }
          }));
        }

        // Input buffering: auto-trigger jump if pressed shortly before landing
        if (performance.now() - bufferJumpAt.current < 160) {
          bufferJumpAt.current = 0;
          audio.playJump(false);
          isJumping.current = true;
          jumpsPerformed.current = 1;
          velocityY.current = JUMP_FORCE;
        }
      }

      // 360 Double Jump Windmill Flip
      if (jumpsPerformed.current === 2 && bodyRef.current) {
        spinRotation.current -= effectiveDelta * 16;
        if (spinRotation.current < -Math.PI * 2) spinRotation.current = -Math.PI * 2;
        bodyRef.current.rotation.x = spinRotation.current;
      }
    }

    // Athletic Lean when switching lanes
    const xDiff = targetX.current - groupRef.current.position.x;
    groupRef.current.rotation.z = -xDiff * 0.22;
    groupRef.current.rotation.x = isJumping.current ? 0.08 : 0.04;

    // 3. Running & Dribbling Animation
    const time = state.clock.elapsedTime * 24;

    if (!isJumping.current) {
      // Athlete Running Cycle
      if (leftArmRef.current) leftArmRef.current.rotation.x = Math.sin(time) * 0.75;
      // Right arm drives down in sync with dribble bounce
      if (rightArmRef.current) rightArmRef.current.rotation.x = -0.2 + Math.abs(Math.sin(time * 0.8)) * 0.55;

      if (leftLegRef.current) leftLegRef.current.rotation.x = Math.sin(time + Math.PI) * 1.05;
      if (rightLegRef.current) rightLegRef.current.rotation.x = Math.sin(time) * 1.05;

      if (bodyRef.current) bodyRef.current.position.y = 1.1 + Math.abs(Math.sin(time)) * 0.08;

      // Basketball Dribbling Physics: Bounces between hand and hardwood court
      if (ballRef.current) {
        const rawSin = Math.sin(time * 0.8);
        const dribbleProgress = Math.abs(rawSin);
        ballRef.current.position.set(0.38, 0.25 + (1 - dribbleProgress) * 0.65, 0.2);
        ballRef.current.rotation.x += effectiveDelta * 12;

        // Detect hardwood court floor impact
        const now = performance.now();
        if (dribbleProgress < 0.14 && prevDribblePhase.current >= 0.14 && (now - lastBounceTime.current > 180)) {
          lastBounceTime.current = now;
          incrementDribbleStreak();
          const currentStreak = useStore.getState().dribbleStreak;
          audio.playDribbleBounce(currentStreak);

          // Emit floor ripple event
          window.dispatchEvent(new CustomEvent('dribble-impact', {
            detail: {
              x: groupRef.current.position.x + 0.38,
              y: 0.02,
              z: groupRef.current.position.z + 0.2,
              streak: currentStreak,
              multiplier: useStore.getState().dribbleMultiplier
            }
          }));
        }
        prevDribblePhase.current = dribbleProgress;
      }
    } else {
      // Soaring Slam Dunk / Layup Pose
      const poseSpeed = effectiveDelta * 12;

      // If in slow-mo dunk, hold the rim-hang follow-through
      if (isDunkSlowMo) {
        dunkFollowThrough.current = Math.max(dunkFollowThrough.current, 0.4);
      }

      if (dunkFollowThrough.current > 0) {
        dunkFollowThrough.current -= effectiveDelta;
        const snapSpeed = effectiveDelta * 26;
        // Powerful rim-hang & downward slam snap follow-through!
        if (rightArmRef.current) rightArmRef.current.rotation.x = THREE.MathUtils.lerp(rightArmRef.current.rotation.x, -0.65, snapSpeed);
        if (leftArmRef.current) leftArmRef.current.rotation.x = THREE.MathUtils.lerp(leftArmRef.current.rotation.x, -0.85, snapSpeed);
        if (ballRef.current) {
          ballRef.current.position.set(0.1, -0.3, 0.45);
          ballRef.current.rotation.x += effectiveDelta * 25;
        }
      } else {
        // Arms reach up to hammer down the dunk
        if (rightArmRef.current) rightArmRef.current.rotation.x = THREE.MathUtils.lerp(rightArmRef.current.rotation.x, -2.8, poseSpeed);
        if (leftArmRef.current) leftArmRef.current.rotation.x = THREE.MathUtils.lerp(leftArmRef.current.rotation.x, -2.5, poseSpeed);

        if (leftLegRef.current) leftLegRef.current.rotation.x = THREE.MathUtils.lerp(leftLegRef.current.rotation.x, 0.6, poseSpeed);
        if (rightLegRef.current) rightLegRef.current.rotation.x = THREE.MathUtils.lerp(rightLegRef.current.rotation.x, -0.4, poseSpeed);

        // Ball held high overhead in two hands ready to throw down a monster slam!
        if (ballRef.current) {
          ballRef.current.position.set(0.1, 1.25, -0.05);
          ballRef.current.rotation.x += effectiveDelta * 15;
        }
      }

      if (bodyRef.current && jumpsPerformed.current !== 2) bodyRef.current.position.y = 1.1;
    }

    // 3.5 Squash & Stretch for athletic weight (decay over time, ease back to neutral)
    impactSquash.current = Math.max(0, impactSquash.current - delta * 5.5);
    jumpStretch.current = Math.max(0, jumpStretch.current - delta * 4.5);
    if (bodyRef.current) {
      const flex = 1 + jumpStretch.current * 0.32 - impactSquash.current * 0.42;
      const targetY = Math.max(0.55, flex);
      const targetXZ = Math.max(0.7, 1 - (targetY - 1) * 0.7);
      bodyRef.current.scale.x = THREE.MathUtils.lerp(bodyRef.current.scale.x, targetXZ, effectiveDelta * 12);
      bodyRef.current.scale.z = THREE.MathUtils.lerp(bodyRef.current.scale.z, targetXZ, effectiveDelta * 12);
      bodyRef.current.scale.y = THREE.MathUtils.lerp(bodyRef.current.scale.y, targetY, effectiveDelta * 12);
    }

    // 4. Dynamic Court Shadow
    if (shadowRef.current) {
      const height = groupRef.current.position.y;
      const scale = Math.max(0.2, 1 - (height / 2.6) * 0.5);
      const stretch = isJumping.current ? 1 : 1 + Math.abs(Math.sin(time)) * 0.25;

      shadowRef.current.scale.set(scale, scale, scale * stretch);
      const shadowMat = shadowRef.current.material as THREE.MeshBasicMaterial;
      if (shadowMat && !Array.isArray(shadowMat)) {
        shadowMat.opacity = Math.max(0.1, 0.35 - (height / 2.6) * 0.22);
      }
    }

    // Invincibility Flicker
    if (isInvincible.current) {
      if (Date.now() - lastDamageTime.current > 1500) {
        isInvincible.current = false;
        groupRef.current.visible = true;
      } else {
        groupRef.current.visible = Math.floor(Date.now() / 50) % 2 === 0;
      }
    } else {
      groupRef.current.visible = true;
    }
  });

  // Damage Event Listener
  useEffect(() => {
    const checkHit = () => {
      if (isInvincible.current || isImmortalityActive) return;
      audio.playDamage();
      takeDamage();
      isInvincible.current = true;
      lastDamageTime.current = Date.now();
    };
    window.addEventListener('player-hit', checkHit);
    return () => window.removeEventListener('player-hit', checkHit);
  }, [takeDamage, isImmortalityActive]);

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      <group ref={bodyRef} position={[0, 1.1, 0]}>
        {/* Athletic Head */}
        <group ref={headRef} position={[0, 0.62, 0]}>
          <mesh castShadow geometry={HEAD_GEO} material={materials.skin} />
          {/* Hair */}
          <mesh position={[0, 0.12, 0]} geometry={HAIR_GEO} material={materials.hair} />
          {/* Athletic Headband */}
          <mesh position={[0, 0.06, 0]} geometry={HEADBAND_GEO} material={materials.headband} />
        </group>

        {/* Basketball Jersey (Torso) */}
        <mesh castShadow position={[0, 0.18, 0]} geometry={JERSEY_TORSO_GEO} material={materials.jersey} />
        {/* Collar & Armhole Trim */}
        <mesh position={[0, 0.49, 0]} geometry={new THREE.CylinderGeometry(0.265, 0.265, 0.04, 8)} material={materials.jerseyTrim} />
        {/* Jersey Number #23 on Back */}
        <mesh position={[0, 0.22, -0.21]} rotation={[0, Math.PI, 0]} geometry={JERSEY_NUMBER_GEO}>
          <meshBasicMaterial color="#ffffff" />
        </mesh>
        {/* Jersey Number #23 on Front */}
        <mesh position={[0, 0.22, 0.21]} geometry={JERSEY_NUMBER_GEO}>
          <meshBasicMaterial color="#ffffff" />
        </mesh>

        {/* Basketball Shorts (Hips & Upper legs) */}
        <mesh position={[0, -0.2, 0]} geometry={SHORTS_GEO} material={materials.shorts} />

        {/* Right Arm (Dribbling Arm) */}
        <group position={[0.34, 0.38, 0]}>
          <group ref={rightArmRef}>
            <mesh position={[0, -0.22, 0]} castShadow geometry={ARM_GEO} material={materials.skin} />
            {/* Wristband */}
            <mesh position={[0, -0.42, 0]} geometry={WRISTBAND_GEO} material={materials.headband} />
          </group>
        </group>

        {/* Left Arm (Guarding Arm with Compression Sleeve) */}
        <group position={[-0.34, 0.38, 0]}>
          <group ref={leftArmRef}>
            <mesh position={[0, -0.22, 0]} castShadow geometry={ARM_GEO} material={materials.skin} />
            {/* Compression Shooter Sleeve */}
            <mesh position={[0, -0.16, 0]} geometry={SLEEVE_GEO} material={materials.shorts} />
            {/* Wristband */}
            <mesh position={[0, -0.42, 0]} geometry={WRISTBAND_GEO} material={materials.headband} />
          </group>
        </group>

        {/* Right Leg & Sneaker */}
        <group position={[0.13, -0.32, 0]}>
          <group ref={rightLegRef}>
            <mesh position={[0, -0.25, 0]} castShadow geometry={LEG_GEO} material={materials.skin} />
            {/* High-Top Basketball Sneaker */}
            <group position={[0, -0.55, 0.05]}>
              <mesh castShadow geometry={SNEAKER_BASE_GEO} material={materials.sneaker} />
              <mesh position={[0, 0.04, -0.02]} geometry={new THREE.BoxGeometry(0.18, 0.08, 0.16)} material={materials.sneakerAccent} />
              <mesh position={[0, -0.07, 0]} geometry={SNEAKER_SOLE_GEO} material={materials.sneakerSole} />
            </group>
          </group>
        </group>

        {/* Left Leg & Sneaker */}
        <group position={[-0.13, -0.32, 0]}>
          <group ref={leftLegRef}>
            <mesh position={[0, -0.25, 0]} castShadow geometry={LEG_GEO} material={materials.skin} />
            {/* High-Top Basketball Sneaker */}
            <group position={[0, -0.55, 0.05]}>
              <mesh castShadow geometry={SNEAKER_BASE_GEO} material={materials.sneaker} />
              <mesh position={[0, 0.04, -0.02]} geometry={new THREE.BoxGeometry(0.18, 0.08, 0.16)} material={materials.sneakerAccent} />
              <mesh position={[0, -0.07, 0]} geometry={SNEAKER_SOLE_GEO} material={materials.sneakerSole} />
            </group>
          </group>
        </group>

        {/* Active Dribbled / Slam Dunk Basketball */}
        <group ref={ballRef} position={[0.38, 0.25, 0.2]}>
          <mesh castShadow geometry={BASKETBALL_GEO} material={materials.basketball} />
          {/* Black Rib Lines on Ball */}
          <mesh geometry={new THREE.SphereGeometry(0.245, 12, 12)} material={materials.ballSeams} />

          {/* Dribble Streak Combo Energy Glow */}
          {dribbleMultiplier >= 2 && (
            <group>
              <mesh geometry={new THREE.SphereGeometry(0.29 + (dribbleMultiplier - 2) * 0.03, 16, 16)}>
                <meshBasicMaterial
                  color={
                    dribbleMultiplier >= 5 ? '#ffd700' :
                    dribbleMultiplier === 4 ? '#ef4444' :
                    dribbleMultiplier === 3 ? '#ea580c' : '#f59e0b'
                  }
                  wireframe
                  transparent
                  opacity={Math.min(0.85, 0.35 + dribbleMultiplier * 0.1)}
                />
              </mesh>
              <pointLight
                color={
                  dribbleMultiplier >= 5 ? '#fbbf24' :
                  dribbleMultiplier === 4 ? '#f87171' :
                  dribbleMultiplier === 3 ? '#fb923c' : '#fcd34d'
                }
                intensity={0.6 + dribbleMultiplier * 0.35}
                distance={2.8 + dribbleMultiplier * 0.4}
              />
            </group>
          )}
        </group>

        {/* "HE'S ON FIRE!" Energetic Flame Aura */}
        {isImmortalityActive && (
          <group position={[0, 0.2, 0]}>
            <mesh geometry={new THREE.SphereGeometry(0.85, 16, 16)} material={materials.fireAura} />
            <pointLight color="#ff8800" intensity={2.5} distance={6} />
          </group>
        )}
      </group>

      {/* Dynamic Court Floor Shadow */}
      <mesh ref={shadowRef} position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} geometry={SHADOW_GEO} material={materials.shadow} />
    </group>
  );
};
