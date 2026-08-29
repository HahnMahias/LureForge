import { simulateFallStep, type SimBodyState, type SimPhysicsInputs } from './simulationPhysics';

/**
 * Precomputes a fixed-length recording of the Simulate tab's passive
 * sink/float/pitch behavior (Fase C of the visual redesign) — the same
 * calibrated `simulateFallStep` the live view already uses, just called
 * repeatedly ahead of time with a fixed dt instead of once per rendered
 * frame. A pure function (no React/Three renderer), so the whole timeline
 * feature can be unit-tested directly — see simulateTrajectory.test.ts.
 *
 * This deliberately previews the passive drop-and-settle behavior, not an
 * assumed "Reel in" retrieve — that stays a live, hands-on interaction
 * (holding the button or dragging), not something to bake into a canned
 * recording. Playback speed (Fase C's scrub bar) is a separate, later
 * concern: it controls how fast the UI scrubs through *this* fixed
 * recording, not how this recording itself was generated — so this always
 * runs at one fixed, speed-independent dt.
 */
export interface TrajectoryFrame {
  t: number; // seconds since the recording started
  positionY: number; // world mm
  pitch: number; // radians
}

export function computeTrajectory(
  inputs: SimPhysicsInputs,
  startPositionY: number,
  durationS: number,
  dtS: number,
): TrajectoryFrame[] {
  if (durationS <= 0 || dtS <= 0) return [{ t: 0, positionY: startPositionY, pitch: 0 }];

  let state: SimBodyState = { positionY: startPositionY, velocityY: 0, pitch: 0, angularVelocity: 0 };
  const frames: TrajectoryFrame[] = [{ t: 0, positionY: state.positionY, pitch: state.pitch }];

  let t = 0;
  while (t < durationS) {
    state = simulateFallStep(state, inputs, dtS);
    t += dtS;
    frames.push({ t, positionY: state.positionY, pitch: state.pitch });
  }
  return frames;
}

/**
 * Reads the recording at an arbitrary point in time, linearly interpolating
 * between the two bracketing frames for a smooth scrub instead of a stepped
 * one. Clamps to the recording's own start/end for times outside its range.
 */
export function sampleTrajectory(frames: TrajectoryFrame[], t: number): TrajectoryFrame {
  if (frames.length === 0) return { t: 0, positionY: 0, pitch: 0 };
  if (frames.length === 1 || t <= frames[0].t) return frames[0];
  const last = frames[frames.length - 1];
  if (t >= last.t) return last;

  // Frames are evenly spaced (fixed dtS), so the bracketing index can be
  // computed directly instead of scanning — cheap enough to matter once
  // this runs every rendered frame during playback.
  const dt = frames[1].t - frames[0].t;
  const rawIndex = t / dt;
  const i = Math.min(frames.length - 2, Math.max(0, Math.floor(rawIndex)));
  const a = frames[i];
  const b = frames[i + 1];
  const span = b.t - a.t;
  const frac = span > 0 ? (t - a.t) / span : 0;
  return {
    t,
    positionY: a.positionY + (b.positionY - a.positionY) * frac,
    pitch: a.pitch + (b.pitch - a.pitch) * frac,
  };
}

/** Min/max world-Y across the recording — used for the depth range readout (Fase D). */
export function trajectoryYRange(frames: TrajectoryFrame[]): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (const f of frames) {
    if (f.positionY < min) min = f.positionY;
    if (f.positionY > max) max = f.positionY;
  }
  if (!Number.isFinite(min)) return { min: 0, max: 0 };
  return { min, max };
}
