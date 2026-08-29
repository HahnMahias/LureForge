import type { Point2D } from './smoothPath';
import { evaluateCurveAtX } from './curveMath';

/**
 * One lofted body piece (the main body, or an extra jointed segment) in the
 * shared "assembled" frame LureBody.tsx builds: x=0 is the main body's own
 * center, and groupX is where this part's own center sits in that shared
 * frame (0 for the main body itself, further down the tail for segments).
 * Only the side/top curves are needed — see computeSubmerged's cross-section
 * approximation below for why the front curve isn't used.
 */
export interface BuoyancyPart {
  side: Point2D[];
  sideMirror: Point2D[];
  top: Point2D[];
  topMirror: Point2D[];
  length: number;
  symmetric: boolean;
  groupX: number;
  // Scales every cross-section's ellipse-approximated area so that the
  // *fully submerged* total exactly matches this part's real (triangulated
  // mesh) volume — see computeVolumeCorrection below for why this matters.
  volumeCorrection: number;
}

export interface SubmergedResult {
  volumeMm3: number;
  // Centroid of the submerged volume, in the same shared mesh-local frame
  // (belly at y=0, main body centered at x=0) as BuoyancyPart.groupX and
  // computeCenterOfGravity's result — directly comparable/subtractable.
  centroidX: number;
  centroidY: number;
}

const SAMPLES_PER_PART = 24;

/**
 * Area (and, in area/moment form, the first moment about y=0) of the region
 * of an ellipse (semi-axes W horizontal, H vertical, centered at its own
 * local origin) lying at local y <= y0. Both via the standard circle-segment
 * formulas (radius H), scaled by W/H — an ellipse is a circle stretched by
 * W/H horizontally, which scales area (and area-weighted y-moment, since
 * that scaling doesn't touch y) by the same factor. Used to get the
 * submerged area and y-centroid of one cross-section.
 */
function ellipseSegmentBelow(
  y0: number,
  halfWidth: number,
  halfHeight: number,
): { area: number; momentY: number } {
  if (halfHeight <= 1e-6 || halfWidth <= 1e-6) return { area: 0, momentY: 0 };
  const y = Math.min(Math.max(y0, -halfHeight), halfHeight);
  const h2 = halfHeight * halfHeight;
  const chord = Math.sqrt(Math.max(h2 - y * y, 0));
  const circleArea = y * chord + h2 * (Math.asin(y / halfHeight) + Math.PI / 2);
  const circleMomentY = -(2 / 3) * chord * chord * chord;
  const scale = halfWidth / halfHeight;
  return { area: scale * circleArea, momentY: scale * circleMomentY };
}

/**
 * Ratio between a part's real (triangulated mesh) volume and what the
 * ellipse-cross-section model would compute for that same part fully
 * submerged. The ellipse model only needs the side/top curves — cheap to
 * evaluate every frame — but for a hull whose true cross-section (from the
 * front curve) is thin, concave, or otherwise far from a plump ellipse
 * (a blade/spoon shape, say), the plain ellipse model can noticeably
 * *overestimate* volume. Left uncorrected, that makes the live Simulate
 * physics think the lure displaces more water than it really does — it can
 * read as neutrally buoyant or floaty in the tank even though the exact
 * mesh-based weight calculation (the same one the Editor/Export weight
 * badges use) says it should clearly sink. Scaling every sample by this
 * part-specific constant anchors the *total* submerged volume to the real
 * mesh volume once fully submerged, while still using the ellipse model's
 * (cheap, closed-form) shape for how that volume comes on as the body
 * lowers into the water.
 */
export function computeVolumeCorrection(
  part: Pick<BuoyancyPart, 'side' | 'sideMirror' | 'top' | 'topMirror' | 'length' | 'symmetric'>,
  trueVolumeMm3: number,
): number {
  if (part.length <= 0 || trueVolumeMm3 <= 0) return 1;
  const dx = part.length / SAMPLES_PER_PART;
  let ellipseVolumeMm3 = 0;
  for (let i = 0; i < SAMPLES_PER_PART; i++) {
    const designX = (i + 0.5) * dx;
    const upR = evaluateCurveAtX(part.side, designX);
    const downR = part.symmetric ? upR : evaluateCurveAtX(part.sideMirror, designX);
    const rightR = evaluateCurveAtX(part.top, designX);
    const leftR = part.symmetric ? rightR : evaluateCurveAtX(part.topMirror, designX);
    const halfHeight = (upR + downR) / 2;
    const halfWidth = (rightR + leftR) / 2;
    ellipseVolumeMm3 += Math.PI * halfWidth * halfHeight * dx;
  }
  return ellipseVolumeMm3 > 1e-6 ? trueVolumeMm3 / ellipseVolumeMm3 : 1;
}

/**
 * Approximates submerged hull volume and its X centroid for a body sitting
 * at a given world height/pitch relative to the water surface.
 *
 * Simplification (matches the same approximation already used in
 * surfacePlacement.ts): each lengthwise cross-section is treated as an
 * ellipse — vertical half-axis from the side curve, horizontal half-axis
 * from the top curve — rather than the true silhouette from the front curve.
 * This is not a CFD-accurate hull integration, but it's numerically robust
 * (closed-form ellipse-segment area, no per-triangle mesh work); each part's
 * volumeCorrection (see computeVolumeCorrection) keeps its *total* volume
 * exact even when the per-slice shape is only approximate.
 */
export function computeSubmerged(
  parts: BuoyancyPart[],
  centerlineY: number,
  positionY: number,
  pitch: number,
  waterSurfaceY: number,
): SubmergedResult {
  const cosP = Math.cos(pitch);
  const sinP = Math.sin(pitch);
  if (Math.abs(cosP) < 1e-4) return { volumeMm3: 0, centroidX: 0, centroidY: 0 };

  let volumeMm3 = 0;
  let weightedX = 0;
  let weightedY = 0;

  for (const part of parts) {
    if (part.length <= 0) continue;
    const dx = part.length / SAMPLES_PER_PART;
    const half = part.length / 2;

    for (let i = 0; i < SAMPLES_PER_PART; i++) {
      const designX = (i + 0.5) * dx;
      const sharedX = part.groupX + (designX - half);

      const upR = evaluateCurveAtX(part.side, designX);
      const downR = part.symmetric ? upR : evaluateCurveAtX(part.sideMirror, designX);
      const rightR = evaluateCurveAtX(part.top, designX);
      const leftR = part.symmetric ? rightR : evaluateCurveAtX(part.topMirror, designX);

      const halfHeight = (upR + downR) / 2;
      const halfWidth = (rightR + leftR) / 2;
      const ellipseCenterY = (upR - downR) / 2; // relative to centerline

      // Local y (relative to centerline) at which the water surface
      // intersects this cross-section, derived from the body's current
      // world position/rotation (rotation.z about the shared frame's
      // origin, matching how the group is transformed in SimulateView).
      const waterlineRelCenterline = (waterSurfaceY - positionY - sharedX * sinP) / cosP - centerlineY;
      const y0 = waterlineRelCenterline - ellipseCenterY;

      const { area, momentY } = ellipseSegmentBelow(y0, halfWidth, halfHeight);
      const sharedY = centerlineY + ellipseCenterY + (area > 1e-9 ? momentY / area : 0);
      const correctedArea = area * part.volumeCorrection;

      volumeMm3 += correctedArea * dx;
      weightedX += correctedArea * dx * sharedX;
      weightedY += correctedArea * dx * sharedY;
    }
  }

  return {
    volumeMm3,
    centroidX: volumeMm3 > 1e-6 ? weightedX / volumeMm3 : 0,
    centroidY: volumeMm3 > 1e-6 ? weightedY / volumeMm3 : 0,
  };
}
