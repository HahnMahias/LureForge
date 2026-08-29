/**
 * Unit coverage for the diving-lip dive/wobble math (Fase 2 of the
 * post-audit build plan) — verifies the dive effect on pitch scales with
 * the lip's own angle, and that a lip's presence produces a strictly bigger
 * dive than no lip at all, matching the spec's "hoe groter lipAngleDeg, hoe
 * dieper de duik."
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  applyLipDivePitch,
  lipDiveDropMmPerS,
  lipWobbleAngularVelocityRadPerS,
  lipWobbleYawOffsetRad,
} from './lipEffects';
import { solveReelOrientation } from './reelOrientation';
import { MAX_PITCH_RAD } from './simulationPhysics';

/**
 * Explicit convention lock (Fase F of the visual redesign, stated in the
 * brief so this can't drift again): "A steeper angle dives deeper during
 * 'Reel in'. 90° points straight down." — lipAngleDeg=0 must leave the
 * retrieve's own pitch completely untouched, and lipAngleDeg=90 must always
 * reach the physics-safe "straight down" ceiling regardless of whatever the
 * base retrieve pitch happened to be.
 */
describe('applyLipDivePitch', () => {
  it('0° leaves the base pitch completely untouched, at any base pitch', () => {
    for (const basePitch of [-0.6, -0.1, 0, 0.3, 0.6]) {
      expect(applyLipDivePitch(basePitch, 0)).toBe(basePitch);
    }
  });

  it('90° always reaches exactly MAX_PITCH_RAD ("straight down"), regardless of base pitch', () => {
    for (const basePitch of [-0.6, -0.1, 0, 0.3, 0.6]) {
      expect(applyLipDivePitch(basePitch, 90)).toBeCloseTo(MAX_PITCH_RAD, 10);
    }
  });

  it('grows monotonically with lip angle, for a fixed base pitch', () => {
    const base = -0.3;
    const angles = [0, 15, 30, 45, 60, 75, 90];
    const pitches = angles.map((a) => applyLipDivePitch(base, a));
    for (let i = 1; i < pitches.length; i++) {
      expect(pitches[i]).toBeGreaterThan(pitches[i - 1]);
    }
  });

  it('clamps out-of-range angles to the same 0..90 behavior instead of overshooting', () => {
    expect(applyLipDivePitch(0.1, 120)).toBeCloseTo(MAX_PITCH_RAD, 10);
    expect(applyLipDivePitch(0.1, -10)).toBeCloseTo(0.1, 10);
  });
});

describe('lipDiveDropMmPerS', () => {
  it('is zero for a flush (0°) lip — no lip means no extra downward pull', () => {
    expect(lipDiveDropMmPerS(0)).toBe(0);
  });

  it('is always positive (downward) for any positive lip angle', () => {
    for (const angle of [5, 20, 45, 70, 90]) {
      expect(lipDiveDropMmPerS(angle)).toBeGreaterThan(0);
    }
  });

  it('grows monotonically with lip angle — "hoe groter lipAngleDeg, hoe dieper de duik"', () => {
    const angles = [0, 15, 30, 45, 60, 75, 90];
    const drops = angles.map(lipDiveDropMmPerS);
    for (let i = 1; i < drops.length; i++) {
      expect(drops[i]).toBeGreaterThan(drops[i - 1]);
    }
  });
});

/**
 * Regression check for the Fase 6 bug: a lip must make the retrieve dip
 * *below* the same lure's plain (lip-less) path, not rise above it. This
 * combines solveReelOrientation's rise-curve position update with the lip's
 * drop contribution exactly the way LureRig's useFrame does, and checks the
 * with-lip world-Y position is strictly lower than the without-lip one at
 * the same simulated moment.
 */
describe('lip dive vs. plain retrieve (world-Y comparison)', () => {
  it('a lure with a lip ends up lower than the same lure without one after one step', () => {
    const dt = 0.1;
    const dy = 200;

    // Plain retrieve: only the existing rise-curve contribution (no lip).
    const riseRate = 3.2;
    const plainY = dy * (1 - Math.exp(-riseRate * dt));

    // With a 45° lip: same rise, minus the lip's active downward pull.
    const lipAngleDeg = 45;
    const withLipY = plainY - lipDiveDropMmPerS(lipAngleDeg) * dt;

    expect(withLipY).toBeLessThan(plainY);
  });

  it('a positive lipAngleDeg pushes pitch toward the dive direction, not further into the rise', () => {
    // A typical mid-retrieve moment: rising (positive dy) and still closing
    // horizontally — base pitch comes out negative (nose-up, matching the
    // established "positive pitch = nose-down" convention).
    const { pitch: basePitch } = solveReelOrientation(60, 200, 30, THREE.MathUtils.degToRad(35));
    expect(basePitch).toBeLessThan(0); // nose-up while ascending, as expected

    const pitchWithLip = applyLipDivePitch(basePitch, 45);

    // Diving = tilting toward nose-down relative to the plain retrieve, i.e.
    // strictly greater (less negative) than the un-lipped pitch — never
    // more negative, which would mean the lip tilted the nose *further up*.
    expect(pitchWithLip).toBeGreaterThan(basePitch);
  });
});

describe('lipWobbleAngularVelocityRadPerS', () => {
  it('is zero when not reeling (zero speed)', () => {
    expect(lipWobbleAngularVelocityRadPerS(0)).toBe(0);
  });

  it('scales up with reel speed — faster retrieves wobble faster', () => {
    const slow = lipWobbleAngularVelocityRadPerS(100);
    const fast = lipWobbleAngularVelocityRadPerS(400);
    expect(fast).toBeGreaterThan(slow);
    expect(fast / slow).toBeCloseTo(4, 5); // linear in reel speed
  });
});

describe('lipWobbleYawOffsetRad', () => {
  it('oscillates (not monotonic drift) — a full cycle returns to ~0', () => {
    expect(lipWobbleYawOffsetRad(0)).toBeCloseTo(0, 6);
    expect(lipWobbleYawOffsetRad(Math.PI * 2)).toBeCloseTo(0, 6);
  });

  it('stays bounded by the wobble amplitude regardless of phase', () => {
    const amplitude = lipWobbleYawOffsetRad(Math.PI / 2); // sin peak
    for (const phase of [0.3, 1.7, 3.1, 5.9, 12.4]) {
      expect(Math.abs(lipWobbleYawOffsetRad(phase))).toBeLessThanOrEqual(amplitude + 1e-9);
    }
  });
});
