import { create } from 'zustand';
import type { Point2D } from '../utils/smoothPath';
import type { NoseType, CurveKey, FillType, RetrieveAction } from './useProfileStore';
import type { BodyMaterial } from '../utils/materials';

// How this segment's joint to the PREVIOUS part behaves during "Reel in" —
// see utils/jointEffects.ts for the actual swing math. 'rigid' (the
// default) is exactly the old always-star-connected behavior, so existing
// projects look unchanged after this field was added.
export type JointType = 'rigid' | 'hinge' | 'ball' | 'flexTube';

// Extra body segments strung on after the main body (from useProfileStore)
// to build a jointed lure. Each segment is a fully independent little body
// with its own profile curves, so it keeps exactly the same data shape as
// the main body — this store only adds segments *beyond* the first one.
export interface ExtraSegment {
  id: string;
  name: string;
  length: number;
  girth: number;
  noseType: NoseType;
  symmetric: boolean;
  fill: FillType;
  wallThicknessMm: number;
  material: BodyMaterial;
  retrieveAction: RetrieveAction;
  jointType: JointType;
  curves: Record<CurveKey, Point2D[]>;
}

const DEFAULT_LENGTH = 45;
const DEFAULT_GIRTH = 16;

const defaultLengthwisePoints: Point2D[] = [
  { x: 0, y: 0.5 },
  { x: 12, y: 6 },
  { x: 22, y: 8 },
  { x: 33, y: 5 },
  { x: 45, y: 0.5 },
];

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

function makeDefaultSegment(name: string): ExtraSegment {
  const points = defaultLengthwisePoints.map((p) => ({ x: (p.x / 45) * DEFAULT_LENGTH, y: p.y }));
  const front = defaultCrossSectionPoints(DEFAULT_GIRTH);
  return {
    id: crypto.randomUUID(),
    name,
    length: DEFAULT_LENGTH,
    girth: DEFAULT_GIRTH,
    noseType: 'rounded',
    symmetric: true,
    fill: 'solid',
    wallThicknessMm: 2,
    material: 'pla',
    retrieveAction: 'none',
    jointType: 'rigid',
    curves: {
      side: clonePoints(points),
      sideMirror: clonePoints(points),
      top: clonePoints(points),
      topMirror: clonePoints(points),
      front: clonePoints(front),
      frontMirror: clonePoints(front),
    },
  };
}

interface SegmentsState {
  segments: ExtraSegment[];
  activeId: string | null; // null = the main body (useProfileStore) is being edited
  addSegment: () => void;
  removeSegment: (id: string) => void;
  setActiveId: (id: string | null) => void;
  setLength: (id: string, mm: number) => void;
  setGirth: (id: string, mm: number) => void;
  setNoseType: (id: string, type: NoseType) => void;
  setSymmetric: (id: string, v: boolean) => void;
  setFill: (id: string, f: FillType) => void;
  setWallThicknessMm: (id: string, mm: number) => void;
  setMaterial: (id: string, m: BodyMaterial) => void;
  setRetrieveAction: (id: string, a: RetrieveAction) => void;
  setJointType: (id: string, t: JointType) => void;
  addPoint: (id: string, key: CurveKey, point: Point2D) => void;
  updatePoint: (id: string, key: CurveKey, index: number, point: Point2D) => void;
  deletePoint: (id: string, key: CurveKey, index: number) => void;
}

function updateSegment(
  segments: ExtraSegment[],
  id: string,
  patch: (s: ExtraSegment) => ExtraSegment,
): ExtraSegment[] {
  return segments.map((s) => (s.id === id ? patch(s) : s));
}

export const useSegmentsStore = create<SegmentsState>((set, get) => ({
  segments: [],
  activeId: null,

  addSegment: () => {
    const segments = get().segments;
    const seg = makeDefaultSegment(`Segment ${segments.length + 2}`);
    set({ segments: [...segments, seg], activeId: seg.id });
  },

  removeSegment: (id) => {
    const activeId = get().activeId === id ? null : get().activeId;
    set({ segments: get().segments.filter((s) => s.id !== id), activeId });
  },

  setActiveId: (id) => set({ activeId: id }),

  setLength: (id, mm) => {
    set({
      segments: updateSegment(get().segments, id, (s) => {
        if (s.length <= 0 || mm <= 0) return s;
        const scale = mm / s.length;
        return {
          ...s,
          length: mm,
          curves: {
            ...s.curves,
            side: scalePoints(s.curves.side, scale, 1),
            sideMirror: scalePoints(s.curves.sideMirror, scale, 1),
            top: scalePoints(s.curves.top, scale, 1),
            topMirror: scalePoints(s.curves.topMirror, scale, 1),
          },
        };
      }),
    });
  },

  setGirth: (id, mm) => {
    set({
      segments: updateSegment(get().segments, id, (s) => {
        if (s.girth <= 0 || mm <= 0) return s;
        const scale = mm / s.girth;
        return {
          ...s,
          girth: mm,
          curves: {
            ...s.curves,
            side: scalePoints(s.curves.side, 1, scale),
            sideMirror: scalePoints(s.curves.sideMirror, 1, scale),
            top: scalePoints(s.curves.top, 1, scale),
            topMirror: scalePoints(s.curves.topMirror, 1, scale),
            front: scalePoints(s.curves.front, scale, scale),
            frontMirror: scalePoints(s.curves.frontMirror, scale, scale),
          },
        };
      }),
    });
  },

  setNoseType: (id, type) => {
    set({ segments: updateSegment(get().segments, id, (s) => ({ ...s, noseType: type })) });
  },

  setSymmetric: (id, v) => {
    set({ segments: updateSegment(get().segments, id, (s) => ({ ...s, symmetric: v })) });
  },

  setFill: (id, f) => {
    set({ segments: updateSegment(get().segments, id, (s) => ({ ...s, fill: f })) });
  },

  setWallThicknessMm: (id, mm) => {
    set({
      segments: updateSegment(get().segments, id, (s) => ({ ...s, wallThicknessMm: Math.max(0.1, mm) })),
    });
  },

  setMaterial: (id, m) => {
    set({ segments: updateSegment(get().segments, id, (s) => ({ ...s, material: m })) });
  },

  setRetrieveAction: (id, a) => {
    set({ segments: updateSegment(get().segments, id, (s) => ({ ...s, retrieveAction: a })) });
  },

  setJointType: (id, t) => {
    set({ segments: updateSegment(get().segments, id, (s) => ({ ...s, jointType: t })) });
  },

  addPoint: (id, key, point) => {
    set({
      segments: updateSegment(get().segments, id, (s) => ({
        ...s,
        curves: { ...s.curves, [key]: [...s.curves[key], point].sort((a, b) => a.x - b.x) },
      })),
    });
  },

  updatePoint: (id, key, index, point) => {
    set({
      segments: updateSegment(get().segments, id, (s) => {
        const points = [...s.curves[key]];
        points[index] = point;
        return { ...s, curves: { ...s.curves, [key]: points } };
      }),
    });
  },

  deletePoint: (id, key, index) => {
    set({
      segments: updateSegment(get().segments, id, (s) => {
        if (s.curves[key].length <= 3) return s;
        return { ...s, curves: { ...s.curves, [key]: s.curves[key].filter((_, i) => i !== index) } };
      }),
    });
  },
}));
