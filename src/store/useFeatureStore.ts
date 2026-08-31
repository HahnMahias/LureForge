import { create } from 'zustand';
import { useProfileStore } from './useProfileStore';
import type { BallastShape } from '../utils/meshVolume';
import type { MetalType, BodyMaterial } from '../utils/materials';
import type { WireFrameStyle } from '../data/wireFrameDefs';
import type { DecalPattern } from '../data/decalPresets';
import type { Point2D } from '../utils/smoothPath';

export type FeatureType =
  | 'eyes'
  | 'lineTie'
  | 'hookHanger'
  | 'ballast'
  | 'wireFrame'
  | 'fin'
  | 'decal'
  | 'scales'
  | 'lip'
  | 'spinnerBlade'
  | 'skirt'
  | 'hookTie';
export type LineTieStyle = 'ring' | 'staple' | 'screwEye';
export type LipShape = 'round' | 'square' | 'coffin';
export type BladeShape = 'colorado' | 'willow' | 'indiana';
export type DecalStyle = 'flat' | 'ramp';
export type DecalFill = 'rounded' | 'engraved';
// hookHanger (existing) is just the metal eyelet a hook hangs FROM — this is
// the hook itself. 'single'/'treble' share utils/hookSizes.ts's two size
// tables; 'dressedTreble' is a treble plus a trailing feather/marabou
// bundle (dressingColor), not a separate hook shape.
export type HookStyle = 'single' | 'treble' | 'dressedTreble';
export type HookFinish = 'bronze' | 'blackNickel' | 'nickel' | 'red';

export interface Position3D {
  x: number;
  y: number;
  z: number;
}

// Small sail-shaped default outline, in the fin's own local mm space.
const DEFAULT_FIN_OUTLINE: Point2D[] = [
  { x: -6, y: 0 },
  { x: -8, y: 10 },
  { x: 2, y: 14 },
  { x: 10, y: 4 },
  { x: 6, y: 0 },
];

export interface Feature {
  id: string;
  type: FeatureType;
  name: string;
  visible: boolean;
  // Body-local mm space: x 0=nose..length=tail, y 0=centerline (+up), z 0=centerline (+right).
  position: Position3D;
  // Degrees, applied on top of the marker's default orientation.
  rotation?: Position3D;
  // Line-tie-only property.
  lineTieStyle?: LineTieStyle;
  // Ballast-only properties. Y rotation uses the shared `rotation.y`
  // field above (only meaningful for Box/Cylinder — a Sphere is
  // rotationally symmetric).
  shape?: BallastShape;
  diameterMm?: number;
  metal?: MetalType;
  holdingPocket?: boolean;
  ballastClearanceMm?: number;
  // Wire-frame-only properties. wireThicknessMm left unset by default so
  // existing/new wires keep falling back to the girth-scaled formula in
  // FeatureMarkers.tsx's WireFrameMarker — only set once the user actually
  // drags the slider.
  wireFrameStyle?: WireFrameStyle;
  wireThicknessMm?: number;
  // Fin-only properties.
  finOutline?: Point2D[];
  finThickness?: number;
  finMirror?: boolean;
  // Fase A — an uploaded reference photo (e.g. a real fin close-up) traced
  // over in FinOutlineEditor. Data-URL, same pattern as
  // useReferenceImageStore's body-photo upload. The rect lives in the same
  // local mm space as finOutline so a traced shape lines up 1:1 with it.
  finReferenceImage?: string;
  finReferenceImageRect?: { x: number; y: number; width: number; height: number };
  // Fase C — edge rounding (bevel) and hollow-shell wall thickness,
  // expressed as a percentage of finThickness (100% = solid).
  finEdgeRoundingMm?: number;
  finAreaThicknessPct?: number;
  // Fase D/E — how this fin combines with other fins at (roughly) the same
  // position (see utils/finGeometry.ts's groupFinClusters): 'add' (default)
  // renders/exports normally; 'cut' is subtracted from the 'add' fin(s) in
  // its cluster (real CSG boolean, not just visual overlap) instead of
  // rendering on its own; 'separatePart' additionally carves a matching
  // cavity into the main body and exports as its own STL/material.
  finOperation?: 'add' | 'cut' | 'separatePart';
  finPartMaterial?: BodyMaterial;
  finSlotClearanceMm?: number;
  // Decal-only properties.
  decalPattern?: DecalPattern;
  decalStyle?: DecalStyle;
  decalFill?: DecalFill;
  decalDepth?: number;
  decalMirror?: boolean;
  decalReadableBothSides?: boolean;
  // Scales-only properties. Coverage is a 0..100 percentage along the body
  // length, not a position — this feature doesn't use `position`.
  scalesCoverageStart?: number;
  scalesCoverageEnd?: number;
  scalesSize?: number;
  scalesDepth?: number;
  // Lip-only properties (diving lip/bill, for crankbaits & jerkbaits).
  // Angle is measured off the body's own axis: 0° lies flush forward
  // (in line with the nose), 90° points straight down — see lipEffects.ts
  // for how this drives the extra dive during Simulate's Reel in.
  lipAngleDeg?: number;
  lipWidthMm?: number;
  lipLengthMm?: number;
  lipShape?: LipShape;
  // Spinner-blade-only properties.
  bladeShape?: BladeShape;
  bladeSizeMm?: number;
  // Skirt-only properties (a bundle of trailing strands from `position`).
  skirtColor?: string;
  skirtLengthMm?: number;
  // Eyes-only properties. Each eye renders as an iris sphere (eyeColor)
  // plus a smaller pupil sphere (pupilColor) offset toward the outer
  // face — see FeatureMarkers.tsx's EyesMarker. eyeSizeMm overrides the
  // default girth-scaled iris diameter when set.
  eyeColor?: string;
  pupilColor?: string;
  eyeSizeMm?: number;
  // Hook-tie-only properties. hookSizeLabel is one of the labels from
  // utils/hookSizes.ts's TREBLE_HOOK_SIZES/SINGLE_HOOK_SIZES (whichever
  // table hookStyle selects) — kept as a label rather than raw mm so the
  // 3D geometry and the size-picker dropdown always read the exact same
  // spec off that one shared table. dressingColor only applies to
  // hookStyle === 'dressedTreble'.
  hookStyle?: HookStyle;
  hookSizeLabel?: string;
  hookFinish?: HookFinish;
  dressingColor?: string;
}

const FEATURE_LABELS: Record<FeatureType, string> = {
  eyes: 'Eyes',
  lineTie: 'Line tie',
  hookHanger: 'Hook hanger',
  ballast: 'Ballast',
  wireFrame: 'Wire frame',
  fin: 'Fin',
  decal: 'Decal',
  scales: 'Scales',
  lip: 'Lip',
  spinnerBlade: 'Spinner blade',
  skirt: 'Skirt',
  hookTie: 'Hook tie',
};

function defaultPosition(type: FeatureType, existing: Feature[]): Position3D {
  const { length, girth } = useProfileStore.getState();

  switch (type) {
    case 'eyes':
      return { x: length * 0.12, y: girth * 0.12, z: girth * 0.32 };
    case 'lineTie':
      return { x: 0, y: 0, z: 0 };
    case 'hookHanger': {
      const count = existing.filter((f) => f.type === 'hookHanger').length;
      const x = count === 0 ? length / 3 : count === 1 ? (length * 2) / 3 : length / 2;
      return { x, y: -girth * 0.3, z: 0 };
    }
    case 'ballast':
      return { x: length / 2, y: -girth * 0.15, z: 0 };
    case 'wireFrame':
      return { x: 0, y: 0, z: 0 };
    case 'fin':
      return { x: length * 0.55, y: girth * 0.45, z: 0 };
    case 'decal':
      return { x: length * 0.4, y: girth * 0.15, z: girth * 0.4 };
    case 'scales':
      return { x: 0, y: 0, z: 0 }; // unused — coverage is a length range, not a point
    case 'lip':
      return { x: 0, y: -girth * 0.25, z: 0 }; // mounts low on the nose, like a real bill
    case 'spinnerBlade':
      return { x: length * 0.85, y: girth * 0.6, z: 0 }; // trailing, above the body like a wire-arm blade
    case 'skirt':
      return { x: length * 0.95, y: 0, z: 0 }; // trails straight off the tail
    case 'hookTie': {
      // Same spacing logic as hookHanger above — a hook tie hangs at the
      // belly just like a hanger does, just with an actual hook modeled on
      // it instead of a bare eyelet.
      const count = existing.filter((f) => f.type === 'hookTie').length;
      const x = count === 0 ? length / 3 : count === 1 ? (length * 2) / 3 : length / 2;
      return { x, y: -girth * 0.3, z: 0 };
    }
  }
}

function nextName(type: FeatureType, existing: Feature[]): string {
  const count = existing.filter((f) => f.type === type).length;
  return count === 0 ? FEATURE_LABELS[type] : `${FEATURE_LABELS[type]} ${count + 1}`;
}

interface FeatureState {
  features: Feature[];
  selectedId: string | null;
  addFeature: (type: FeatureType) => void;
  removeFeature: (id: string) => void;
  toggleVisible: (id: string) => void;
  selectFeature: (id: string | null) => void;
  updatePosition: (id: string, position: Partial<Position3D>) => void;
  updateRotation: (id: string, rotation: Partial<Position3D>) => void;
  updateFeature: (id: string, patch: Partial<Omit<Feature, 'id' | 'position' | 'rotation'>>) => void;
  reorderFeature: (fromIndex: number, toIndex: number) => void;
  addFinPoint: (id: string, point: Point2D) => void;
  updateFinPoint: (id: string, index: number, point: Point2D) => void;
  deleteFinPoint: (id: string, index: number) => void;
}

export const useFeatureStore = create<FeatureState>((set, get) => ({
  features: [],
  selectedId: null,

  addFeature: (type) => {
    const features = get().features;
    const feature: Feature = {
      id: crypto.randomUUID(),
      type,
      name: nextName(type, features),
      visible: true,
      position: defaultPosition(type, features),
      ...(type === 'lineTie'
        ? { rotation: { x: 0, y: 0, z: 0 }, lineTieStyle: 'ring' as LineTieStyle }
        : {}),
      ...(type === 'ballast'
        ? {
            rotation: { x: 0, y: 0, z: 0 },
            shape: 'sphere' as BallastShape,
            diameterMm: 6,
            metal: 'lead' as MetalType,
            holdingPocket: false,
            ballastClearanceMm: 1.5,
          }
        : {}),
      ...(type === 'wireFrame' ? { wireFrameStyle: 'throughWire' as WireFrameStyle } : {}),
      ...(type === 'fin'
        ? {
            rotation: { x: 0, y: 0, z: 0 },
            finOutline: DEFAULT_FIN_OUTLINE.map((p) => ({ ...p })),
            finThickness: 1.5,
            finMirror: false,
            finEdgeRoundingMm: 0,
            finAreaThicknessPct: 100,
            finOperation: 'add' as const,
            finPartMaterial: 'pla' as BodyMaterial,
            finSlotClearanceMm: 0.1,
          }
        : {}),
      ...(type === 'decal'
        ? {
            decalPattern: 'star' as DecalPattern,
            decalStyle: 'flat' as DecalStyle,
            decalFill: 'rounded' as DecalFill,
            decalDepth: 1,
            decalMirror: false,
            decalReadableBothSides: false,
          }
        : {}),
      ...(type === 'scales'
        ? { scalesCoverageStart: 20, scalesCoverageEnd: 80, scalesSize: 6, scalesDepth: 0.5 }
        : {}),
      ...(type === 'lip'
        ? {
            rotation: { x: 0, y: 0, z: 0 },
            lipAngleDeg: 45,
            lipWidthMm: 14,
            lipLengthMm: 18,
            lipShape: 'round' as LipShape,
          }
        : {}),
      ...(type === 'spinnerBlade'
        ? { rotation: { x: 0, y: 0, z: 0 }, bladeShape: 'colorado' as BladeShape, bladeSizeMm: 16 }
        : {}),
      ...(type === 'skirt' ? { skirtColor: '#c8342f', skirtLengthMm: 40 } : {}),
      ...(type === 'eyes' ? { eyeColor: '#f5c518', pupilColor: '#111111' } : {}),
      ...(type === 'hookTie'
        ? {
            hookStyle: 'treble' as HookStyle,
            hookSizeLabel: '4',
            hookFinish: 'bronze' as HookFinish,
            dressingColor: '#c8342f',
          }
        : {}),
    };
    set({ features: [...features, feature], selectedId: feature.id });
  },

  removeFeature: (id) => {
    const selectedId = get().selectedId === id ? null : get().selectedId;
    set({ features: get().features.filter((f) => f.id !== id), selectedId });
  },

  toggleVisible: (id) => {
    set({
      features: get().features.map((f) => (f.id === id ? { ...f, visible: !f.visible } : f)),
    });
  },

  selectFeature: (id) => set({ selectedId: id }),

  updatePosition: (id, position) => {
    set({
      features: get().features.map((f) =>
        f.id === id ? { ...f, position: { ...f.position, ...position } } : f,
      ),
    });
  },

  updateRotation: (id, rotation) => {
    set({
      features: get().features.map((f) =>
        f.id === id
          ? { ...f, rotation: { ...(f.rotation ?? { x: 0, y: 0, z: 0 }), ...rotation } }
          : f,
      ),
    });
  },

  updateFeature: (id, patch) => {
    set({
      features: get().features.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    });
  },

  reorderFeature: (fromIndex, toIndex) => {
    const features = [...get().features];
    const [moved] = features.splice(fromIndex, 1);
    features.splice(toIndex, 0, moved);
    set({ features });
  },

  addFinPoint: (id, point) => {
    set({
      features: get().features.map((f) =>
        f.id === id ? { ...f, finOutline: [...(f.finOutline ?? []), point] } : f,
      ),
    });
  },

  updateFinPoint: (id, index, point) => {
    set({
      features: get().features.map((f) => {
        if (f.id !== id || !f.finOutline) return f;
        const finOutline = [...f.finOutline];
        finOutline[index] = point;
        return { ...f, finOutline };
      }),
    });
  },

  deleteFinPoint: (id, index) => {
    set({
      features: get().features.map((f) => {
        if (f.id !== id || !f.finOutline || f.finOutline.length <= 3) return f;
        return { ...f, finOutline: f.finOutline.filter((_, i) => i !== index) };
      }),
    });
  },
}));
