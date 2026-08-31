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
  // A separate option from printInTwoHalves — exports only the right half,
  // meant to be printed twice and glued (one copy flipped 180°) rather than
  // printed once as two distinct left/right files. Only exactly matches a
  // top/bottom-symmetric design; see ExportPanel.tsx's own warning text.
  // Mutually exclusive with printInTwoHalves in the UI (see ExportPanel.tsx).
  printHalfTwice: boolean;
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
  setPrintHalfTwice: (v: boolean) => void;
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
  printHalfTwice: false,
  nozzleWidthMm: 0.42,
  layerHeightMm: 0.2,
  printSpeedMms: 60,
  supports: false,
  clearCoat: 'none',
  setManufacturing: (m) => set({ manufacturing: m }),
  setMaterial: (m) => set({ material: m }),
  setPerimeterWalls: (n) => set({ perimeterWalls: n }),
  setInfill: (n) => set({ infill: n }),
  // Mutually exclusive: turning one on turns the other off; turning one off
  // just turns it off (leaves the other alone).
  setPrintInTwoHalves: (v) => set(v ? { printInTwoHalves: true, printHalfTwice: false } : { printInTwoHalves: false }),
  setPrintHalfTwice: (v) => set(v ? { printHalfTwice: true, printInTwoHalves: false } : { printHalfTwice: false }),
  setNozzleWidthMm: (n) => set({ nozzleWidthMm: n }),
  setLayerHeightMm: (n) => set({ layerHeightMm: n }),
  setPrintSpeedMms: (n) => set({ printSpeedMms: n }),
  setSupports: (v) => set({ supports: v }),
  setClearCoat: (c) => set({ clearCoat: c }),
}));
