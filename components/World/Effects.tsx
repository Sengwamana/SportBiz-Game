/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useThree } from '@react-three/fiber';
import { EffectComposer, Bloom, Vignette, ChromaticAberration, Noise, DepthOfField, SMAA } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { useStore } from '../../store';

/**
 * Cinematic arena post-processing stack.
 * Crisp neon bloom for collectibles, subtle chromatic aberration for a broadcast lens
 * feel, fine film grain to break up banding, and a vignette to keep focus on the action.
 * Depth-of-field kicks in during the slam-dunk slow-mo for a dramatic cinematic portrait.
 * The stack is skipped on software (SwiftShader) WebGL renderers, where Chrome's
 * compositor presents the effect-composer output as black in-game; real GPUs get
 * the full broadcast-grade stack.
 */
export const Effects: React.FC = () => {
  const isDunkSlowMo = useStore(state => state.isDunkSlowMo);
  const gl = useThree(state => state.gl);

  const softwareRenderer = React.useMemo(() => {
    try {
      const ctx = gl.domElement.getContext('webgl2') || gl.domElement.getContext('webgl');
      if (!ctx) return false;
      const dbg = ctx.getExtension('WEBGL_debug_renderer_info');
      const renderer = dbg ? ctx.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : '';
      return /SwiftShader|Software|llvmpipe|Mesa OffScreen/i.test(String(renderer));
    } catch {
      return false;
    }
  }, [gl]);

  if (softwareRenderer) {
    return null;
  }

  return (
    <EffectComposer disableNormalPass multisampling={0}>
      {/* Neon bloom for stadium lights & glowing collectibles */}
      <Bloom
        luminanceThreshold={0.88}
        mipmapBlur
        intensity={0.55}
        radius={0.45}
        levels={6}
      />
      {/* Shallow depth-of-field during the dunk cinematic */}
      {isDunkSlowMo && (
        <DepthOfField
          focusDistance={0.02}
          focalLength={0.05}
          bokehScale={9}
          height={480}
        />
      )}
      {/* Subtle broadcast-lens chromatic aberration */}
      <ChromaticAberration
        blendFunction={BlendFunction.NORMAL}
        offset={[0.0009, 0.0006]}
        radialModulation
        modulationOffset={0.35}
      />
      {/* Fine film grain for a rendered-in feel */}
      <Noise premultiply blendFunction={BlendFunction.SCREEN} opacity={0.7} />
      {/* Focus vignette */}
      <Vignette eskil={false} offset={0.18} darkness={0.42} />
      {/* SMAA anti-aliasing for the sharp, broadcast-quality edge cleanup */}
      <SMAA />
    </EffectComposer>
  );
};