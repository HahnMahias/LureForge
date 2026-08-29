/**
 * Unit coverage for Fase C's precomputed trajectory recording — the piece
 * the redesign brief flags as needing the most care, since the playable
 * timeline scrubs through this array instead of driving live physics.
 */
import { describe, it, expect } from 'vitest';
import { computeTrajectory, sampleTrajectory, trajectoryYRange, type TrajectoryFrame } from './simulateTrajectory';
import type { SimPhysicsInputs } from './simulationPhysics';

// A minimal body: a single small buoyant part with no offset — enough to
// drive simulateFallStep without needing a real lofted mesh (same synthetic
// approach physics.calibration.test.ts uses for its own anchor-point cases).
function makeInputs(totalWeightG: number): SimPhysicsInputs {
  return {
    bodyParts: [],
    centerlineY: 0,
    waterSurfaceY: 255,
    totalWeightG,
    cogX: 0,
    cogY: 0,
    waterDensityGCm3: 1,
  };
}

describe('computeTrajectory', () => {
  it('produces frames spanning the full requested duration at the given dt', () => {
    const frames = computeTrajectory(makeInputs(10), 255, 2, 0.1);
    expect(frames[0].t).toBe(0);
    expect(frames[frames.length - 1].t).toBeGreaterThanOrEqual(2);
    // ~21 frames for a 2s/0.1s window (0, 0.1, ..., 2.0)
    expect(frames.length).toBeGreaterThanOrEqual(20);
  });

  it('a heavy body (no buoyant parts) sinks — positionY decreases over the recording', () => {
    const frames = computeTrajectory(makeInputs(20), 255, 3, 0.05);
    const first = frames[0].positionY;
    const last = frames[frames.length - 1].positionY;
    expect(last).toBeLessThan(first);
  });

  it('degenerates to a single frame for a non-positive duration instead of throwing', () => {
    const frames = computeTrajectory(makeInputs(10), 255, 0, 0.1);
    expect(frames.length).toBe(1);
    expect(frames[0].positionY).toBe(255);
  });
});

describe('sampleTrajectory', () => {
  const frames: TrajectoryFrame[] = [
    { t: 0, positionY: 100, pitch: 0 },
    { t: 1, positionY: 80, pitch: 0.1 },
    { t: 2, positionY: 50, pitch: 0.3 },
  ];

  it('returns the exact frame when t lands on a recorded timestamp', () => {
    expect(sampleTrajectory(frames, 1).positionY).toBe(80);
  });

  it('linearly interpolates between the two bracketing frames', () => {
    const mid = sampleTrajectory(frames, 0.5);
    expect(mid.positionY).toBeCloseTo(90, 5); // halfway between 100 and 80
    expect(mid.pitch).toBeCloseTo(0.05, 5);
  });

  it('clamps to the first frame before the recording starts', () => {
    expect(sampleTrajectory(frames, -5).positionY).toBe(100);
  });

  it('clamps to the last frame after the recording ends', () => {
    expect(sampleTrajectory(frames, 50).positionY).toBe(50);
  });

  it('handles an empty array without throwing', () => {
    expect(() => sampleTrajectory([], 1)).not.toThrow();
  });
});

describe('trajectoryYRange', () => {
  it('finds the min/max positionY across the recording', () => {
    const frames: TrajectoryFrame[] = [
      { t: 0, positionY: 200, pitch: 0 },
      { t: 1, positionY: 50, pitch: 0 },
      { t: 2, positionY: 120, pitch: 0 },
    ];
    expect(trajectoryYRange(frames)).toEqual({ min: 50, max: 200 });
  });

  it('returns {0,0} for an empty recording instead of Infinity/-Infinity', () => {
    expect(trajectoryYRange([])).toEqual({ min: 0, max: 0 });
  });
});
