import * as THREE from 'three';

/**
 * Mesh volume via the signed tetrahedron sum over every triangle (each
 * triangle plus the origin forms a tetrahedron; signed volumes cancel
 * outside the mesh and add up inside it). This is the standard way to get a
 * real volume from an arbitrary closed triangle mesh, unlike a bounding-box
 * estimate. Winding direction only affects the sign, so the result is
 * absolute-valued.
 */
export function computeMeshVolumeMm3(geometry: THREE.BufferGeometry): number {
  const position = geometry.getAttribute('position');
  if (!position) return 0;
  const index = geometry.getIndex();
  const triCount = index ? index.count / 3 : position.count / 3;

  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();

  let volume = 0;
  for (let i = 0; i < triCount; i++) {
    const ia = index ? index.getX(i * 3) : i * 3;
    const ib = index ? index.getX(i * 3 + 1) : i * 3 + 1;
    const ic = index ? index.getX(i * 3 + 2) : i * 3 + 2;
    a.fromBufferAttribute(position, ia);
    b.fromBufferAttribute(position, ib);
    c.fromBufferAttribute(position, ic);
    volume += a.dot(b.clone().cross(c)) / 6;
  }

  return Math.abs(volume);
}

/**
 * Volume and volumetric centroid together, via the same signed-tetrahedron
 * decomposition (each triangle + the origin forms a tetrahedron with
 * centroid (a+b+c)/4; volume-weighting and summing those gives the mesh's
 * true center of mass for uniform density, not just its bounding-box
 * center). Volume and centroid share the same signed sum so winding
 * direction cancels out of the ratio even though it flips the reported
 * volume's sign.
 */
export function computeMeshVolumeAndCentroid(
  geometry: THREE.BufferGeometry,
): { volumeMm3: number; centroid: THREE.Vector3 } {
  const position = geometry.getAttribute('position');
  if (!position) return { volumeMm3: 0, centroid: new THREE.Vector3() };
  const index = geometry.getIndex();
  const triCount = index ? index.count / 3 : position.count / 3;

  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();

  let signedVolume = 0;
  const weightedCentroid = new THREE.Vector3();

  for (let i = 0; i < triCount; i++) {
    const ia = index ? index.getX(i * 3) : i * 3;
    const ib = index ? index.getX(i * 3 + 1) : i * 3 + 1;
    const ic = index ? index.getX(i * 3 + 2) : i * 3 + 2;
    a.fromBufferAttribute(position, ia);
    b.fromBufferAttribute(position, ib);
    c.fromBufferAttribute(position, ic);

    const tetVolume = a.dot(b.clone().cross(c)) / 6;
    const tetCentroid = a.clone().add(b).add(c).multiplyScalar(0.25); // 4th vertex is the origin
    weightedCentroid.addScaledVector(tetCentroid, tetVolume);
    signedVolume += tetVolume;
  }

  const centroid =
    Math.abs(signedVolume) > 1e-9 ? weightedCentroid.divideScalar(signedVolume) : new THREE.Vector3();

  return { volumeMm3: Math.abs(signedVolume), centroid };
}

export type BallastShape = 'sphere' | 'box' | 'cylinder';

/** Analytic volume for a ballast piece, sized by a single "diameter" control. */
export function computeBallastVolumeMm3(shape: BallastShape, diameterMm: number): number {
  const r = diameterMm / 2;
  switch (shape) {
    case 'sphere':
      return (4 / 3) * Math.PI * r ** 3;
    case 'box':
      return diameterMm ** 3;
    case 'cylinder':
      // Height equal to diameter keeps this a single-slider control.
      return Math.PI * r * r * diameterMm;
  }
}
