import * as THREE from 'three';

/**
 * Segment-joint swing effect layered on top of Simulate's "Reel in" retrieve
 * motion (SimulateView.tsx drives the main rig; LureBody.tsx's own useFrame
 * drives each extra segment's joint pivot). Kept as plain functions, same
 * pattern as lipEffects.ts, so the swing strength/rate can be unit-tested
 * without a renderer.
 */
export type JointType = 'rigid' | 'hinge' | 'ball' | 'flexTube';

const JOINT_SWING_AMPLITUDE_RAD: Record<JointType, number> = {
  rigid: 0,
  hinge: THREE.MathUtils.degToRad(15),
  ball: THREE.MathUtils.degToRad(28),
  flexTube: THREE.MathUtils.degToRad(42),
};

// Same "reel-speed -> angular rate" relationship lipEffects.ts's
// LIP_WOBBLE_FREQ_PER_MMS uses — faster retrieves swing the joint faster.
const JOINT_SWING_FREQ_PER_MMS: Record<JointType, number> = {
  rigid: 0,
  hinge: 0.05,
  ball: 0.035,
  flexTube: 0.022, // trager/losser — blijft na-zwiepen
};

export function jointSwingAngularVelocityRadPerS(reelSpeedMmS: number, joint: JointType): number {
  return reelSpeedMmS * JOINT_SWING_FREQ_PER_MMS[joint];
}

export function jointSwingYawOffsetRad(phaseRad: number, joint: JointType): number {
  return Math.sin(phaseRad) * JOINT_SWING_AMPLITUDE_RAD[joint];
}

// Ball and flex tube also swing slightly up/down (not just side to side), at
// a slightly different frequency/phase so it reads as organic rather than a
// flat 2D wag.
export function jointSwingPitchOffsetRad(phaseRad: number, joint: JointType): number {
  if (joint === 'rigid' || joint === 'hinge') return 0;
  return Math.sin(phaseRad * 1.3 + 0.6) * JOINT_SWING_AMPLITUDE_RAD[joint] * 0.6;
}
