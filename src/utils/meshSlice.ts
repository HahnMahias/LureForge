import * as THREE from 'three';

type Tri = [THREE.Vector3, THREE.Vector3, THREE.Vector3];
interface Segment {
  a: THREE.Vector3;
  b: THREE.Vector3;
}

function extractTriangles(geometry: THREE.BufferGeometry): Tri[] {
  const pos = geometry.getAttribute('position') as THREE.BufferAttribute;
  const idx = geometry.getIndex();
  const triCount = idx ? idx.count / 3 : pos.count / 3;
  const tris: Tri[] = [];
  for (let t = 0; t < triCount; t++) {
    const ia = idx ? idx.getX(t * 3) : t * 3;
    const ib = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
    const ic = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
    tris.push([
      new THREE.Vector3().fromBufferAttribute(pos, ia),
      new THREE.Vector3().fromBufferAttribute(pos, ib),
      new THREE.Vector3().fromBufferAttribute(pos, ic),
    ]);
  }
  return tris;
}

/** Clips one triangle against the half-space keepPositive ? z>=0 : z<=0. */
function clipTriangle(tri: Tri, keepPositive: boolean): { tris: Tri[]; cut: Segment | null } {
  const side = (v: THREE.Vector3) => (keepPositive ? v.z : -v.z);
  const inside = tri.map((p) => side(p) >= -1e-9);
  const insideCount = inside.filter(Boolean).length;

  if (insideCount === 3) return { tris: [tri], cut: null };
  if (insideCount === 0) return { tris: [], cut: null };

  const polygon: THREE.Vector3[] = [];
  const cutPoints: THREE.Vector3[] = [];
  for (let i = 0; i < 3; i++) {
    const curr = tri[i];
    const next = tri[(i + 1) % 3];
    const currIn = inside[i];
    const nextIn = inside[(i + 1) % 3];
    if (currIn) polygon.push(curr);
    if (currIn !== nextIn) {
      const t = side(curr) / (side(curr) - side(next));
      const ip = curr.clone().lerp(next, t);
      ip.z = 0;
      polygon.push(ip);
      cutPoints.push(ip);
    }
  }

  const tris: Tri[] = [];
  for (let i = 1; i < polygon.length - 1; i++) {
    tris.push([polygon[0], polygon[i], polygon[i + 1]]);
  }
  // Exactly two cut points for a straddling triangle; keep their order (it
  // carries the triangle's winding) so segments can be chained into a
  // consistently-oriented boundary loop.
  const cut = cutPoints.length === 2 ? { a: cutPoints[0], b: cutPoints[1] } : null;
  return { tris, cut };
}

function keyOf(v: THREE.Vector3): string {
  return `${v.x.toFixed(4)}_${v.y.toFixed(4)}`;
}

function chainSegmentsToLoops(segments: Segment[]): THREE.Vector3[][] {
  const bySrc = new Map<string, Segment[]>();
  for (const s of segments) {
    const k = keyOf(s.a);
    if (!bySrc.has(k)) bySrc.set(k, []);
    bySrc.get(k)!.push(s);
  }
  const used = new Set<Segment>();
  const loops: THREE.Vector3[][] = [];

  for (const start of segments) {
    if (used.has(start)) continue;
    const loop: THREE.Vector3[] = [start.a];
    let current = start;
    used.add(current);
    let guard = 0;
    while (guard++ < segments.length + 5) {
      loop.push(current.b);
      if (keyOf(current.b) === keyOf(loop[0])) break;
      const candidates = bySrc.get(keyOf(current.b)) ?? [];
      const next = candidates.find((c) => !used.has(c));
      if (!next) break;
      used.add(next);
      current = next;
    }
    if (loop.length > 2 && keyOf(loop[0]) === keyOf(loop[loop.length - 1])) {
      loop.pop();
      loops.push(loop);
    }
  }
  return loops;
}

function loopBoundsDiagonal(loop: THREE.Vector3[]): number {
  const box = new THREE.Box2();
  for (const p of loop) box.expandByPoint(new THREE.Vector2(p.x, p.y));
  return box.getSize(new THREE.Vector2()).length();
}

/** Fills the cut-face opening(s) left by clipping, using the largest loop as
 * the outer contour and any remaining loops as holes (the hollow shell's
 * inner-surface boundary), so the cross-section reads as a solid wall. */
function capLoops(loops: THREE.Vector3[][], desiredNormalZ: number): Tri[] {
  if (loops.length === 0) return [];
  const sorted = [...loops].sort((a, b) => loopBoundsDiagonal(b) - loopBoundsDiagonal(a));
  const outer = sorted[0];
  const holes = sorted.slice(1);

  const toVec2 = (p: THREE.Vector3) => new THREE.Vector2(p.x, p.y);
  const outer2 = outer.map(toVec2);
  const holes2 = holes.map((h) => h.map(toVec2));

  let triIndices: number[][];
  try {
    triIndices = THREE.ShapeUtils.triangulateShape(outer2, holes2);
  } catch {
    return [];
  }

  const allPoints = [...outer, ...holes.flat()];
  const tris: Tri[] = triIndices.map(([ia, ib, ic]) => [allPoints[ia], allPoints[ib], allPoints[ic]]);

  // Orient the cap to face the intended direction; flip every triangle if
  // the first one doesn't already.
  if (tris.length > 0) {
    const [p0, p1, p2] = tris[0];
    const normal = new THREE.Vector3()
      .subVectors(p1, p0)
      .cross(new THREE.Vector3().subVectors(p2, p0));
    if (Math.sign(normal.z || 1) !== Math.sign(desiredNormalZ)) {
      return tris.map(([a, b, c]) => [a, c, b] as Tri);
    }
  }
  return tris;
}

function trisToGeometry(tris: Tri[]): THREE.BufferGeometry {
  const positions = new Float32Array(tris.length * 9);
  tris.forEach((tri, t) => {
    tri.forEach((v, i) => {
      positions[t * 9 + i * 3 + 0] = v.x;
      positions[t * 9 + i * 3 + 1] = v.y;
      positions[t * 9 + i * 3 + 2] = v.z;
    });
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  return geo;
}

/**
 * Splits a mesh along the central vertical (X-Y) plane at Z=0 — the
 * front-to-back symmetry plane — into two halves for printing, capping the
 * newly cut face on each half so both remain solid, printable shells. If
 * the cap triangulation can't make sense of the cut boundary (unusual
 * geometry), that half is returned with an open seam rather than failing
 * the export outright.
 */
export function sliceGeometryAtZ0(geometry: THREE.BufferGeometry): {
  right: THREE.BufferGeometry;
  left: THREE.BufferGeometry;
} {
  const triangles = extractTriangles(geometry);

  const rightTris: Tri[] = [];
  const leftTris: Tri[] = [];
  const rightCuts: Segment[] = [];
  const leftCuts: Segment[] = [];

  for (const tri of triangles) {
    const r = clipTriangle(tri, true);
    rightTris.push(...r.tris);
    if (r.cut) rightCuts.push(r.cut);

    const l = clipTriangle(tri, false);
    leftTris.push(...l.tris);
    if (l.cut) leftCuts.push(l.cut);
  }

  const rightLoops = chainSegmentsToLoops(rightCuts);
  const leftLoops = chainSegmentsToLoops(leftCuts);
  rightTris.push(...capLoops(rightLoops, -1));
  leftTris.push(...capLoops(leftLoops, 1));

  return {
    right: trisToGeometry(rightTris),
    left: trisToGeometry(leftTris),
  };
}
