import * as THREE from 'three';

/**
 * Trailing-part sway during Simulate's "Reel in" — same plain-function
 * pattern as lipEffects.ts/jointEffects.ts, so the sway strength/rate can be
 * unit-tested without a renderer.
 */
export type SwayKind = 'skirtStrand' | 'hookDangle';

const SWAY_AMPLITUDE_RAD: Record<SwayKind, number> = {
  skirtStrand: THREE.MathUtils.degToRad(16),
  hookDangle: THREE.MathUtils.degToRad(9),
};

const SWAY_FREQ_PER_MMS: Record<SwayKind, number> = {
  skirtStrand: 0.03,
  hookDangle: 0.02,
};

export function swayAngularVelocityRadPerS(reelSpeedMmS: number, kind: SwayKind): number {
  return reelSpeedMmS * SWAY_FREQ_PER_MMS[kind];
}

/** `phaseOffset` staggers individual strands in one bundle so they wave rather than fan back and forth as one rigid unit. */
export function swayOffsetRad(phaseRad: number, kind: SwayKind, phaseOffset = 0): number {
  return Math.sin(phaseRad + phaseOffset) * SWAY_AMPLITUDE_RAD[kind];
}
