import type { Point2D } from '../utils/smoothPath';

export type DecalPattern = 'star' | 'circle' | 'diamond' | 'stripe';

function starPoints(spikes = 5, outerR = 6, innerR = 2.4): Point2D[] {
  const pts: Point2D[] = [];
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = (Math.PI / spikes) * i - Math.PI / 2;
    pts.push({ x: r * Math.cos(a), y: r * Math.sin(a) });
  }
  return pts;
}

function circlePoints(r = 5, segments = 16): Point2D[] {
  const pts: Point2D[] = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pts.push({ x: r * Math.cos(a), y: r * Math.sin(a) });
  }
  return pts;
}

const diamondPoints: Point2D[] = [
  { x: 0, y: 6 },
  { x: 4, y: 0 },
  { x: 0, y: -6 },
  { x: -4, y: 0 },
];

const stripePoints: Point2D[] = [
  { x: -8, y: 2 },
  { x: 8, y: 2 },
  { x: 8, y: -2 },
  { x: -8, y: -2 },
];

// TODO: full custom image/text upload isn't implemented yet — this is a
// small built-in shape library to start with, per the original scope note.
export const DECAL_PRESETS: Record<DecalPattern, { label: string; points: Point2D[] }> = {
  star: { label: 'Star', points: starPoints() },
  circle: { label: 'Circle', points: circlePoints() },
  diamond: { label: 'Diamond', points: diamondPoints },
  stripe: { label: 'Stripe', points: stripePoints },
};

export const DECAL_PATTERNS = Object.keys(DECAL_PRESETS) as DecalPattern[];
