import { create } from 'zustand';
import type { Point2D } from '../utils/smoothPath';
import type { BodyMaterial } from '../utils/materials';

export type NoseType = 'rounded' | 'flat';
export type FillType = 'solid' | 'hollow';
// What this body part does while "Reel in" is held on the Simulate tab —
// an explicit per-part designer choice (like Fill/Material), not something
// derived from the profile curves, since a curl-tail's spiral shape isn't
// distinguishable from any other curvy silhouette by the geometry alone.
export type RetrieveAction = 'none' | 'spinningTail';

// Every curve is an open profile: x = position along its own axis (mm),
// y = distance from the centerline (mm, always >= 0). "Primary" curves are
// the ones always shown/edited; "Mirror" curves are the opposite half
// (bottom for side, left for top/front) and are only independently editable
// when symmetry is turned off — otherwise they're just a visual reflection
// of the primary curve.
export type CurveKey = 'side' | 'sideMirror' | 'top' | 'topMirror' | 'front' | 'frontMirror';

const DEFAULT_LENGTH = 120;
const DEFAULT_GIRTH = 28;

// Side/top default: nose-to-tail radius profile, doubles as the lathe
// profile that drives the 3D body (see generateLureMesh.ts).
const defaultLengthwisePoints: Point2D[] = [
  { x: 0, y: 1 },
  { x: 20, y: 10 },
  { x: 45, y: 14 },
  { x: 80, y: 11 },
  { x: 105, y: 5 },
  { x: 120, y: 0.5 },
];

// Front default: belly-to-back half-width profile approximating the same
// circular cross-section the lathe body actually has by default.
function defaultCrossSectionPoints(girth: number): Point2D[] {
  const r = girth / 2;
  return [
    { x: 0, y: 1 },
    { x: girth * 0.2, y: r * 0.85 },
    { x: girth * 0.5, y: r },
    { x: girth * 0.8, y: r * 0.85 },
    { x: girth, y: 1 },
  ];
}

function clonePoints(points: Point2D[]): Point2D[] {
  return points.map((p) => ({ ...p }));
}

function scalePoints(points: Point2D[], scaleX: number, scaleY: number): Point2D[] {
  return points.map((p) => ({ x: p.x * scaleX, y: p.y * scaleY }));
}

interface ProfileState {
  length: number;
  girth: number;
  noseType: NoseType;
  symmetric: boolean;
  // Whether the body counts as a filled solid or a shelled hollow for the
  // live weight/buoyancy calculation (separate from Export's print-specific
  // wall-thickness setting — see ExportPanel.tsx).
  fill: FillType;
  wallThicknessMm: number;
  // Body material — determines density for the live weight/buoyancy
  // calculation (see utils/materials.ts's BODY_MATERIAL_DENSITY_G_CM3).
  material: BodyMaterial;
  retrieveAction: RetrieveAction;
  curves: Record<CurveKey, Point2D[]>;
  setLength: (mm: number) => void;
  setGirth: (mm: number) => void;
  setNoseType: (type: NoseType) => void;
  setSymmetric: (v: boolean) => void;
  setFill: (f: FillType) => void;
  setWallThicknessMm: (mm: number) => void;
  setMaterial: (m: BodyMaterial) => void;
  setRetrieveAction: (a: RetrieveAction) => void;
  addPoint: (key: CurveKey, point: Point2D) => void;
  updatePoint: (key: CurveKey, index: number, point: Point2D) => void;
  deletePoint: (key: CurveKey, index: number) => void;
}

const initialFront = defaultCrossSectionPoints(DEFAULT_GIRTH);

export const useProfileStore = create<ProfileState>((set, get) => ({
  length: DEFAULT_LENGTH,
  girth: DEFAULT_GIRTH,
  noseType: 'rounded',
  symmetric: true,
  fill: 'solid',
  wallThicknessMm: 2,
  material: 'pla',
  retrieveAction: 'none',
  curves: {
    side: clonePoints(defaultLengthwisePoints),
    sideMirror: clonePoints(defaultLengthwisePoints),
    top: clonePoints(defaultLengthwisePoints),
    topMirror: clonePoints(defaultLengthwisePoints),
    front: clonePoints(initialFront),
    frontMirror: clonePoints(initialFront),
  },

  setLength: (mm) => {
    const { length, curves } = get();
    if (length <= 0 || mm <= 0) return;
    const scale = mm / length;
    set({
      length: mm,
      curves: {
        ...curves,
        side: scalePoints(curves.side, scale, 1),
        sideMirror: scalePoints(curves.sideMirror, scale, 1),
        top: scalePoints(curves.top, scale, 1),
        topMirror: scalePoints(curves.topMirror, scale, 1),
      },
    });
  },

  setGirth: (mm) => {
    const { girth, curves } = get();
    if (girth <= 0 || mm <= 0) return;
    const scale = mm / girth;
    set({
      girth: mm,
      curves: {
        ...curves,
        side: scalePoints(curves.side, 1, scale),
        sideMirror: scalePoints(curves.sideMirror, 1, scale),
        top: scalePoints(curves.top, 1, scale),
        topMirror: scalePoints(curves.topMirror, 1, scale),
        front: scalePoints(curves.front, scale, scale),
        frontMirror: scalePoints(curves.frontMirror, scale, scale),
      },
    });
  },

  setNoseType: (type) => set({ noseType: type }),
  setSymmetric: (v) => set({ symmetric: v }),
  setFill: (f) => set({ fill: f }),
  setWallThicknessMm: (mm) => set({ wallThicknessMm: Math.max(0.1, mm) }),
  setMaterial: (m) => set({ material: m }),
  setRetrieveAction: (a) => set({ retrieveAction: a }),

  addPoint: (key, point) => {
    const curves = get().curves;
    const points = [...curves[key], point].sort((a, b) => a.x - b.x);
    set({ curves: { ...curves, [key]: points } });
  },

  updatePoint: (key, index, point) => {
    const curves = get().curves;
    const points = [...curves[key]];
    points[index] = point;
    set({ curves: { ...curves, [key]: points } });
  },

  deletePoint: (key, index) => {
    const curves = get().curves;
    const points = curves[key];
    if (points.length <= 3) return; // keep a minimum viable curve
    set({ curves: { ...curves, [key]: points.filter((_, i) => i !== index) } });
  },
}));
