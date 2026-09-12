/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';

export const Effects: React.FC = () => {
  return (
    <EffectComposer disableNormalPass multisampling={0}>
      {/* Crisp Light Mode Bloom for stadium lights & glowing collectibles */}
      <Bloom
        luminanceThreshold={0.92}
        mipmapBlur
        intensity={0.45}
        radius={0.4}
        levels={6}
      />
      {/* Soft daylight arena vignette for focus without darkening */}
      <Vignette eskil={false} offset={0.2} darkness={0.15} />
    </EffectComposer>
  );
};
