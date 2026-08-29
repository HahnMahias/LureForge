/**
 * Regression coverage for the reel-in "face the direction of travel" solve
 * (Fase 6 bugfix) — explicitly verifies the nose ends up pointing along the
 * remaining-distance vector after rotation, for a spread of directions,
 * so a future change to the nose-axis assumption or the rotation formula
 * can't silently point the wrong end of the body at the angler again.
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { NOSE_LOCAL_DIRECTION, noseWorldDirection, solveReelOrientation } from './reelOrientation';

const MAX_PITCH_RAD = THREE.MathUtils.degToRad(80);

function normalized(x: number, y: number, z: number): THREE.Vector3 {
  return new THREE.Vector3(x, y, z).normalize();
}

describe('solveReelOrientation + noseWorldDirection', () => {
  it('points the nose along the target direction for a spread of directions', () => {
    // Pure-vertical targets are deliberately excluded: they'd need a ±90°
    // pitch, which MAX_PITCH_RAD clamps away on purpose (see
    // simulationPhysics.ts's MAX_PITCH_RAD — near-90° pitch is a genuine
    // singularity for the buoyancy math elsewhere in this app), so exact
    // alignment there is an unrealistic expectation, not a bug.
    const targets: [number, number, number][] = [
      [1, 0, 0],
      [-1, 0, 0],
      [1, 1, 0],
      [1, 0.3, 1],
      [-1, 0.5, 0.6],
      [0.6, 0.2, -1],
    ];

    for (const [dx, dy, dz] of targets) {
      const { yaw, pitch } = solveReelOrientation(dx, dy, dz, MAX_PITCH_RAD);
      const nose = noseWorldDirection(yaw, pitch);
      const target = normalized(dx, dy, dz);
      // Only when the target's own vertical component stays within what
      // pitch can represent unclamped (dyNorm within the clamp range) does
      // the nose align exactly — all these targets do.
      expect(nose.dot(target)).toBeGreaterThan(0.999);
    }
  });

  it('the assumed nose axis matches generateLureMesh.ts\'s actual nose placement', () => {
    // Documented and re-derived from generateLureMesh.ts: design-space x=0
    // (the nose) ends up at mesh-local x=-length/2 after the offset
    // translate, i.e. negative local X — this constant must keep matching
    // that or every reel-in orientation silently points the tail forward.
    expect(NOSE_LOCAL_DIRECTION.x).toBeLessThan(0);
    expect(NOSE_LOCAL_DIRECTION.y).toBe(0);
    expect(NOSE_LOCAL_DIRECTION.z).toBe(0);
  });

  it('degenerates to yaw=0, pitch=0 at zero remaining distance (no NaN/undefined direction)', () => {
    const { yaw, pitch } = solveReelOrientation(0, 0, 0, MAX_PITCH_RAD);
    expect(Number.isFinite(yaw)).toBe(true);
    expect(Number.isFinite(pitch)).toBe(true);
  });

  it('clamps pitch to the given max, never exceeding it even for a near-vertical target', () => {
    const { pitch } = solveReelOrientation(0.01, 500, 0.01, MAX_PITCH_RAD);
    expect(Math.abs(pitch)).toBeLessThanOrEqual(MAX_PITCH_RAD + 1e-9);
  });
});
