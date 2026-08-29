export type MetalType = 'lead' | 'tungsten' | 'steel';

export const METAL_DENSITY_G_CM3: Record<MetalType, number> = {
  lead: 11.34,
  tungsten: 19.25,
  steel: 7.85,
};

// Selectable body materials. Densities are midpoints of commonly-cited
// ranges for each material (see physics.calibration.test.ts's header
// comment for the full reference-data writeup).
export type BodyMaterial = 'pla' | 'balsa' | 'abs' | 'polycarbonate' | 'pvc';

export const BODY_MATERIAL_DENSITY_G_CM3: Record<BodyMaterial, number> = {
  pla: 1.24,
  balsa: 0.13,
  abs: 1.05,
  polycarbonate: 1.2,
  pvc: 1.39,
};

export const BODY_MATERIAL_LABELS: Record<BodyMaterial, string> = {
  pla: 'PLA',
  balsa: 'Balsa',
  abs: 'ABS',
  polycarbonate: 'Polycarbonate',
  pvc: 'PVC',
};
