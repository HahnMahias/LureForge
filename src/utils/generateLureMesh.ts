import * as THREE from 'three';
import type { Point2D } from './smoothPath';
import type { NoseType } from '../store/useProfileStore';
import { evaluateCurveAtX } from './curveMath';

const LENGTH_STEPS = 48;
const RING_SAMPLES_PER_SIDE = 16;

export interface LureCurves {
  side: Point2D[];
  sideMirror: Point2D[];
  top: Point2D[];
  topMirror: Point2D[];
  front: Point2D[];
  frontMirror: Point2D[];
}

interface RingTemplatePoint {
  v: number; // -1 (belly) .. +1 (back), normalized vertical position
  hNorm: number; // 0..~1, normalized outward distance for this side
  sign: 1 | -1; // +1 = right, -1 = left
}

/**
 * The front-view curve (belly-to-back half-width) is resampled into a dense,
 * closed ring template, normalized to a -1..1 vertical range and a 0..1
 * outward range. This template is reused unscaled at every length position;
 * the side/top curves only supply the per-position scale, so the ring
 * always keeps the front view's silhouette (round, flattened, teardrop,
 * whatever was drawn) rather than degrading to a plain circle.
 */
function buildRingTemplate(front: Point2D[], frontMirror: Point2D[], girth: number): RingTemplatePoint[] {
  const halfGirth = girth / 2 || 1;
  const right: RingTemplatePoint[] = [];
  const left: RingTemplatePoint[] = [];

  for (let i = 0; i < RING_SAMPLES_PER_SIDE; i++) {
    const heightFrac = i / (RING_SAMPLES_PER_SIDE - 1);
    const heightMm = heightFrac * girth;
    const v = heightFrac * 2 - 1;

    const wRight = Math.max(evaluateCurveAtX(front, heightMm), 0);
    right.push({ v, hNorm: wRight / halfGirth, sign: 1 });

    const wLeft = Math.max(evaluateCurveAtX(frontMirror, heightMm), 0);
    left.push({ v, hNorm: wLeft / halfGirth, sign: -1 });
  }

  // Right side ascends belly -> back; left side is reversed (back -> belly)
  // with its shared pole samples dropped so the ring doesn't carry
  // near-duplicate vertices at the two tips.
  const leftReversed = [...left].reverse().slice(1, -1);
  return [...right, ...leftReversed];
}

/**
 * Revolve vs. loft: a plain lathe can only ever produce a circular
 * cross-section. Feeding it the front-view curve as well as side/top lets
 * the body be a true elliptical (or arbitrary) cross-section that tapers
 * along the length using the side curve for the vertical radius and the top
 * curve for the horizontal radius — and, when symmetry is off, the two
 * halves of each curve are sampled independently so the body can be
 * genuinely asymmetric (e.g. a flatter belly than back).
 */
export interface LureGeometryResult {
  geometry: THREE.BufferGeometry;
  // Offset applied to center/rest the body, in the same body-local mm space
  // (x: 0=nose..length=tail, y: 0=centerline) that hardware features are
  // positioned in: worldX = localX - offset.x, worldY = localY + offset.y.
  offset: { x: number; y: number };
}

export function buildLureGeometry(
  curves: LureCurves,
  length: number,
  girth: number,
  noseType: NoseType,
  symmetric: boolean,
): LureGeometryResult {
  if (length <= 0 || girth <= 0) {
    return { geometry: new THREE.BufferGeometry(), offset: { x: 0, y: 0 } };
  }

  const ring = buildRingTemplate(curves.front, symmetric ? curves.front : curves.frontMirror, girth);
  const ringLen = ring.length;
  // +1 duplicated seam vertex per ring — see the loop below for why: without
  // it, the closing triangle's UV-v jumps from ~1 straight back to 0,
  // sampling the whole belly->back->belly gradient (paintTexture.ts) across
  // one thin sliver at the belly centerline instead of wrapping cleanly.
  const stride = ringLen + 1;

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i < LENGTH_STEPS; i++) {
    const x = (i / (LENGTH_STEPS - 1)) * length;
    const isNoseRing = i === 0 && noseType === 'rounded';

    const upR = isNoseRing ? 0 : evaluateCurveAtX(curves.side, x);
    const downR = isNoseRing ? 0 : symmetric ? upR : evaluateCurveAtX(curves.sideMirror, x);
    const rightR = isNoseRing ? 0 : evaluateCurveAtX(curves.top, x);
    const leftR = isNoseRing ? 0 : symmetric ? rightR : evaluateCurveAtX(curves.topMirror, x);

    const u = i / (LENGTH_STEPS - 1);
    for (let j = 0; j < ring.length; j++) {
      const pt = ring[j];
      const verticalR = pt.v >= 0 ? upR : downR;
      const horizontalR = pt.sign >= 0 ? rightR : leftR;
      const y = pt.v * verticalR;
      const z = pt.sign * pt.hNorm * horizontalR;
      positions.push(x, y, z);
      uvs.push(u, j / ringLen);
    }
    // Duplicate ring point 0 (belly) with v=1 instead of v=0, so the seam
    // triangle interpolates from ~0.93 to 1.0 (a small, correct step within
    // the belly color) instead of ~0.93 back to 0.0 (which samples straight
    // through the back color in the middle of the gradient).
    const seam = ring[0];
    const seamVerticalR = seam.v >= 0 ? upR : downR;
    const seamHorizontalR = seam.sign >= 0 ? rightR : leftR;
    positions.push(x, seam.v * seamVerticalR, seam.sign * seam.hNorm * seamHorizontalR);
    uvs.push(u, 1);
  }

  for (let i = 0; i < LENGTH_STEPS - 1; i++) {
    for (let j = 0; j < ringLen; j++) {
      // The last segment wraps to the duplicated seam vertex, not back to 0.
      const jNext = j + 1 === ringLen ? ringLen : j + 1;
      const a = i * stride + j;
      const b = i * stride + jNext;
      const c = (i + 1) * stride + j;
      const d = (i + 1) * stride + jNext;
      indices.push(a, c, b, b, c, d);
    }
  }

  // Flat nose: fan-cap the first ring instead of letting it collapse to a
  // point, so the face reads as a blunt, sealed disc.
  if (noseType === 'flat') {
    const centerIndex = positions.length / 3;
    positions.push(0, 0, 0);
    uvs.push(0, 0.5);
    for (let j = 0; j < ringLen; j++) {
      const a = j;
      const b = (j + 1) % ringLen;
      indices.push(centerIndex, b, a);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  // Rest the body on the grid and center it along its length.
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  const offset = { x: length / 2, y: -box.min.y };
  geometry.translate(-offset.x, offset.y, 0);

  return { geometry, offset };
}
