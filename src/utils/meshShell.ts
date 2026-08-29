import * as THREE from 'three';

function computeSmoothNormals(position: Float32Array, indices: ArrayLike<number>): Float32Array {
  const temp = new THREE.BufferGeometry();
  temp.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  temp.setIndex(Array.from(indices));
  temp.computeVertexNormals();
  return (temp.getAttribute('normal') as THREE.BufferAttribute).array as Float32Array;
}

/**
 * Hollows a closed(ish) mesh into a printable shell: an inner surface offset
 * inward along vertex normals by the wall thickness, reversed so it faces
 * inward, stitched to the outer surface along whatever boundary edges the
 * outer mesh has (e.g. an open tail) so the shell doesn't leak there.
 *
 * This is the vertex-normal-offset approach rather than a CSG boolean
 * subtract — simpler and dependency-free, at the cost of the inner surface
 * being an approximation (can self-intersect on very tight curvature, which
 * a real CSG subtract wouldn't), acceptable for the wall thicknesses this
 * tool deals with.
 */
export function hollowGeometry(
  geometry: THREE.BufferGeometry,
  wallThicknessMm: number,
): THREE.BufferGeometry {
  const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
  const idxAttr = geometry.getIndex();
  if (!posAttr || !idxAttr) return geometry.clone();

  const vertexCount = posAttr.count;
  const indices = Array.from(idxAttr.array);
  const outerPositions = new Float32Array(posAttr.array);
  const normals = computeSmoothNormals(outerPositions, indices);

  const innerPositions = new Float32Array(vertexCount * 3);
  for (let i = 0; i < vertexCount; i++) {
    innerPositions[i * 3 + 0] = outerPositions[i * 3 + 0] - normals[i * 3 + 0] * wallThicknessMm;
    innerPositions[i * 3 + 1] = outerPositions[i * 3 + 1] - normals[i * 3 + 1] * wallThicknessMm;
    innerPositions[i * 3 + 2] = outerPositions[i * 3 + 2] - normals[i * 3 + 2] * wallThicknessMm;
  }

  const positions = new Float32Array(vertexCount * 2 * 3);
  positions.set(outerPositions, 0);
  positions.set(innerPositions, vertexCount * 3);

  const triCount = indices.length / 3;
  const newIndices: number[] = new Array(indices.length * 2);
  for (let t = 0; t < triCount; t++) {
    const a = indices[t * 3];
    const b = indices[t * 3 + 1];
    const c = indices[t * 3 + 2];
    newIndices[t * 3] = a;
    newIndices[t * 3 + 1] = b;
    newIndices[t * 3 + 2] = c;
    const io = indices.length + t * 3;
    // Reversed winding so the inner shell faces inward.
    newIndices[io] = c + vertexCount;
    newIndices[io + 1] = b + vertexCount;
    newIndices[io + 2] = a + vertexCount;
  }

  // Boundary edges of the outer mesh (used by exactly one triangle) get a
  // rim wall connecting the outer edge to its inner counterpart.
  const edgeCount = new Map<string, { a: number; b: number; count: number }>();
  for (let t = 0; t < triCount; t++) {
    const tri = [indices[t * 3], indices[t * 3 + 1], indices[t * 3 + 2]];
    for (let e = 0; e < 3; e++) {
      const a = tri[e];
      const b = tri[(e + 1) % 3];
      const key = a < b ? `${a}_${b}` : `${b}_${a}`;
      const existing = edgeCount.get(key);
      if (existing) existing.count++;
      else edgeCount.set(key, { a, b, count: 1 });
    }
  }
  for (const { a, b, count } of edgeCount.values()) {
    if (count !== 1) continue;
    newIndices.push(a, b, b + vertexCount);
    newIndices.push(a, b + vertexCount, a + vertexCount);
  }

  const shell = new THREE.BufferGeometry();
  shell.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  shell.setIndex(newIndices);
  shell.computeVertexNormals();
  return shell;
}
