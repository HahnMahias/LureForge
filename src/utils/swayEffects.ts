import * as THREE from 'three';

/**
 * Trailing-part sway during Simulate's "Reel in" — same plain-function
 * pattern as lipEffects.ts/jointEffects.ts, so the sway strength/rate can be
 * unit-tested without a renderer.
 */
export type SwayKind = 'skirtStrand' | 'hookDangle';

// Amplitudes bumped up from an initial 16deg/9deg pass, which read as
// essentially motionless at normal viewing distance — a hook/skirt is a
// small part of the whole scene, so a subtle rotation there translates to
// only a couple of screen pixels of visible movement. These are large
// enough to be unmistakable even zoomed out.
const SWAY_AMPLITUDE_RAD: Record<SwayKind, number> = {
  skirtStrand: THREE.MathUtils.degToRad(34),
  hookDangle: THREE.MathUtils.degToRad(20),
};

// Slower than the initial pass too — a fast wag blurs into a jitter at
// normal frame capture; a slower sweep reads clearly as a wave/dangle.
const SWAY_FREQ_PER_MMS: Record<SwayKind, number> = {
  skirtStrand: 0.018,
  hookDangle: 0.012,
};

export function swayAngularVelocityRadPerS(reelSpeedMmS: number, kind: SwayKind): number {
  return reelSpeedMmS * SWAY_FREQ_PER_MMS[kind];
}

/** `phaseOffset` staggers individual strands in one bundle so they wave rather than fan back and forth as one rigid unit. */
export function swayOffsetRad(phaseRad: number, kind: SwayKind, phaseOffset = 0): number {
  return Math.sin(phaseRad + phaseOffset) * SWAY_AMPLITUDE_RAD[kind];
}
