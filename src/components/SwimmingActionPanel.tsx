import { useEffect, useState } from 'react';
import type { RefObject } from 'react';
import { trajectoryYRange, type TrajectoryFrame } from '../utils/simulateTrajectory';
import { classifyActionType, classifyWobble } from '../utils/swimmingAction';
import { lipWobbleYawOffsetRad } from '../utils/lipEffects';
import type { DragState } from './SimulateView';

/**
 * Fase D's "Swimming Action" summary: depth range from the recording,
 * Wobble/Action Type derived from the lure's own configured properties
 * (see swimmingAction.ts), and Roll read live off the same dragState the
 * 3D rig renders from — so it reflects the actual current roll angle
 * rather than a guessed number. Roll's own source depends on what's
 * actually driving the lure's rotation: a spinning-tail retrieve rolls the
 * whole rig continuously (mainRollAngle), while a lip instead wags it
 * side-to-side during "Reel in" (lipWobblePhase, see lipEffects.ts) — with
 * neither, there's nothing to report and it reads 0.
 */
export default function SwimmingActionPanel({
  trajectory,
  waterSurfaceY,
  dragState,
  hasLip,
  lipAngleDeg,
  spinningTail,
  reelSpeed,
}: {
  trajectory: TrajectoryFrame[];
  waterSurfaceY: number;
  dragState: RefObject<DragState>;
  hasLip: boolean;
  lipAngleDeg: number;
  spinningTail: boolean;
  reelSpeed: number;
}) {
  const [rollDeg, setRollDeg] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      const st = dragState.current;
      if (spinningTail) {
        const raw = ((st?.mainRollAngle ?? 0) * 180) / Math.PI;
        setRollDeg(((raw % 360) + 360) % 360);
      } else if (hasLip) {
        const raw = Math.abs(lipWobbleYawOffsetRad(st?.lipWobblePhase ?? 0) * (180 / Math.PI));
        setRollDeg(raw);
      } else {
        setRollDeg(0);
      }
    }, 150);
    return () => clearInterval(id);
  }, [dragState, spinningTail, hasLip]);

  const { min, max } = trajectoryYRange(trajectory);
  const depthMinM = Math.max(0, (waterSurfaceY - max) / 1000);
  const depthMaxM = Math.max(0, (waterSurfaceY - min) / 1000);
  const wobble = classifyWobble(hasLip, lipAngleDeg);
  const actionType = classifyActionType({ hasLip, lipAngleDeg, spinningTail, reelSpeed });

  const stats: { label: string; value: string }[] = [
    { label: 'Depth', value: `${depthMinM.toFixed(1)} - ${depthMaxM.toFixed(1)} m` },
    { label: 'Wobble', value: wobble },
    { label: 'Roll', value: `${Math.round(rollDeg)}°` },
    { label: 'Action Type', value: actionType },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase', color: 'var(--text-dim)' }}>
        Swimming Action
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {stats.map((stat) => (
          <div key={stat.label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{stat.label}</span>
            <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>{stat.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
