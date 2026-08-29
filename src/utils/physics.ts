import * as THREE from 'three';
import type { Feature } from '../store/useFeatureStore';
import { computeBallastVolumeMm3 } from './meshVolume';
import { computeMeshVolumeAndCentroid } from './meshVolume';
import { hollowGeometry } from './meshShell';
import { METAL_DENSITY_G_CM3 } from './materials';
import type { FillType } from '../store/useProfileStore';

export interface BodyOffset {
  x: number;
  y: number;
}

// Converts a feature's design-space position (x: 0=nose..length=tail,
// y: 0=centerline) into the same mesh-local frame the body's own geometry
// occupies (see generateLureMesh.ts's translate) — the frame bodyCentroid,
// BuoyancyPart.groupX, and the Simulate rig's rotation pivot all share.
export function toWorld(pos: { x: number; y: number; z: number }, offset: BodyOffset): THREE.Vector3 {
  return new THREE.Vector3(pos.x - offset.x, pos.y + offset.y, pos.z);
}

function ballastMassG(f: Feature): number {
  const volumeMm3 = computeBallastVolumeMm3(f.shape ?? 'sphere', f.diameterMm ?? 6);
  const density = METAL_DENSITY_G_CM3[f.metal ?? 'lead'];
  return (volumeMm3 / 1000) * density;
}

/**
 * Material volume for live weight: the outer volume for Solid, or the
 * hollowed shell's volume for Hollow (reusing the same shelling logic as
 * STL export). The outer volume it's derived from is passed in already
 * computed, so a Solid part costs nothing extra here.
 */
export function computeFillAwareVolumeMm3(
  outerGeometry: THREE.BufferGeometry,
  outerVolumeMm3: number,
  fill: FillType,
  wallThicknessMm: number,
): number {
  if (fill === 'hollow' && wallThicknessMm > 0) {
    const shell = hollowGeometry(outerGeometry, wallThicknessMm);
    return computeMeshVolumeAndCentroid(shell).volumeMm3;
  }
  return outerVolumeMm3;
}

export interface BodyMassPart {
  materialVolumeMm3: number;
  densityGCm3: number;
}

/**
 * Total body weight across every lofted piece (main body + any extra
 * jointed segments), each with its own fill-aware material volume and its
 * own selected material density — so a Balsa segment and a PVC segment on
 * the same jointed lure are weighed correctly, not averaged into one
 * assumed density.
 */
export function computeBodyWeightG(parts: BodyMassPart[]): number {
  return parts.reduce((sum, p) => sum + (p.materialVolumeMm3 / 1000) * p.densityGCm3, 0);
}

/**
 * bodyWeightG is the body's own weight (all lofted pieces, fill- and
 * material-aware — see computeBodyWeightG), separate from any ballast,
 * which this adds in.
 */
export function computeTotalWeightG(bodyWeightG: number, features: Feature[]): number {
  const ballastWeightG = features
    .filter((f) => f.type === 'ballast')
    .reduce((sum, f) => sum + ballastMassG(f), 0);
  return bodyWeightG + ballastWeightG;
}

/**
 * Center of gravity: the mass-weighted average of the body's own volume
 * centroid and each ballast piece's position (ballast pieces are small
 * symmetric primitives, so their own centroid is just their placed
 * position). bodyCentroid is the outer hull's geometric centroid even when
 * the body is Hollow — using the shell's own (slightly different) centroid
 * would be more precise, but the outer centroid is a close approximation
 * for the wall thicknesses this tool deals with, and keeps this in sync
 * with the "Center of buoyancy" marker, which must use the outer shape.
 */
export function computeCenterOfGravity(
  bodyWeightG: number,
  bodyCentroid: THREE.Vector3,
  offset: BodyOffset,
  features: Feature[],
): THREE.Vector3 {
  const weighted = bodyCentroid.clone().multiplyScalar(bodyWeightG);
  let totalMassG = bodyWeightG;

  for (const f of features) {
    if (f.type !== 'ballast') continue;
    const massG = ballastMassG(f);
    weighted.addScaledVector(toWorld(f.position, offset), massG);
    totalMassG += massG;
  }

  return totalMassG > 0 ? weighted.divideScalar(totalMassG) : bodyCentroid.clone();
}

export type FloatClass = 'floats' | 'suspends' | 'sinks';
export type WaterType = 'fresh' | 'salt';

export const WATER_DENSITY_G_CM3: Record<WaterType, number> = {
  fresh: 1.0,
  salt: 1.025,
};

const SUSPEND_TOLERANCE = 0.02;

export function classifyFloat(
  totalWeightG: number,
  bodyVolumeMm3: number,
  water: WaterType = 'fresh',
): FloatClass {
  const displacedWeightG = (bodyVolumeMm3 / 1000) * WATER_DENSITY_G_CM3[water];
  if (displacedWeightG <= 0) return 'sinks';
  const relDiff = (totalWeightG - displacedWeightG) / displacedWeightG;
  if (relDiff > SUSPEND_TOLERANCE) return 'sinks';
  if (relDiff < -SUSPEND_TOLERANCE) return 'floats';
  return 'suspends';
}
