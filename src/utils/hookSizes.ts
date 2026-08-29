import type { HookFinish, HookStyle } from '../store/useFeatureStore';

export interface HookSizeSpec {
  label: string;
  lengthMm: number;
  gapMm: number;
}

// Treble hook (drilling) size chart — length/gap in mm, largest to smallest.
// Sourced from published treble hook size/dimension charts (see the "Hook
// tie" feature brief this was built from) — visually representative for a
// 3D preview, not guaranteed to match any one manufacturer's exact spec.
export const TREBLE_HOOK_SIZES: HookSizeSpec[] = [
  { label: '1/0', lengthMm: 31.8, gapMm: 12.7 },
  { label: '1', lengthMm: 30.5, gapMm: 11.4 },
  { label: '2', lengthMm: 24.1, gapMm: 10.9 },
  { label: '4', lengthMm: 22.1, gapMm: 8.9 },
  { label: '6', lengthMm: 18.0, gapMm: 8.1 },
  { label: '8', lengthMm: 15.0, gapMm: 5.1 },
  { label: '10', lengthMm: 14.0, gapMm: 5.1 },
  { label: '12', lengthMm: 12.7, gapMm: 3.8 },
  { label: '14', lengthMm: 11.4, gapMm: 3.8 },
];

// Single hooks (siwash/open-eye style) — only gap width is consistently
// documented across sources; shaft length is approximated as ~2.35x the gap
// width (a common ratio for this hook type, per the brief this was built
// from), not a guaranteed exact factory measurement.
const SINGLE_SHAFT_TO_GAP_RATIO = 2.35;
const SINGLE_HOOK_GAPS: { label: string; gapMm: number }[] = [
  { label: '6', gapMm: 4.8 },
  { label: '4', gapMm: 6.4 },
  { label: '2', gapMm: 7.9 },
  { label: '1', gapMm: 9.5 },
  { label: '1/0', gapMm: 11.1 },
  { label: '2/0', gapMm: 12.7 },
  { label: '3/0', gapMm: 14.3 },
  { label: '4/0', gapMm: 15.9 },
  { label: '5/0', gapMm: 17.5 },
  { label: '6/0', gapMm: 19.1 },
];
export const SINGLE_HOOK_SIZES: HookSizeSpec[] = SINGLE_HOOK_GAPS.map((s) => ({
  ...s,
  lengthMm: s.gapMm * SINGLE_SHAFT_TO_GAP_RATIO,
}));

/** Dressed treble uses the same treble size table — dressing is an addition on top, not a different hook. */
export function hookSizesForStyle(style: HookStyle): HookSizeSpec[] {
  return style === 'single' ? SINGLE_HOOK_SIZES : TREBLE_HOOK_SIZES;
}

// Shared by FeatureMarkers.tsx's 3D rendering and RightSidebar.tsx's finish
// swatches, so both always agree on what each finish actually looks like.
export const HOOK_FINISH_COLOR: Record<HookFinish, string> = {
  bronze: '#8a5a2e',
  blackNickel: '#1c1c1e',
  nickel: '#c9ccd1',
  red: '#b0202a',
};
