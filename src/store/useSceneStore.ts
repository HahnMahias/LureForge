import { create } from 'zustand';
import type { BuoyancyPart } from '../utils/buoyancy';

interface Dimensions {
  l: number;
  w: number;
  h: number;
}

interface BodyOffset {
  x: number;
  y: number;
}

interface Point3D {
  x: number;
  y: number;
  z: number;
}

interface SceneState {
  dimensions: Dimensions;
  bodyOffset: BodyOffset;
  // Outer hull volume — always the full lofted shape regardless of Fill, since
  // this is what displaces water for buoyancy purposes.
  bodyVolumeMm3: number;
  // Total body weight in grams — fill- and material-aware (see
  // physics.ts's computeBodyWeightG), summed across every lofted piece.
  // This is what the body's own weight should be read from everywhere.
  bodyWeightG: number;
  bodyCentroid: Point3D;
  // One entry per lofted piece (main body + any extra jointed segments),
  // in the same shared frame as bodyCentroid — used by Simulate's buoyancy
  // integration (see utils/buoyancy.ts) to estimate submerged volume
  // without re-deriving the segment-placement math LureBody.tsx already did.
  bodyParts: BuoyancyPart[];
  setDimensions: (d: Dimensions) => void;
  setBodyOffset: (o: BodyOffset) => void;
  setBodyVolumeMm3: (v: number) => void;
  setBodyWeightG: (v: number) => void;
  setBodyCentroid: (c: Point3D) => void;
  setBodyParts: (p: BuoyancyPart[]) => void;
}

export const useSceneStore = create<SceneState>((set) => ({
  dimensions: { l: 0, w: 0, h: 0 },
  bodyOffset: { x: 0, y: 0 },
  bodyVolumeMm3: 0,
  bodyWeightG: 0,
  bodyCentroid: { x: 0, y: 0, z: 0 },
  bodyParts: [],
  setDimensions: (d) => set({ dimensions: d }),
  setBodyOffset: (o) => set({ bodyOffset: o }),
  setBodyVolumeMm3: (v) => set({ bodyVolumeMm3: v }),
  setBodyWeightG: (v) => set({ bodyWeightG: v }),
  setBodyCentroid: (c) => set({ bodyCentroid: c }),
  setBodyParts: (p) => set({ bodyParts: p }),
}));
