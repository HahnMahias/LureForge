import * as THREE from 'three';

/**
 * Trailing-part sway during Simulate's "Reel in" — same plain-function
 * pattern as lipEffects.ts/jointEffects.ts, so the sway strength/rate can be
 * unit-tested without a renderer.
 */
export type SwayKind = 'skirtStrand' | 'hookDangle';

// Second bump: live instrumentation (temporarily added to HookTieMarker's
// useFrame, then removed) confirmed the previous 20deg pass genuinely
// applied a real ~16deg quaternion swing to the hook's Object3D during a
// held Reel in — the rotation itself was never the bug. A hook/dressing is
// a small part relative to the whole rig, and the whole rig is already
// pitching/diving/rolling a lot more dramatically during Reel in, which can
// bury a modest local wobble. Going bigger so it reads clearly even
// alongside that larger motion, rather than tuning blind again.
const SWAY_AMPLITUDE_RAD: Record<SwayKind, number> = {
  skirtStrand: THREE.MathUtils.degToRad(34),
  hookDangle: THREE.MathUtils.degToRad(38),
};

const SWAY_FREQ_PER_MMS: Record<SwayKind, number> = {
  skirtStrand: 0.018,
  hookDangle: 0.018,
};

export function swayAngularVelocityRadPerS(reelSpeedMmS: number, kind: SwayKind): number {
  return reelSpeedMmS * SWAY_FREQ_PER_MMS[kind];
}

/** `phaseOffset` staggers individual strands in one bundle so they wave rather than fan back and forth as one rigid unit. */
export function swayOffsetRad(phaseRad: number, kind: SwayKind, phaseOffset = 0): number {
  return Math.sin(phaseRad + phaseOffset) * SWAY_AMPLITUDE_RAD[kind];
}
