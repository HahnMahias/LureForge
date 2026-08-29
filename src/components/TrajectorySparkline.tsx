import { useEffect, useMemo, useState } from 'react';
import type { RefObject } from 'react';
import type { TrajectoryFrame } from '../utils/simulateTrajectory';
import { sampleTrajectory, trajectoryYRange } from '../utils/simulateTrajectory';
import type { DragState, PlaybackControl } from './SimulateView';

/**
 * Fase D's "Trajectory Preview": a small SVG line of depth over time from
 * the recorded passive-drop preview, with a marker dot tracking the current
 * position — a plain polyline is enough here, a full chart library would be
 * overkill for one sparkline.
 *
 * The marker has two sources depending on mode, not just one: while the
 * user is actively scrubbing/playing the recording (mode 'playback'), it
 * tracks that recorded position, same as always. But the recording is an
 * opt-in preview (Play button) — most of the time (idle drifting, or an
 * active "Reel in"/drag) the rig is driven by *live* physics instead, and
 * the marker used to just sit frozen at t=0 the whole time then, since it
 * only ever read the recording's own clock. It now falls back to the real
 * live depth (dragState.y, the same world-Y the 3D rig itself renders from)
 * with a free-running clock for its X position, so it keeps visibly moving
 * whenever the lure is actually moving on screen — never fabricated, always
 * the lure's real current depth either way.
 */
export default function TrajectorySparkline({
  trajectory,
  playback,
  dragState,
  width = 280,
  height = 64,
}: {
  trajectory: TrajectoryFrame[];
  playback: PlaybackControl;
  dragState: RefObject<DragState>;
  width?: number;
  height?: number;
}) {
  const [sample, setSample] = useState({ t: 0, y: trajectory[0]?.positionY ?? 0 });

  useEffect(() => {
    const id = setInterval(() => {
      if (playback.modeRef.current === 'playback') {
        const t = playback.playbackTimeRef.current ?? 0;
        setSample({ t, y: sampleTrajectory(trajectory, t).positionY });
      } else {
        // Not scrubbing the recording — free-running clock (real elapsed
        // time, looped to the recording's own duration) just to keep the
        // marker's X position animating, paired with the lure's actual
        // live depth for Y.
        const t = (Date.now() / 1000) % playback.durationS;
        setSample({ t, y: dragState.current?.y ?? trajectory[0]?.positionY ?? 0 });
      }
    }, 150);
    return () => clearInterval(id);
  }, [playback, dragState, trajectory]);

  const { path, markerX, markerY } = useMemo(() => {
    if (trajectory.length < 2) return { path: '', markerX: 0, markerY: height / 2 };
    const { min, max } = trajectoryYRange(trajectory);
    const span = Math.max(1, max - min);
    const duration = trajectory[trajectory.length - 1].t || 1;
    const toXY = (t: number, y: number) => {
      const x = (t / duration) * width;
      // Deeper (larger world-Y-below-surface, i.e. smaller world Y) draws
      // lower on the sparkline — flip so "down" reads as "down".
      const yy = ((y - min) / span) * (height - 8) + 4;
      return [x, yy] as const;
    };
    const points = trajectory.map((f) => toXY(f.t, f.positionY));
    const path = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    // The live-mode Y can fall outside the recording's own min/max (e.g. a
    // "Reel in" retrieve lifts the lure above where the passive recording
    // ever reaches) — clamp only the drawn marker to the chart's own axis
    // range so it stays a visible dot at the nearest edge instead of
    // rendering outside the sparkline entirely.
    const clampedY = Math.min(max, Math.max(min, sample.y));
    const marker = toXY(sample.t, clampedY);
    return { path, markerX: marker[0], markerY: marker[1] };
  }, [trajectory, sample, width, height]);

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <path d={path} fill="none" stroke="var(--accent)" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={markerX} cy={markerY} r={4} fill="#ff5c39" stroke="#141414" strokeWidth={1} />
    </svg>
  );
}
