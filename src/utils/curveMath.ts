import type { Point2D } from './smoothPath';

/**
 * Numeric Catmull-Rom evaluation of y as a function of x, for a curve whose
 * control points are sorted by x. Used to sample the side/top/front curves
 * at arbitrary positions when lofting the 3D body (the SVG editor draws the
 * same family of curve via pointsToSmoothPath; this is the numeric
 * counterpart needed for geometry generation).
 */
export function evaluateCurveAtX(points: Point2D[], x: number): number {
  if (points.length === 0) return 0;
  if (points.length === 1) return points[0].y;
  if (x <= points[0].x) return points[0].y;
  const last = points[points.length - 1];
  if (x >= last.x) return last.y;

  let i = 0;
  while (i < points.length - 2 && points[i + 1].x < x) i++;

  const p0 = points[i - 1] ?? points[i];
  const p1 = points[i];
  const p2 = points[i + 1];
  const p3 = points[i + 2] ?? p2;

  const span = p2.x - p1.x;
  const t = span === 0 ? 0 : (x - p1.x) / span;
  const t2 = t * t;
  const t3 = t2 * t;

  return (
    0.5 *
    (2 * p1.y +
      (-p0.y + p2.y) * t +
      (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
      (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)
  );
}

function catmullRomPoint(p0: Point2D, p1: Point2D, p2: Point2D, p3: Point2D, t: number): Point2D {
  const t2 = t * t;
  const t3 = t2 * t;
  const a = (v0: number, v1: number, v2: number, v3: number) =>
    0.5 * (2 * v1 + (-v0 + v2) * t + (2 * v0 - 5 * v1 + 4 * v2 - v3) * t2 + (-v0 + 3 * v1 - 3 * v2 + v3) * t3);
  return { x: a(p0.x, p1.x, p2.x, p3.x), y: a(p0.y, p1.y, p2.y, p3.y) };
}

/**
 * Resamples a closed freeform outline (e.g. a hand-drawn fin) along the same
 * Catmull-Rom curve the 2D editor renders, so the 3D extrusion matches the
 * smooth preview instead of the raw straight-edged polygon between control
 * points.
 */
export function sampleClosedCurve(points: Point2D[], samplesPerSegment = 8): Point2D[] {
  const n = points.length;
  if (n < 3) return points;
  const at = (i: number) => points[((i % n) + n) % n];
  const result: Point2D[] = [];
  for (let i = 0; i < n; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    for (let s = 0; s < samplesPerSegment; s++) {
      result.push(catmullRomPoint(p0, p1, p2, p3, s / samplesPerSegment));
    }
  }
  return result;
}
