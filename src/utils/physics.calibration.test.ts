/**
 * Calibration + regression suite for the Simulate tab's sink/float/pitch
 * motion model (utils/simulationPhysics.ts + utils/buoyancy.ts +
 * utils/physics.ts). This is a permanent check: if a future change to the
 * physics makes a lure behave unrealistically again, this file should catch
 * it.
 *
 * ---- Reference data (gathered 2026, see chat history for sourcing) ----
 *
 * Real fishing-tackle sink-rate data is mostly anecdotal ("time it with a
 * bucket and a stopwatch"), but one source publishes an actual measured
 * table for jig heads — small, dense, compact, low-drag objects, a good
 * stand-in for a solid lure with little surface-area-driven drag:
 *
 *   0.89 g (1/32 oz) -> ~0.90 ft/s -> ~27 cm/s -> 270 mm/s
 *   1.77 g (1/16 oz) -> ~2.0  ft/s -> ~61 cm/s -> 610 mm/s
 *   3.5  g (1/8 oz)  -> ~2.75 ft/s -> ~84 cm/s -> 840 mm/s
 *
 * This is NOT a straight line: real drag grows with speed, so terminal
 * velocity scales sub-linearly with net weight. A least-squares fit of
 * v = COEF * weight^EXPONENT through these three points (in log space)
 * gives EXPONENT ≈ 0.83, COEF ≈ 322.5 — see simulationPhysics.ts's
 * terminalSinkVelocityMmPerSec, which uses exactly this. Because the
 * reference data itself is noisy (shape, temperature, line drag all vary
 * between real measurements), calibration tests use a generous ±25%
 * tolerance per anchor point rather than chasing an exact match — the
 * point is the right ballpark and the right curve *shape*, not a perfect
 * fit.
 *
 * Material densities (g/cm³), used for Solid/Hollow body material:
 *   Balsa wood      0.13   (range found: 0.10-0.16)
 *   ABS plastic     1.05   (range found: 1.04-1.06)
 *   Polycarbonate   1.20   (range found: 1.19-1.22)
 *   PVC (rigid)     1.39   (range found: 1.38-1.40)
 *   PLA (existing)  1.24
 *   Fresh / salt water: 1.00 / 1.025 (existing, unchanged)
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { buildLureGeometry, type LureCurves } from './generateLureMesh';
import { computeMeshVolumeAndCentroid } from './meshVolume';
import { computeVolumeCorrection, type BuoyancyPart } from './buoyancy';
import {
  terminalSinkVelocityMmPerSec,
  simulateFallStep,
  type SimBodyState,
  type SimPhysicsInputs,
} from './simulationPhysics';
import {
  computeTotalWeightG,
  computeCenterOfGravity,
  computeFillAwareVolumeMm3,
  classifyFloat,
  WATER_DENSITY_G_CM3,
} from './physics';
import { BODY_MATERIAL_DENSITY_G_CM3, type BodyMaterial } from './materials';
import type { Feature } from '../store/useFeatureStore';
import type { Point2D } from './smoothPath';

// --- Test-body construction helpers -----------------------------------
// A simple rounded, roughly-elliptical profile parametrized by length/girth
// — not any particular real lure, just enough geometry for buildLureGeometry
// to loft a body whose real volume/shape drives the calibration checks.

function buildTestCurves(length: number, girth: number): LureCurves {
  const half = girth / 2;
  const lengthwise: Point2D[] = [
    { x: 0, y: half * 0.1 },
    { x: length * 0.3, y: half * 0.9 },
    { x: length * 0.5, y: half },
    { x: length * 0.7, y: half * 0.9 },
    { x: length, y: half * 0.1 },
  ];
  const cross: Point2D[] = [
    { x: 0, y: half * 0.1 },
    { x: girth * 0.2, y: half * 0.85 },
    { x: girth * 0.5, y: half },
    { x: girth * 0.8, y: half * 0.85 },
    { x: girth, y: half * 0.1 },
  ];
  return { side: lengthwise, sideMirror: lengthwise, top: lengthwise, topMirror: lengthwise, front: cross, frontMirror: cross };
}

interface TestBody {
  geometry: THREE.BufferGeometry;
  outerVolumeMm3: number;
  centroid: THREE.Vector3;
  offset: { x: number; y: number };
  bodyPart: BuoyancyPart;
}

function buildTestBody(length: number, girth: number): TestBody {
  const curves = buildTestCurves(length, girth);
  const { geometry, offset } = buildLureGeometry(curves, length, girth, 'rounded', true);
  const { volumeMm3: outerVolumeMm3, centroid } = computeMeshVolumeAndCentroid(geometry);
  const partBase = { ...curves, length, symmetric: true, groupX: 0 };
  const volumeCorrection = computeVolumeCorrection(partBase, outerVolumeMm3);
  return { geometry, outerVolumeMm3, centroid, offset, bodyPart: { ...partBase, volumeCorrection } };
}

// Runs the real per-frame integration until it settles, starting deep
// underwater (so submerged volume ~= outer volume from frame one, matching
// how a jig head reaches terminal velocity almost immediately after entry).
function runToSteadyState(inputs: SimPhysicsInputs, steps = 300, dt = 1 / 60): SimBodyState {
  let state: SimBodyState = { positionY: inputs.waterSurfaceY / 2, velocityY: 0, pitch: 0, angularVelocity: 0 };
  for (let i = 0; i < steps; i++) state = simulateFallStep(state, inputs, dt);
  return state;
}

// --- (a) Calibration: analytic + integrated sink speed vs reference ----

describe('calibration: sink speed vs measured jig data', () => {
  const body = buildTestBody(12, 10); // small, compact, low length-to-width ratio
  const waterSurfaceY = 10000; // arbitrarily far away so the body stays fully submerged throughout

  const referenceCases = [
    { weightG: 0.89, expectedMmPerS: 270 },
    { weightG: 1.77, expectedMmPerS: 610 },
    { weightG: 3.5, expectedMmPerS: 840 },
  ];

  for (const { weightG, expectedMmPerS } of referenceCases) {
    it(`${weightG} g net-negative settles near ${expectedMmPerS} mm/s (±25%), analytically and via simulation`, () => {
      // The reference data is for jig heads — essentially solid lead, whose
      // own displaced-water weight is negligible next to their weight (lead
      // is 11x denser than water). To keep the test's *net* buoyancy
      // imbalance exactly matching the reference number regardless of this
      // synthetic test body's own (much less dense) volume, total weight is
      // set to fully offset the body's own buoyancy plus the target
      // imbalance — so netBuoyancyG below comes out to exactly -weightG.
      const displacedWeightG = (body.outerVolumeMm3 / 1000) * WATER_DENSITY_G_CM3.fresh;
      const totalWeightG = displacedWeightG + weightG;
      const netBuoyancyG = displacedWeightG - totalWeightG; // === -weightG

      const analytic = Math.abs(terminalSinkVelocityMmPerSec(netBuoyancyG));
      expect(analytic).toBeGreaterThan(expectedMmPerS * 0.75);
      expect(analytic).toBeLessThan(expectedMmPerS * 1.25);

      const inputs: SimPhysicsInputs = {
        bodyParts: [body.bodyPart],
        centerlineY: body.offset.y,
        waterSurfaceY,
        totalWeightG,
        cogX: body.centroid.x,
        cogY: body.centroid.y,
        waterDensityGCm3: WATER_DENSITY_G_CM3.fresh,
      };
      const settled = runToSteadyState(inputs);
      const integrated = Math.abs(settled.velocityY);
      expect(integrated).toBeGreaterThan(expectedMmPerS * 0.75);
      expect(integrated).toBeLessThan(expectedMmPerS * 1.25);
    });
  }
});

// --- (b) Relative ordering: heavier sinks faster, but sub-linearly ------

describe('calibration: weight-to-speed scaling is sub-linear', () => {
  it('doubling excess weight increases speed by less than double, at every step', () => {
    const vLight = Math.abs(terminalSinkVelocityMmPerSec(-1));
    const vMedium = Math.abs(terminalSinkVelocityMmPerSec(-2));
    const vHeavy = Math.abs(terminalSinkVelocityMmPerSec(-4));

    expect(vMedium).toBeGreaterThan(vLight);
    expect(vHeavy).toBeGreaterThan(vMedium);
    expect(vMedium / vLight).toBeLessThan(2);
    expect(vHeavy / vMedium).toBeLessThan(2);
  });

  it('near-zero net buoyancy drifts, it does not fall at some fixed "medium" speed', () => {
    const vNearZero = Math.abs(terminalSinkVelocityMmPerSec(-0.01));
    const vModerate = Math.abs(terminalSinkVelocityMmPerSec(-2));
    expect(vNearZero).toBeLessThan(vModerate * 0.05);
  });

  it('stays within a plausible speed envelope for typical (tens-of-grams) DIY lure imbalances', () => {
    // The 0.89-3.5g reference anchors don't cover this range — extrapolating
    // their power law unmodified runs away to multi-metre-per-second speeds
    // (uncapped: ~3.9 m/s at 20g, ~8.3 m/s at 50g) that no real lure
    // reaches in still water. The cap (see simulationPhysics.ts) sits well
    // above the highest calibration anchor (840 mm/s at 3.5g) so it never
    // touches the calibrated range itself — confirmed by the calibration
    // cases above all passing without hitting this ceiling.
    const v20g = Math.abs(terminalSinkVelocityMmPerSec(-20));
    const v50g = Math.abs(terminalSinkVelocityMmPerSec(-50));
    expect(v20g).toBeLessThan(1500);
    expect(v50g).toBeLessThan(1500);
    // Still monotonically at least as fast, never discontinuous downward.
    expect(v50g).toBeGreaterThanOrEqual(v20g);
  });
});

// --- (c) Solid vs Hollow, for a material denser than water --------------

describe('calibration: Solid sinks, Hollow (thin wall, no ballast) floats', () => {
  const length = 80;
  const girth = 24;
  const curves = buildTestCurves(length, girth);
  const { geometry } = buildLureGeometry(curves, length, girth, 'rounded', true);
  const { volumeMm3: outerVolumeMm3 } = computeMeshVolumeAndCentroid(geometry);
  const densityGCm3 = BODY_MATERIAL_DENSITY_G_CM3.pvc; // denser than water

  it('Solid PVC body sinks', () => {
    const weightG = (outerVolumeMm3 / 1000) * densityGCm3;
    expect(classifyFloat(weightG, outerVolumeMm3, 'fresh')).toBe('sinks');
  });

  it('Hollow PVC body with a thin wall floats', () => {
    const wallThicknessMm = 1.2;
    const materialVolumeMm3 = computeFillAwareVolumeMm3(geometry, outerVolumeMm3, 'hollow', wallThicknessMm);
    const weightG = (materialVolumeMm3 / 1000) * densityGCm3;
    expect(materialVolumeMm3).toBeLessThan(outerVolumeMm3);
    expect(classifyFloat(weightG, outerVolumeMm3, 'fresh')).toBe('floats');
  });
});

// --- (d) Material sweep: Solid, no ballast -------------------------------

describe('calibration: material density sweep (Solid, no ballast)', () => {
  const length = 80;
  const girth = 24;
  const curves = buildTestCurves(length, girth);
  const { geometry } = buildLureGeometry(curves, length, girth, 'rounded', true);
  const { volumeMm3: outerVolumeMm3 } = computeMeshVolumeAndCentroid(geometry);

  const expected: Record<BodyMaterial, 'floats' | 'sinks'> = {
    balsa: 'floats',
    abs: 'sinks',
    polycarbonate: 'sinks',
    pvc: 'sinks',
    pla: 'sinks',
  };

  for (const material of Object.keys(expected) as BodyMaterial[]) {
    const densityGCm3 = BODY_MATERIAL_DENSITY_G_CM3[material];
    it(`${material} (${densityGCm3} g/cm³) -> ${expected[material]}`, () => {
      const weightG = (outerVolumeMm3 / 1000) * densityGCm3;
      expect(classifyFloat(weightG, outerVolumeMm3, 'fresh')).toBe(expected[material]);
    });
  }
});

// --- (e) Ballast position drives pitch direction -------------------------

describe('calibration: ballast position -> pitch direction', () => {
  const length = 100;
  const girth = 26;
  const body = buildTestBody(length, girth);
  const bodyWeightG = (body.outerVolumeMm3 / 1000) * BODY_MATERIAL_DENSITY_G_CM3.pla;

  function ballastFeature(designX: number): Feature {
    return {
      id: 'test-ballast',
      type: 'ballast',
      name: 'Ballast',
      visible: true,
      position: { x: designX, y: -girth * 0.15, z: 0 },
      shape: 'sphere',
      diameterMm: 10,
      metal: 'lead',
    };
  }

  function settledPitchRad(designX: number): number {
    const feature = ballastFeature(designX);
    const cog = computeCenterOfGravity(bodyWeightG, body.centroid, body.offset, [feature]);
    const totalWeightG = computeTotalWeightG(bodyWeightG, [feature]);
    const inputs: SimPhysicsInputs = {
      bodyParts: [body.bodyPart],
      centerlineY: body.offset.y,
      waterSurfaceY: 10000,
      totalWeightG,
      cogX: cog.x,
      cogY: cog.y,
      waterDensityGCm3: WATER_DENSITY_G_CM3.fresh,
    };
    return runToSteadyState(inputs).pitch;
  }

  const threeDeg = THREE.MathUtils.degToRad(3);

  it('forward ballast settles nose-down (positive pitch)', () => {
    expect(settledPitchRad(length * 0.15)).toBeGreaterThan(threeDeg);
  });

  it('centered ballast settles roughly level', () => {
    expect(Math.abs(settledPitchRad(length * 0.5))).toBeLessThan(threeDeg);
  });

  it('aft ballast settles tail-down (negative pitch)', () => {
    expect(settledPitchRad(length * 0.85)).toBeLessThan(-threeDeg);
  });
});

// --- (f) Water type: salt sinks measurably slower than fresh -------------

describe('calibration: salt water sinks slower than fresh, same lure', () => {
  it('identical lure sinks slower in salt than fresh', () => {
    const body = buildTestBody(15, 12);
    const dispFreshG = (body.outerVolumeMm3 / 1000) * WATER_DENSITY_G_CM3.fresh;
    const dispSaltG = (body.outerVolumeMm3 / 1000) * WATER_DENSITY_G_CM3.salt;
    // Comfortably negative buoyancy in fresh water, so it's still negative
    // (just less so) in the denser salt water too.
    const weightG = dispFreshG + 2;

    const vFresh = Math.abs(terminalSinkVelocityMmPerSec(dispFreshG - weightG));
    const vSalt = Math.abs(terminalSinkVelocityMmPerSec(dispSaltG - weightG));
    expect(vSalt).toBeLessThan(vFresh);
  });
});
