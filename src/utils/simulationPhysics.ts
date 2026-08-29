import * as THREE from 'three';
import { computeSubmerged, type BuoyancyPart } from './buoyancy';

/**
 * The Simulate tab's per-frame sink/float/pitch motion model, as plain
 * functions independent of React/Three's renderer — see
 * physics.calibration.test.ts for the reference data these are calibrated
 * against and for regression coverage.
 */

// --- Calibration ---
// Real measured sink rates for small, dense, compact objects (jig heads —
// treated as calibration anchors for a solid, low-drag body) in still
// fresh water:
//   0.89 g -> ~27 cm/s (270 mm/s)
//   1.77 g -> ~61 cm/s (610 mm/s)
//   3.5 g  -> ~84 cm/s (840 mm/s)
// This is not a straight line — real drag grows with speed, so terminal
// velocity scales sub-linearly with net weight. A least-squares power-law
// fit (v = COEF * netWeightG^EXPONENT) through those three points gives
// EXPONENT ≈ 0.83, COEF ≈ 322.5 (see physics.calibration.test.ts's header
// for the derivation) — an empirical fit, not a first-principles drag
// model, per the calibration brief's explicit allowance for one.
const SINK_SPEED_COEF_MM_S = 322.5;
const SINK_SPEED_EXPONENT = 0.83;
// The reference data only covers tiny (<4 g) net imbalances, where a jig
// already reaches 840 mm/s — so real sink rates clearly aren't capped at a
// few hundred mm/s the way casual tackle-review language ("fast sinking")
// might suggest. But extrapolating this same power law unmodified to a
// typical DIY lure's net imbalance (tens of grams) still runs away to
// implausible multi-metre-per-second speeds (uncapped: ~3.9 m/s at 20 g,
// ~8.3 m/s at 50 g) — no lure sinks that fast in still water. This ceiling
// sits comfortably above the highest calibration anchor (840 mm/s) so it
// never touches the calibrated range, and only bounds the extrapolation
// for heavier imbalances the reference data doesn't cover.
const MAX_SINK_SPEED_MM_S = 1200;
// How quickly velocity relaxes toward the terminal-velocity target above
// (1/s) — a separate "responsiveness" knob from the terminal speed itself,
// so a heavy imbalance still reaches full speed briskly rather than crawling
// up to it.
const VELOCITY_RESPONSE_RATE = 3;

const TORQUE_GAIN = 4; // rad/s² of angular accel per mm of CoG/CoB horizontal offset
const ANGULAR_DRAG = 3.5; // 1/s, damps angular velocity
const MAX_ANGULAR_SPEED_RADS = 6; // safety clamp
// Keeps cos(pitch) well away from 0, since computeSubmerged treats
// near-90° pitch as un-computable and reports zero submerged volume there
// (see buoyancy.ts) — exported so callers that can hand this model a
// starting pitch of their own (e.g. Fase 4's reel-in retrieve, which
// deliberately drives pitch toward -90°/nose-up as it nears the surface)
// can clamp to the same range before handing control back, instead of
// leaving the lure stuck exactly at the singularity with no torque to
// recover from it.
export const MAX_PITCH_RAD = THREE.MathUtils.degToRad(80);
// World Y the body can't sink below (tank bottom) — exported so the Simulate
// view's camera framing (SimulateView.tsx) can fit the actual resting floor
// into view instead of guessing at a separate constant.
export const TANK_FLOOR_Y = 2;
// Below this CoG/CoB offset, treat it as approximation noise (the ellipse
// cross-section model vs. the true mesh centroid) rather than a real
// imbalance — otherwise a perfectly symmetric lure can pick up an
// imperceptibly slow perpetual spin that never quite settles.
const TORQUE_DEADZONE_MM = 0.15;

/**
 * Terminal vertical velocity (world mm/s, positive = rising/floating,
 * negative = sinking) for a given net buoyancy imbalance in grams
 * (displaced water weight minus total lure weight — positive means the lure
 * is lighter than the water it displaces, i.e. it floats).
 *
 * Deliberately shape-agnostic: the reference data is for compact, low-drag
 * bodies, and shape/reference-area effects on drag aren't modeled — see the
 * calibration header above.
 */
export function terminalSinkVelocityMmPerSec(netBuoyancyG: number): number {
  if (netBuoyancyG === 0) return 0;
  const sign = Math.sign(netBuoyancyG);
  const magnitude = SINK_SPEED_COEF_MM_S * Math.abs(netBuoyancyG) ** SINK_SPEED_EXPONENT;
  return sign * Math.min(magnitude, MAX_SINK_SPEED_MM_S);
}

export interface SimBodyState {
  positionY: number;
  velocityY: number;
  pitch: number;
  angularVelocity: number;
}

export interface SimPhysicsInputs {
  bodyParts: BuoyancyPart[];
  centerlineY: number;
  waterSurfaceY: number;
  totalWeightG: number;
  // Mesh-local frame (belly at y=0, main body centered at x=0) — matches
  // BuoyancyPart's groupX and computeSubmerged's centroidX/centroidY.
  cogX: number;
  cogY: number;
  waterDensityGCm3: number;
}

/**
 * Advances the sink/float/pitch simulation by one step. Pure function: no
 * React, no Three.js renderer/WebGL — computeSubmerged (buoyancy.ts) and
 * THREE.MathUtils/Vector math run fine in plain Node, so this is directly
 * unit-testable (see physics.calibration.test.ts).
 */
export function simulateFallStep(state: SimBodyState, inputs: SimPhysicsInputs, dt: number): SimBodyState {
  if (dt <= 0) return state;

  const {
    volumeMm3: submergedVolumeMm3,
    centroidX: cobX,
    centroidY: cobY,
  } = computeSubmerged(inputs.bodyParts, inputs.centerlineY, state.positionY, state.pitch, inputs.waterSurfaceY);

  const displacedWeightG = (submergedVolumeMm3 / 1000) * inputs.waterDensityGCm3;
  const netBuoyancyG = displacedWeightG - inputs.totalWeightG; // positive = floats
  const targetVelocityY = terminalSinkVelocityMmPerSec(netBuoyancyG);

  const relax = 1 - Math.exp(-VELOCITY_RESPONSE_RATE * dt);
  let velocityY = state.velocityY + (targetVelocityY - state.velocityY) * relax;
  let positionY = state.positionY + velocityY * dt;
  if (positionY < TANK_FLOOR_Y) {
    positionY = TANK_FLOOR_Y;
    if (velocityY < 0) velocityY = 0;
  }

  let angularVelocity = state.angularVelocity;
  let pitch = state.pitch;

  // Only torque the body once there's some submerged volume to have a
  // buoyancy center at all — fully out of the water it just falls straight,
  // which is fine (no fluid to generate righting torque).
  if (submergedVolumeMm3 > 1e-6) {
    // Torque needs the *world-frame* horizontal offset between CoG and CoB,
    // not the body-local one directly — once fully submerged, CoB is a
    // fixed point in body-local space (the whole hull's own centroid,
    // invariant to rotation), so a body-local-only offset would settle at
    // whatever constant residual TORQUE_GAIN*offset balances drag at, i.e.
    // a constant spin that never stops. Rotating both points by the current
    // pitch before differencing is what makes the offset actually reach
    // zero once CoB sits directly above/below CoG, the real equilibrium.
    const dCobX = cobX - inputs.cogX;
    const dCobY = cobY - inputs.cogY;
    const cosP = Math.cos(pitch);
    const sinP = Math.sin(pitch);
    const horizontalOffset = dCobX * cosP - dCobY * sinP;
    const drivingOffset = Math.abs(horizontalOffset) > TORQUE_DEADZONE_MM ? horizontalOffset : 0;
    const angAccel = drivingOffset * TORQUE_GAIN - angularVelocity * ANGULAR_DRAG;
    angularVelocity = THREE.MathUtils.clamp(angularVelocity + angAccel * dt, -MAX_ANGULAR_SPEED_RADS, MAX_ANGULAR_SPEED_RADS);
    const nextPitch = pitch + angularVelocity * dt;
    pitch = THREE.MathUtils.clamp(nextPitch, -MAX_PITCH_RAD, MAX_PITCH_RAD);
    if (pitch !== nextPitch) angularVelocity = 0; // hit the safety clamp — don't stay pinned spinning
  } else {
    angularVelocity *= Math.max(0, 1 - ANGULAR_DRAG * dt);
  }

  // Safety net: if an extreme lure shape ever produces a non-finite value
  // despite the guards above, drop it back to a sane resting state instead
  // of leaving the body invisibly stuck at NaN/Infinity.
  if (!Number.isFinite(positionY) || !Number.isFinite(pitch) || !Number.isFinite(velocityY) || !Number.isFinite(angularVelocity)) {
    return { positionY: inputs.waterSurfaceY, velocityY: 0, pitch: 0, angularVelocity: 0 };
  }

  return { positionY, velocityY, pitch, angularVelocity };
}
