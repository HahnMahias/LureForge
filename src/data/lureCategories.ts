export type LureCategory =
  | 'Jig'
  | 'Spinnerbait'
  | 'Jerkbait'
  | 'Crankbait'
  | 'Swimbait'
  | 'Softbait'
  | 'Topwater'
  | 'Poppers'
  | 'Spoons';

export const LURE_CATEGORIES: LureCategory[] = [
  'Jig',
  'Spinnerbait',
  'Jerkbait',
  'Crankbait',
  'Swimbait',
  'Softbait',
  'Topwater',
  'Poppers',
  'Spoons',
];

// Category -> the closest matching data/lurePresets.ts id, so "Start blank
// in this category" seeds a reasonable starting shape instead of always
// falling back to the plain 'blank' preset. Categories with no close match
// (a genuinely different construction NewLureWizard's lofted-body presets
// don't model — a jointed spinner arm, a soft plastic, a flat spoon blank)
// are left unmapped and fall back to 'blank'.
export const LURE_CATEGORY_PRESET_ID: Partial<Record<LureCategory, string>> = {
  Jig: 'jig',
  Crankbait: 'crankbait',
  Jerkbait: 'jerkbait',
  Swimbait: 'swimbait',
  Topwater: 'topwaterWalker',
  Poppers: 'popper',
};

// One ready-made design within a category — reuses the exact same
// ProjectData shape saved library projects already use (projectStorage.ts),
// so loading one later can follow useLibraryStore's own applyProjectData
// pattern. Every list starts empty; this is the navigation, not the catalog
// content itself.
export interface PremadeLure {
  id: string;
  name: string;
  thumbnail?: string;
  data: import('../utils/projectStorage').ProjectData;
}

export const PREMADE_LURES: Record<LureCategory, PremadeLure[]> = {
  Jig: [],
  Spinnerbait: [],
  Jerkbait: [],
  Crankbait: [],
  Swimbait: [],
  Softbait: [],
  Topwater: [],
  Poppers: [],
  Spoons: [],
};
