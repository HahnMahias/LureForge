import * as THREE from 'three';

/**
 * One hook's curve control points (eye → shaft → bend → point) in the
 * hook's own local XY plane — local -Y is "away from the mount," i.e. the
 * direction the hook hangs. Fed to THREE.CatmullRomCurve3 +
 * THREE.TubeGeometry exactly like SimulateView.tsx's FishingLine already
 * builds its own curved tube — the only other place in the codebase doing
 * this, so this reuses that approach rather than inventing a new one.
 * Visually plausible (a recognizable J-shaped hook silhouette that scales
 * with the chosen size), not a traced factory hook pattern — see
 * hookSizes.ts's own sourcing notes for why an exact trace isn't possible
 * from the available reference data anyway.
 */
function hookCurvePoints(lengthMm: number, gapMm: number): THREE.Vector3[] {
  const L = lengthMm;
  const G = gapMm;
  return [
    new THREE.Vector3(0, 0, 0), // eye
    new THREE.Vector3(0, -0.65 * L, 0), // straight shaft
    new THREE.Vector3(0.15 * G, -0.92 * L, 0), // bend starts
    new THREE.Vector3(0.55 * G, -1.0 * L, 0), // bottom of the bend (~gap wide)
    new THREE.Vector3(0.62 * G, -0.8 * L, 0), // point curling back up
    new THREE.Vector3(0.45 * G, -0.68 * L, 0), // barb tip, angled back toward the shaft
  ];
}

// Hook wire thickness isn't consistently documented in mm across sources
// (see hookSizes.ts) — a visually plausible thickness that scales with the
// hook's own gap width, for a 3D preview rather than a production drawing.
export function hookShaftRadiusMm(gapMm: number): number {
  return Math.max(gapMm * 0.09, 0.25);
}

/**
 * One tine's tube geometry, spun `rotationDeg` around the shared shaft
 * (local Y) axis — 0° for a single hook, 0°/120°/240° for a treble's three
 * tines sharing one eye, matching how a real treble is welded from three
 * hooks around a common shank.
 */
export function buildHookTineGeometry(
  lengthMm: number,
  gapMm: number,
  rotationDeg: number,
): THREE.TubeGeometry {
  const axis = new THREE.Vector3(0, 1, 0);
  const angle = THREE.MathUtils.degToRad(rotationDeg);
  const points = hookCurvePoints(lengthMm, gapMm).map((p) => p.clone().applyAxisAngle(axis, angle));
  const curve = new THREE.CatmullRomCurve3(points);
  return new THREE.TubeGeometry(curve, 24, hookShaftRadiusMm(gapMm), 8, false);
}
