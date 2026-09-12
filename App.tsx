/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React, { Suspense, useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Environment } from './components/World/Environment';
import { Player } from './components/World/Player';
import { LevelManager } from './components/World/LevelManager';
import { Effects } from './components/World/Effects';
import { HUD } from './components/UI/HUD';
import { AmbientAudioDirector } from './components/System/AmbientAudioDirector';
import { CrowdAudioController } from './components/System/CrowdAudioController';
import { useStore } from './store';

// Dynamic Camera Controller with Slam Dunk Screen Shake & Cinematic Side-Profile View
const CameraController = () => {
  const { camera, size } = useThree();
  const { laneCount, isDunkSlowMo, dunkCamTarget } = useStore();
  const shakeTrauma = useRef(0);
  const currentLookTarget = useRef(new THREE.Vector3(0, 0, -30));
  const desiredPos = useRef(new THREE.Vector3(0, 5.5, 8.0));
  const desiredLookAt = useRef(new THREE.Vector3(0, 0, -30));

  // Listen for screen shake triggered by the collision system (e.g. on dunks)
  useEffect(() => {
    const handleScreenShake = (e: any) => {
      const intensity = e.detail?.intensity ?? 0.85;
      shakeTrauma.current = Math.min(1.0, shakeTrauma.current + intensity);
    };

    window.addEventListener('screen-shake', handleScreenShake);
    return () => window.removeEventListener('screen-shake', handleScreenShake);
  }, []);
  
  useFrame((state, delta) => {
    // Determine if screen is narrow (mobile portrait)
    const aspect = size.width / size.height;
    const isMobile = aspect < 1.2;

    if (isDunkSlowMo && dunkCamTarget) {
      // Cinematic Side-Profile View during Slam Dunk
      const [tx, , tz] = dunkCamTarget;
      
      // Select left or right sideline view based on hoop lane positioning
      const isRightSide = tx <= 0.8;
      const sideOffset = isRightSide ? 4.2 : -4.2;
      
      // Dynamic camera tracking drift during slow-mo replay
      const driftY = Math.sin(state.clock.elapsedTime * 2.0) * 0.08;
      const driftZ = Math.cos(state.clock.elapsedTime * 1.5) * 0.12;

      desiredPos.current.set(
        tx + sideOffset,
        2.45 + driftY, // Level with 2.45m rim height
        tz + 0.35 + driftZ // Centered directly on the rim and player
      );

      desiredLookAt.current.set(tx, 2.35, tz + 0.2);

      // Fast, cinematic sweep to side-profile
      camera.position.lerp(desiredPos.current, delta * 7.0);
      currentLookTarget.current.lerp(desiredLookAt.current, delta * 8.0);
      camera.lookAt(currentLookTarget.current);

      // Cinematic FOV zoom (slightly tighter for dramatic portrait depth)
      if ('fov' in camera) {
        (camera as THREE.PerspectiveCamera).fov = THREE.MathUtils.lerp(
          (camera as THREE.PerspectiveCamera).fov,
          isMobile ? 55 : 46,
          delta * 6.0
        );
        camera.updateProjectionMatrix();
      }
    } else {
      // Standard Third-Person Trailing Gameplay View
      const heightFactor = isMobile ? 2.0 : 0.5;
      const distFactor = isMobile ? 4.5 : 1.0;
      const extraLanes = Math.max(0, laneCount - 3);

      const targetY = 5.5 + (extraLanes * heightFactor);
      const targetZ = 8.0 + (extraLanes * distFactor);

      desiredPos.current.set(0, targetY, targetZ);
      desiredLookAt.current.set(0, 0, -30);

      // Smooth interpolation back to gameplay
      camera.position.lerp(desiredPos.current, delta * 3.2);
      currentLookTarget.current.lerp(desiredLookAt.current, delta * 4.0);
      camera.lookAt(currentLookTarget.current);

      // Restore standard FOV
      if ('fov' in camera) {
        (camera as THREE.PerspectiveCamera).fov = THREE.MathUtils.lerp(
          (camera as THREE.PerspectiveCamera).fov,
          60,
          delta * 4.0
        );
        camera.updateProjectionMatrix();
      }
    }

    // Apply Screen Shake when triggered by dunk collision
    if (shakeTrauma.current > 0.001) {
      // Quadratic shake curve gives a punchy, athletic impact that decays smoothly
      const shake = shakeTrauma.current * shakeTrauma.current;
      const t = state.clock.elapsedTime * 50;

      // Multi-frequency directional displacement
      const shakeX = (Math.sin(t * 1.3) * 0.7 + (Math.random() - 0.5) * 0.4) * shake * 0.55;
      const shakeY = (Math.cos(t * 1.7) * 0.7 + (Math.random() - 0.5) * 0.4) * shake * 0.45;
      const shakeZ = Math.sin(t * 2.1) * shake * 0.25;

      camera.position.x += shakeX;
      camera.position.y += shakeY;
      camera.position.z += shakeZ;

      // Subtle rotational jar on the camera lens
      camera.rotation.z += Math.sin(t * 1.4) * shake * 0.045;
      camera.rotation.x += Math.cos(t * 1.1) * shake * 0.035;

      // Decay trauma smoothly
      shakeTrauma.current = Math.max(0, shakeTrauma.current - delta * 2.6);
    }
  });
  
  return null;
};

function Scene() {
  return (
    <>
        <Environment />
        <group>
            {/* Attach a userData to identify player group for LevelManager collision logic */}
            <group userData={{ isPlayer: true }} name="PlayerGroup">
                 <Player />
            </group>
            <LevelManager />
        </group>
        <Effects />
    </>
  );
}

function App() {
  return (
    <div className="relative w-full h-screen bg-slate-100 overflow-hidden select-none">
      <AmbientAudioDirector />
      <CrowdAudioController />
      <HUD />
      <Canvas
        shadows
        dpr={[1, 1.5]} 
        gl={{ antialias: false, stencil: false, depth: true, powerPreference: "high-performance" }}
        // Initial camera, matches the controller base
        camera={{ position: [0, 5.5, 8], fov: 60 }}
      >
        <CameraController />
        <Suspense fallback={null}>
            <Scene />
        </Suspense>
      </Canvas>
    </div>
  );
}

export default App;
