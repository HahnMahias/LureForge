import { useEffect, useState } from 'react';
import type { RefObject } from 'react';
import type { DragState, CameraShortcut } from './SimulateView';

/**
 * Fase B's top-left status card: live depth (polled off the same dragState
 * both live physics and playback already write to, so it reads correctly
 * in either mode) plus the current Conditions readout (Fase E — temperature
 * and visibility are passed in rather than computed here, since Light is
 * what actually drives visibility; this card just displays it).
 */
export function StatusCard({
  dragState,
  waterSurfaceY,
  temperatureC,
  visibilityM,
}: {
  dragState: RefObject<DragState>;
  waterSurfaceY: number;
  temperatureC: number;
  visibilityM: number;
}) {
  const [depthM, setDepthM] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      const y = dragState.current?.y ?? waterSurfaceY;
      setDepthM(Math.max(0, (waterSurfaceY - y) / 1000));
    }, 150);
    return () => clearInterval(id);
  }, [dragState, waterSurfaceY]);

  const rows: { icon: string; label: string; value: string }[] = [
    { icon: '↕', label: 'Depth', value: `${depthM.toFixed(1)} m` },
    { icon: '🌡', label: 'Temperature', value: `${temperatureC.toFixed(1)} °C` },
    { icon: '👁', label: 'Visibility', value: `${visibilityM.toFixed(1)} m` },
  ];

  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        left: 12,
        background: 'rgba(10,16,26,0.78)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 8,
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        pointerEvents: 'none',
        minWidth: 150,
      }}
    >
      {rows.map((row) => (
        <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
          <span style={{ width: 16, textAlign: 'center', opacity: 0.8 }}>{row.icon}</span>
          <span style={{ color: 'var(--text-secondary)', flex: 1 }}>{row.label}</span>
          <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
            {row.value}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Fase B's vertical icon toolbar: fixed-axis camera shortcuts, a trajectory-path toggle, and a reset-to-default view. */
export function ViewportToolbar({
  cameraCommandRef,
  showPath,
  onTogglePath,
}: {
  cameraCommandRef: RefObject<CameraShortcut | null>;
  showPath: boolean;
  onTogglePath: () => void;
}) {
  const buttons: { key: CameraShortcut | 'path'; label: string; icon: string }[] = [
    { key: 'side', label: 'Side', icon: '⬛' },
    { key: 'top', label: 'Top', icon: '⬒' },
    { key: 'front', label: 'Front', icon: '◧' },
    { key: 'path', label: 'Path', icon: '〰' },
    { key: 'reset', label: 'Reset', icon: '⟲' },
  ];

  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        right: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        background: 'rgba(10,16,26,0.78)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 8,
        padding: 6,
      }}
    >
      {buttons.map((btn) => {
        const active = btn.key === 'path' && showPath;
        return (
          <button
            key={btn.key}
            title={btn.label}
            onClick={() => (btn.key === 'path' ? onTogglePath() : (cameraCommandRef.current = btn.key))}
            style={{
              width: 44,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              padding: '6px 4px',
              borderRadius: 6,
              border: '1px solid ' + (active ? 'var(--accent)' : 'transparent'),
              background: active ? 'var(--accent-dim)' : 'transparent',
              color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontSize: 14,
              lineHeight: 1,
            }}
          >
            <span>{btn.icon}</span>
            <span style={{ fontSize: 9 }}>{btn.label}</span>
          </button>
        );
      })}
    </div>
  );
}
