import * as THREE from 'three';

/**
 * The nose's direction in the body's own mesh-local frame. Established by
 * generateLureMesh.ts's own offset translate: design-space x=0 (the nose,
 * per useProfileStore.ts's curve convention) ends up at mesh-local
 * x=-length/2 after `geometry.translate(-offset.x, offset.y, 0)`, i.e. the
 * nose sits on the NEGATIVE local X axis. Every place that needs to know
 * "which way is the nose" (the reel-in retrieve below, and anything built
 * on top of it) imports this single constant instead of re-deriving or
 * re-guessing the sign, so the two can't drift out of sync again.
 */
export const NOSE_LOCAL_DIRECTION = new THREE.Vector3(-1, 0, 0);

/**
 * Transforms a body-local point by a rig's (x, y, z, yaw, pitch) state —
 * the same composition `group.rotation.set(0, yaw, pitch)` with Euler order
 * 'YXZ' produces on the actual rendered rig (verified against three's own
 * Matrix4.makeRotationFromEuler), so anything outside that render tree
 * (FishingLine, this module's own solver/tests) can independently reproduce
 * a point's exact world position without needing a live THREE.Object3D.
 */
export function localToWorld(
  local: THREE.Vector3,
  x: number,
  y: number,
  z: number,
  yaw: number,
  pitch: number,
): THREE.Vector3 {
  const cosP = Math.cos(pitch);
  const sinP = Math.sin(pitch);
  const px = local.x * cosP - local.y * sinP;
  const py = local.x * sinP + local.y * cosP;
  const pz = local.z;

  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);
  const wx = px * cosY + pz * sinY;
  const wz = -px * sinY + pz * cosY;

  return new THREE.Vector3(x + wx, y + py, z + wz);
}

/** World-space direction the nose currently points, given a rig's yaw/pitch. */
export function noseWorldDirection(yaw: number, pitch: number): THREE.Vector3 {
  return localToWorld(NOSE_LOCAL_DIRECTION, 0, 0, 0, yaw, pitch);
}

export interface ReelOrientation {
  yaw: number;
  pitch: number;
}

/**
 * Solves the (yaw, pitch) that makes the nose (NOSE_LOCAL_DIRECTION) point
 * along the given remaining-distance vector (dx, dy, dz) — the reel-in
 * retrieve's "face the direction of travel" logic (SimulateView.tsx's
 * LureRig), extracted as a pure function so it's directly unit-testable
 * (see reelOrientation.test.ts) instead of only exercised implicitly
 * through the full Simulate scene.
 */
export function solveReelOrientation(
  dx: number,
  dy: number,
  dz: number,
  maxPitchRad: number,
): ReelOrientation {
  const totalDist = Math.hypot(dx, dy, dz);
  if (totalDist < 1e-9) return { yaw: 0, pitch: 0 };
  const dyNorm = dy / totalDist;
  const pitch = THREE.MathUtils.clamp(
    -Math.asin(THREE.MathUtils.clamp(dyNorm, -1, 1)),
    -maxPitchRad,
    maxPitchRad,
  );
  const yaw = Math.atan2(dz, -dx);
  return { yaw, pitch };
}
