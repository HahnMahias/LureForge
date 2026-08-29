export interface Point2D {
  x: number;
  y: number;
}

/**
 * Converts a series of points into a smooth SVG path using a
 * Catmull-Rom-to-Bezier conversion, so the curve passes through every point.
 */
export function pointsToSmoothPath(points: Point2D[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  const d: string[] = [`M ${points[0].x} ${points[0].y}`];
  const tension = 6; // higher = tighter curve

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;

    const cp1x = p1.x + (p2.x - p0.x) / tension;
    const cp1y = p1.y + (p2.y - p0.y) / tension;
    const cp2x = p2.x - (p3.x - p1.x) / tension;
    const cp2y = p2.y - (p3.y - p1.y) / tension;

    d.push(`C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`);
  }

  return d.join(' ');
}

/**
 * Same Catmull-Rom-to-Bezier conversion as pointsToSmoothPath, but wraps
 * around so the curve closes smoothly into a loop (used for freeform
 * outlines like fins, where the last point connects back to the first).
 */
export function pointsToClosedSmoothPath(points: Point2D[]): string {
  const n = points.length;
  if (n === 0) return '';
  if (n < 3) return pointsToSmoothPath(points);

  const at = (i: number) => points[((i % n) + n) % n];
  const d: string[] = [`M ${points[0].x} ${points[0].y}`];
  const tension = 6;

  for (let i = 0; i < n; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);

    const cp1x = p1.x + (p2.x - p0.x) / tension;
    const cp1y = p1.y + (p2.y - p0.y) / tension;
    const cp2x = p2.x - (p3.x - p1.x) / tension;
    const cp2y = p2.y - (p3.y - p1.y) / tension;

    d.push(`C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`);
  }

  d.push('Z');
  return d.join(' ');
}
