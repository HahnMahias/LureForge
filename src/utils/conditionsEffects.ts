import * as THREE from 'three';
import type { LightLevel, CurrentLevel } from '../store/useConditionsStore';

/**
 * Fase E's Conditions panel — pure mappings from the three condition
 * levels to the effects they actually drive, kept separate from the
 * calibrated sink/float physics in simulationPhysics.ts (which this never
 * touches) and testable without React/Three.
 *
 * Wind is deliberately absent here: physically, wind acts on the water's
 * surface, not on a lure already submerged in a closed simulation tank —
 * including it in the physics would be modeling something that doesn't
 * apply to this scene. It stays in the Conditions panel purely for visual
 * consistency with the reference design (a future surface-ripple effect
 * could reasonably hook into it), but on purpose has zero effect on
 * anything computed here or in the physics loop.
 */

/** Scene brightness (0..1) UnderwaterEnvironment's gradient/fog use. */
export function lightBrightness(light: LightLevel): number {
  if (light === 'low') return 0.35;
  if (light === 'bright') return 0.95;
  return 0.65;
}

/** The status card's Visibility readout (meters) — less light reaches deeper, murkier water. */
export function visibilityForLight(light: LightLevel): number {
  if (light === 'low') return 1.8;
  if (light === 'bright') return 5.5;
  return 3.4;
}

const CURRENT_BASE_MM_S: Record<CurrentLevel, number> = { calm: 0, moderate: 12, strong: 28 };

/**
 * A small constant horizontal drift (mm/s) applied on top of the passive
 * sink/float simulation — never the calibrated sink-rate model itself.
 * Lighter lures drift more than heavy/dense ones, same as a real light lure
 * getting pushed around by current more than a dense jig would; the
 * weightFactor is clamped so this stays a subtle nudge, never a dominant
 * force, at any weight.
 */
export function currentDriftMmPerS(current: CurrentLevel, totalWeightG: number): number {
  const base = CURRENT_BASE_MM_S[current];
  if (base === 0) return 0;
  const weightFactor = THREE.MathUtils.clamp(15 / Math.max(totalWeightG, 1), 0.15, 3);
  return base * weightFactor;
}
