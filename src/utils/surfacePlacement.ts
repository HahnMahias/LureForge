import * as THREE from 'three';
import { evaluateCurveAtX } from './curveMath';
import type { LureCurves } from './generateLureMesh';

export interface SurfacePlacement {
  point: THREE.Vector3; // body-local mm space (same frame as feature.position)
  normal: THREE.Vector3; // outward unit normal, body-local direction
}

/**
 * Analytically finds where a feature's position lands on the body's outer
 * surface, without raycasting against the generated mesh. Reuses the same
 * per-length-position radius evaluation as the loft in generateLureMesh.ts:
 * at the given x, the cross-section is an ellipse (with independently
 * scaled quadrants when asymmetric), and position.y/position.z only supply
 * the *direction* (angle) from the centerline — the actual point is snapped
 * onto that ellipse, so a decal always sits on the real surface regardless
 * of how precisely y/z were set.
 */
export function computeSurfacePlacement(
  curves: LureCurves,
  length: number,
  symmetric: boolean,
  position: { x: number; y: number; z: number },
): SurfacePlacement {
  const x = THREE.MathUtils.clamp(position.x, 0, length);

  const upR = evaluateCurveAtX(curves.side, x);
  const downR = symmetric ? upR : evaluateCurveAtX(curves.sideMirror, x);
  const rightR = evaluateCurveAtX(curves.top, x);
  const leftR = symmetric ? rightR : evaluateCurveAtX(curves.topMirror, x);

  const angle = Math.atan2(position.y, position.z) || 0; // 0 = +Z (right), +90deg = +Y (up)
  const a = Math.max(Math.cos(angle) >= 0 ? rightR : leftR, 0.05);
  const b = Math.max(Math.sin(angle) >= 0 ? upR : downR, 0.05);

  const z = a * Math.cos(angle);
  const y = b * Math.sin(angle);

  // Outward normal of the ellipse (z/a)^2 + (y/b)^2 = 1 at (z, y).
  const normal = new THREE.Vector3(0, y / (b * b), z / (a * a));
  if (normal.lengthSq() < 1e-9) normal.set(0, 0, 1);
  normal.normalize();

  return { point: new THREE.Vector3(x, y, z), normal };
}
