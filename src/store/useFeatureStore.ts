import { create } from 'zustand';
import { useProfileStore } from './useProfileStore';
import type { BallastShape } from '../utils/meshVolume';
import type { MetalType } from '../utils/materials';
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
  | 'skirt';
export type LineTieStyle = 'ring' | 'staple' | 'screwEye';
export type LipShape = 'round' | 'square' | 'coffin';
export type BladeShape = 'colorado' | 'willow' | 'indiana';
export type DecalStyle = 'flat' | 'ramp';
export type DecalFill = 'rounded' | 'engraved';

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
  // Wire-frame-only property.
  wireFrameStyle?: WireFrameStyle;
  // Fin-only properties.
  finOutline?: Point2D[];
  finThickness?: number;
  finMirror?: boolean;
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
