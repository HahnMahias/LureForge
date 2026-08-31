export type LureCategory =
  | 'Jig'
  | 'Spinnerbait'
  | 'Jerkbait'
  | 'Crankbait'
  | 'Swimbait'
  | 'Softbait'
  | 'Topwater'
  | 'Poppers'
  | 'Spoons'
  | 'Fly';

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
  'Fly',
];

// Category -> the matching data/lurePresets.ts id, so "Start blank in this
// category" seeds a reasonable starting shape instead of always falling
// back to the plain 'blank' preset. Every category now has a same-named
// preset (data/lurePresets.ts's 10-type research pass), so this is a
// straight 1:1 mapping — no fallback-to-blank exceptions left.
export const LURE_CATEGORY_PRESET_ID: Partial<Record<LureCategory, string>> = {
  Jig: 'jig',
  Spinnerbait: 'spinnerbait',
  Jerkbait: 'jerkbait',
  Crankbait: 'crankbait',
  Swimbait: 'swimbait',
  Softbait: 'softbait',
  Topwater: 'topwater',
  Poppers: 'poppers',
  Spoons: 'spoons',
  Fly: 'fly',
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
  Fly: [],
};
