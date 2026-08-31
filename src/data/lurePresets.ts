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

// For Spoons — a strongly flattened oval instead of round, to approximate
// the thin sheet metal of a real spoon (the lofting system has no separate
// "thickness" channel apart from girth, so this is the closest honest
// approximation — see the caveat on Spoons below).
const FLAT_CROSS_SECTION: FracPoint[] = [
  { xFrac: 0, rFrac: 0.04 },
  { xFrac: 0.2, rFrac: 0.45 },
  { xFrac: 0.5, rFrac: 0.6 },
  { xFrac: 0.8, rFrac: 0.45 },
  { xFrac: 1, rFrac: 0.04 },
];

export const LURE_PRESETS: LurePreset[] = [
  {
    id: 'jig',
    label: 'Jig',
    description: 'Round lead head tapering quickly to a bare shank — pair with a Skirt or Fin.',
    length: 25,
    girth: 14,
    noseType: 'rounded',
    lengthwiseShape: [
      { xFrac: 0, rFrac: 0.25 },
      { xFrac: 0.06, rFrac: 0.95 },
      { xFrac: 0.18, rFrac: 1 },
      { xFrac: 0.28, rFrac: 0.5 },
      { xFrac: 0.5, rFrac: 0.18 },
      { xFrac: 1, rFrac: 0.08 },
    ],
    crossSectionShape: ROUND_CROSS_SECTION,
  },
  {
    id: 'spinnerbait',
    label: 'Spinnerbait',
    description:
      "Not really a single body in reality — a bent wire with a head + skirt on one end and blade(s) on the other. This is just the head. Add a Wire frame (V wire fits best) and a Spinner blade yourself.",
    length: 18,
    girth: 12,
    noseType: 'rounded',
    lengthwiseShape: [
      { xFrac: 0, rFrac: 0.2 },
      { xFrac: 0.15, rFrac: 0.85 },
      { xFrac: 0.35, rFrac: 1 },
      { xFrac: 0.6, rFrac: 0.7 },
      { xFrac: 1, rFrac: 0.15 },
    ],
    crossSectionShape: ROUND_CROSS_SECTION,
  },
  {
    id: 'jerkbait',
    label: 'Jerkbait',
    description: 'Slim, elongated minnow silhouette — pair with a Lip for the diving action.',
    length: 100,
    girth: 20,
    noseType: 'rounded',
    lengthwiseShape: [
      { xFrac: 0, rFrac: 0.08 },
      { xFrac: 0.2, rFrac: 0.62 },
      { xFrac: 0.45, rFrac: 1 },
      { xFrac: 0.7, rFrac: 0.72 },
      { xFrac: 0.9, rFrac: 0.32 },
      { xFrac: 1, rFrac: 0.05 },
    ],
    crossSectionShape: ROUND_CROSS_SECTION,
  },
  {
    id: 'crankbait',
    label: 'Crankbait',
    description: 'Short, fat, round body for a wide wobble — pair with a Lip.',
    length: 65,
    girth: 40,
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
    id: 'swimbait',
    label: 'Swimbait',
    description:
      'Full, realistic baitfish body. For the classic jointed swimbait feel: add an extra Segment in the Editor (Hinge or Ball joint) for a loosely-moving tail, and add a Fin as the tail/caudal fin.',
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
    id: 'softbait',
    label: 'Softbait',
    description:
      'Classic worm shape: long, nearly uniform thickness, tapering at both ends. Grubs/creatures also start well from here — just adjust the Side/Top curves.',
    length: 130,
    girth: 11,
    noseType: 'rounded',
    lengthwiseShape: [
      { xFrac: 0, rFrac: 0.5 },
      { xFrac: 0.1, rFrac: 0.9 },
      { xFrac: 0.5, rFrac: 1 },
      { xFrac: 0.9, rFrac: 0.9 },
      { xFrac: 1, rFrac: 0.1 },
    ],
    crossSectionShape: ROUND_CROSS_SECTION,
  },
  {
    id: 'topwater',
    label: 'Topwater',
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
    id: 'poppers',
    label: 'Poppers',
    description:
      'Blunt, flat face for the "plop". A real popper mouth is also concave/scooped inward, which goes beyond what the Nose setting here can do (only Rounded/Flat) — "Flat" is the closest approximation; carve the hollow mouth further yourself on the Front tab if you want.',
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
    id: 'spoons',
    label: 'Spoons',
    description:
      "Elongated, slightly curved, thin blade. The lofting system has no separate \"plate thickness\" channel, so this uses a strongly flattened cross-section as an approximation — for a true concave spoon-bowl effect, carve the Front profile further yourself.",
    length: 55,
    girth: 20,
    noseType: 'rounded',
    lengthwiseShape: [
      { xFrac: 0, rFrac: 0.1 },
      { xFrac: 0.3, rFrac: 0.85 },
      { xFrac: 0.55, rFrac: 1 },
      { xFrac: 0.8, rFrac: 0.7 },
      { xFrac: 1, rFrac: 0.15 },
    ],
    crossSectionShape: FLAT_CROSS_SECTION,
  },
  {
    id: 'fly',
    label: 'Fly',
    description:
      'A fly has no body — this is just the thread-wrapped section of the hook shank. Pair with a small Hook (single) and a Skirt with short, thin strands for the tail/hackle.',
    length: 15,
    girth: 4,
    noseType: 'rounded',
    lengthwiseShape: [
      { xFrac: 0, rFrac: 0.3 },
      { xFrac: 0.2, rFrac: 0.8 },
      { xFrac: 0.5, rFrac: 1 },
      { xFrac: 0.8, rFrac: 0.8 },
      { xFrac: 1, rFrac: 0.3 },
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
