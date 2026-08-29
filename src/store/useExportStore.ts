import { create } from 'zustand';

export type Manufacturing = 'fdm' | 'resin';
export type PrintMaterial = 'pla';
export type ClearCoat = 'none' | '1coat' | '2coat';

interface ExportState {
  manufacturing: Manufacturing;
  material: PrintMaterial;
  perimeterWalls: number; // wall loop count
  infill: number; // percent, 0-100
  printInTwoHalves: boolean;
  // Advanced settings. Nozzle width drives the existing wall-thickness math
  // (perimeterWalls * nozzleWidthMm); layer height, print speed, and
  // supports are informational slicer hints only, not used in any
  // geometry/weight calculation here.
  nozzleWidthMm: number;
  layerHeightMm: number;
  printSpeedMms: number;
  supports: boolean;
  // Finish (post-processing). Informational only — not factored into the
  // weight/buoyancy estimate, same documented limitation as Decals/Scales.
  clearCoat: ClearCoat;
  setManufacturing: (m: Manufacturing) => void;
  setMaterial: (m: PrintMaterial) => void;
  setPerimeterWalls: (n: number) => void;
  setInfill: (n: number) => void;
  setPrintInTwoHalves: (v: boolean) => void;
  setNozzleWidthMm: (n: number) => void;
  setLayerHeightMm: (n: number) => void;
  setPrintSpeedMms: (n: number) => void;
  setSupports: (v: boolean) => void;
  setClearCoat: (c: ClearCoat) => void;
}

export const useExportStore = create<ExportState>((set) => ({
  manufacturing: 'fdm',
  material: 'pla',
  perimeterWalls: 3,
  infill: 20,
  printInTwoHalves: false,
  nozzleWidthMm: 0.42,
  layerHeightMm: 0.2,
  printSpeedMms: 60,
  supports: false,
  clearCoat: 'none',
  setManufacturing: (m) => set({ manufacturing: m }),
  setMaterial: (m) => set({ material: m }),
  setPerimeterWalls: (n) => set({ perimeterWalls: n }),
  setInfill: (n) => set({ infill: n }),
  setPrintInTwoHalves: (v) => set({ printInTwoHalves: v }),
  setNozzleWidthMm: (n) => set({ nozzleWidthMm: n }),
  setLayerHeightMm: (n) => set({ layerHeightMm: n }),
  setPrintSpeedMms: (n) => set({ printSpeedMms: n }),
  setSupports: (v) => set({ supports: v }),
  setClearCoat: (c) => set({ clearCoat: c }),
}));
