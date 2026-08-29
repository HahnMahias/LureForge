import * as THREE from 'three';
import { MAX_PITCH_RAD } from './simulationPhysics';

/**
 * Diving-lip dive/wobble effect layered on top of Simulate's existing
 * "Reel in" retrieve motion (SimulateView.tsx's LureRig). Kept as plain
 * functions (no React/Three renderer, no Canvas) so the dive strength can be
 * unit-tested directly — see lipEffects.test.ts.
 *
 * Convention (Fase F of the visual redesign, stated explicitly per the
 * brief so this can't drift again): lipAngleDeg = 0 → no dive effect at
 * all; lipAngleDeg = 90 → the nose dives as close to straight down as the
 * app's own physics safely allows (MAX_PITCH_RAD — see that constant's own
 * comment for why not the literal, singular 90°).
 */

// mm/s of extra DOWNWARD drift per radian of lip angle, applied directly to
// the rig's world-Y position on top of the retrieve's own rising curve. This
// is the part that actually makes a lipped lure trace a lower/dipping path
// than the same lure without one — the pitch bias above only re-tilts the
// nose and, on its own, never touches where the body actually goes, which
// is exactly why an earlier version of this effect looked like it was
// "rising instead of diving": the cosmetic tilt was correct, but nothing
// was pulling the trajectory itself down.
const LIP_DIVE_DROP_MM_PER_RAD_PER_S = 130;

const LIP_WOBBLE_AMPLITUDE_RAD = THREE.MathUtils.degToRad(14);
// Wobble angular frequency (rad/s) per mm/s of current reel speed — faster
// retrieves wag the tail faster, same "hoe sneller je binnenhaalt" logic
// Fase 3's spinning-tail rate uses.
const LIP_WOBBLE_FREQ_PER_MMS = 0.045;

/**
 * Blends the retrieve's own pitch toward the lip's dive target, weighted by
 * the lip's angle — a direct blend rather than an additive bias, since an
 * additive one couldn't guarantee the 90° endpoint reliably reaches
 * "straight down" regardless of whatever pitch the base retrieve happened
 * to compute (e.g. late in a retrieve, when the base pitch is already near
 * its own REEL_MAX_PITCH_RAD cap in the opposite direction). At angle=0
 * this returns basePitchRad completely untouched; at angle=90 it always
 * lands exactly on MAX_PITCH_RAD.
 */
export function applyLipDivePitch(basePitchRad: number, lipAngleDeg: number): number {
  const t = THREE.MathUtils.clamp(lipAngleDeg, 0, 90) / 90;
  return THREE.MathUtils.lerp(basePitchRad, MAX_PITCH_RAD, t);
}

/**
 * How fast (mm/s) the lip actively pulls the rig's world-Y position
 * downward, on top of whatever the plain retrieve curve already does —
 * the part that makes the body actually trace a lower/dipping path, not
 * just wear a different nose angle. Scales with the lip's own angle, same
 * "bigger angle = deeper dive" relationship as lipDivePitchRad.
 */
export function lipDiveDropMmPerS(lipAngleDeg: number): number {
  return THREE.MathUtils.degToRad(lipAngleDeg) * LIP_DIVE_DROP_MM_PER_RAD_PER_S;
}

/** Wobble angular velocity (rad/s) the yaw phase should advance by, given the current effective reel speed (mm/s). */
export function lipWobbleAngularVelocityRadPerS(reelSpeedMmS: number): number {
  return reelSpeedMmS * LIP_WOBBLE_FREQ_PER_MMS;
}

/** Yaw offset (radians) for a given wobble phase (radians, unbounded — callers just keep accumulating it). */
export function lipWobbleYawOffsetRad(phaseRad: number): number {
  return Math.sin(phaseRad) * LIP_WOBBLE_AMPLITUDE_RAD;
}
