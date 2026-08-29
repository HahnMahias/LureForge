import type { Point2D } from '../utils/smoothPath';
import type { CurveKey, NoseType } from '../store/useProfileStore';

// Fractional profile: xFrac 0..1 along its own axis (length for side/top,
// girth for front), rFrac 0..1 of half-girth. Presets are defined this way
// (rather than fixed mm) so the same shape scales cleanly to whatever
// length/girth the user picks on the wizard's Type step.
interface FracPoint {
  xFrac: number;
  rFrac: number;
}

export interface LurePreset {
  id: string;
  label: string;
  description: string;
  length: number; // default mm
  girth: number; // default mm
  noseType: NoseType;
  lengthwiseShape: FracPoint[]; // reused for both side and top curves
  crossSectionShape: FracPoint[]; // used for front curve
}

const ROUND_CROSS_SECTION: FracPoint[] = [
  { xFrac: 0, rFrac: 0.07 },
  { xFrac: 0.2, rFrac: 0.85 },
  { xFrac: 0.5, rFrac: 1 },
  { xFrac: 0.8, rFrac: 0.85 },
  { xFrac: 1, rFrac: 0.07 },
];

export const LURE_PRESETS: LurePreset[] = [
  {
    id: 'minnow',
    label: 'Minnow',
    description: 'Slim, tapered baitfish shape — a versatile all-rounder.',
    length: 120,
    girth: 28,
    noseType: 'rounded',
    lengthwiseShape: [
      { xFrac: 0, rFrac: 0.07 },
      { xFrac: 0.167, rFrac: 0.71 },
      { xFrac: 0.375, rFrac: 1 },
      { xFrac: 0.667, rFrac: 0.79 },
      { xFrac: 0.875, rFrac: 0.36 },
      { xFrac: 1, rFrac: 0.04 },
    ],
    crossSectionShape: ROUND_CROSS_SECTION,
  },
  {
    id: 'popper',
    label: 'Popper',
    description: 'Blunt, flat face for a surface splash, tapering to a slim tail.',
    length: 70,
    girth: 32,
    noseType: 'flat',
    lengthwiseShape: [
      { xFrac: 0, rFrac: 0.9 },
      { xFrac: 0.15, rFrac: 1 },
      { xFrac: 0.45, rFrac: 0.8 },
      { xFrac: 0.75, rFrac: 0.55 },
      { xFrac: 1, rFrac: 0.15 },
    ],
    crossSectionShape: ROUND_CROSS_SECTION,
  },
  {
    id: 'crankbait',
    label: 'Crankbait',
    description: 'Short, fat, rounded body for a wide wobbling action.',
    length: 65,
    girth: 38,
    noseType: 'rounded',
    lengthwiseShape: [
      { xFrac: 0, rFrac: 0.3 },
      { xFrac: 0.1, rFrac: 0.85 },
      { xFrac: 0.3, rFrac: 1 },
      { xFrac: 0.6, rFrac: 0.85 },
      { xFrac: 0.85, rFrac: 0.5 },
      { xFrac: 1, rFrac: 0.1 },
    ],
    crossSectionShape: ROUND_CROSS_SECTION,
  },
  {
    id: 'jerkbait',
    label: 'Jerkbait',
    description: 'Slender, elongated suspending stick shape for a subtle darting action.',
    length: 100,
    girth: 22,
    noseType: 'rounded',
    lengthwiseShape: [
      { xFrac: 0, rFrac: 0.1 },
      { xFrac: 0.2, rFrac: 0.65 },
      { xFrac: 0.45, rFrac: 1 },
      { xFrac: 0.7, rFrac: 0.75 },
      { xFrac: 0.9, rFrac: 0.35 },
      { xFrac: 1, rFrac: 0.05 },
    ],
    crossSectionShape: ROUND_CROSS_SECTION,
  },
  {
    id: 'swimbait',
    label: 'Swimbait',
    description: 'Full-bodied baitfish profile for a big, realistic single-piece swimmer.',
    length: 150,
    girth: 40,
    noseType: 'rounded',
    lengthwiseShape: [
      { xFrac: 0, rFrac: 0.12 },
      { xFrac: 0.15, rFrac: 0.75 },
      { xFrac: 0.35, rFrac: 1 },
      { xFrac: 0.6, rFrac: 0.88 },
      { xFrac: 0.8, rFrac: 0.55 },
      { xFrac: 0.95, rFrac: 0.22 },
      { xFrac: 1, rFrac: 0.08 },
    ],
    crossSectionShape: ROUND_CROSS_SECTION,
  },
  {
    id: 'topwaterWalker',
    label: 'Topwater walker',
    description: 'Cigar-shaped body with a flat mid-section — built for "walk the dog" action.',
    length: 110,
    girth: 24,
    noseType: 'rounded',
    lengthwiseShape: [
      { xFrac: 0, rFrac: 0.15 },
      { xFrac: 0.15, rFrac: 0.8 },
      { xFrac: 0.4, rFrac: 1 },
      { xFrac: 0.6, rFrac: 1 },
      { xFrac: 0.85, rFrac: 0.6 },
      { xFrac: 1, rFrac: 0.1 },
    ],
    crossSectionShape: ROUND_CROSS_SECTION,
  },
  {
    id: 'jig',
    label: 'Jig',
    description: 'Short, bulbous head tapering to a thin bare shank — pair with a Skirt or Fin.',
    length: 25,
    girth: 14,
    noseType: 'rounded',
    lengthwiseShape: [
      { xFrac: 0, rFrac: 0.3 },
      { xFrac: 0.08, rFrac: 0.9 },
      { xFrac: 0.22, rFrac: 1 },
      { xFrac: 0.4, rFrac: 0.55 },
      { xFrac: 0.6, rFrac: 0.15 },
      { xFrac: 1, rFrac: 0.06 },
    ],
    crossSectionShape: ROUND_CROSS_SECTION,
  },
  {
    id: 'blank',
    label: 'Blank',
    description: 'A plain starting body with no particular shape — draw your own.',
    length: 120,
    girth: 28,
    noseType: 'rounded',
    lengthwiseShape: [
      { xFrac: 0, rFrac: 0.07 },
      { xFrac: 0.167, rFrac: 0.71 },
      { xFrac: 0.375, rFrac: 1 },
      { xFrac: 0.667, rFrac: 0.79 },
      { xFrac: 0.875, rFrac: 0.36 },
      { xFrac: 1, rFrac: 0.04 },
    ],
    crossSectionShape: ROUND_CROSS_SECTION,
  },
];

function buildLengthwisePoints(shape: FracPoint[], length: number, girth: number): Point2D[] {
  const half = girth / 2;
  return shape.map((p) => ({ x: p.xFrac * length, y: p.rFrac * half }));
}

function buildCrossSectionPoints(shape: FracPoint[], girth: number): Point2D[] {
  const half = girth / 2;
  return shape.map((p) => ({ x: p.xFrac * girth, y: p.rFrac * half }));
}

export function buildPresetCurves(
  preset: LurePreset,
  length: number,
  girth: number,
): Record<CurveKey, Point2D[]> {
  const lengthwise = buildLengthwisePoints(preset.lengthwiseShape, length, girth);
  const cross = buildCrossSectionPoints(preset.crossSectionShape, girth);
  return {
    side: lengthwise.map((p) => ({ ...p })),
    sideMirror: lengthwise.map((p) => ({ ...p })),
    top: lengthwise.map((p) => ({ ...p })),
    topMirror: lengthwise.map((p) => ({ ...p })),
    front: cross.map((p) => ({ ...p })),
    frontMirror: cross.map((p) => ({ ...p })),
  };
}
