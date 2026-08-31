import { useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import {
  Grid,
  OrbitControls,
  TransformControls,
  GizmoHelper,
  GizmoViewcube,
} from '@react-three/drei';
import LureBody from './LureBody';
import FeatureMarkers from './FeatureMarkers';
import PhysicsMarkers from './PhysicsMarkers';
import WeightBadge from './WeightBadge';
import { useSceneStore } from '../store/useSceneStore';

type TransformMode = 'translate' | 'rotate' | 'scale' | null;

const TOOL_BUTTONS: { mode: Exclude<TransformMode, null>; label: string }[] = [
  { mode: 'translate', label: 'Move' },
  { mode: 'rotate', label: 'Rotate' },
  { mode: 'scale', label: 'Size' },
];

export default function Viewport3D({
  opaque,
}: {
  // LureBody normally turns translucent blue once the design has any
  // features, so their markers stay visible through the hull while placing
  // them in Editor — useful there, but Paint's whole point is showing what
  // the lure actually looks like, so PaintView.tsx passes this to force the
  // real paint colors instead of a blue-tinted preview. Same override
  // SimulateView.tsx's own LureBody usage already relies on.
  opaque?: boolean;
} = {}) {
  const [transformMode, setTransformMode] = useState<TransformMode>(null);
  const meshRef = useRef<THREE.Mesh>(null!);
  const dimensions = useSceneStore((s) => s.dimensions);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div
        style={{
          display: 'flex',
          gap: 6,
          padding: '8px 12px',
          borderBottom: '1px solid var(--border-subtle)',
          flexShrink: 0,
        }}
      >
        {TOOL_BUTTONS.map((btn) => {
          const isActive = transformMode === btn.mode;
          return (
            <button
              key={btn.mode}
              onClick={() => setTransformMode(isActive ? null : btn.mode)}
              style={{
                padding: '5px 12px',
                borderRadius: 5,
                border: '1px solid ' + (isActive ? 'var(--accent)' : 'var(--border-subtle)'),
                background: isActive ? 'var(--accent-dim)' : 'transparent',
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontSize: 12,
                fontWeight: 500,
              }}
            >
              {btn.label}
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1, position: 'relative', background: 'var(--bg-app)' }}>
        <Canvas
          shadows
          camera={{ position: [220, 160, 220], fov: 45, near: 1, far: 5000 }}
          gl={{ antialias: true, preserveDrawingBuffer: true, localClippingEnabled: true }}
          dpr={[1, 2]}
        >
          <color attach="background" args={['#0a0a0b']} />
          {/*
            Procedural studio rig instead of drei's <Environment preset>,
            which fetches an HDR from an external CDN at runtime — if that
            request fails (offline, blocked CDN, corporate firewall) the
            whole Canvas errors out and the viewport goes black. This rig
            needs no network request: a soft hemisphere fill plus a
            three-point key/fill/rim setup gives a comparable clean studio
            look and keeps working with zero connectivity.
          */}
          <hemisphereLight args={['#8fa4c9', '#1a1712', 0.55]} />
          <ambientLight intensity={0.2} />
          <directionalLight
            position={[150, 250, 150]}
            intensity={1.3}
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
          />
          <directionalLight position={[-180, 120, 100]} intensity={0.45} />
          <directionalLight position={[-40, 160, -260]} intensity={0.6} />

          {/* Sized to roughly the working area rather than an effectively
              infinite plane — args/fadeDistance scaled down from the
              original 1000x1000+infiniteGrid, which shimmered/moiréd on
              cells seen edge-on far from the lure (a plane that large next
              to a ~100-300mm subject is mostly sub-pixel aliasing). */}
          <Grid
            position={[0, 0, 0]}
            args={[400, 400]}
            cellSize={10}
            cellThickness={0.5}
            cellColor="#2a2a2f"
            sectionSize={100}
            sectionThickness={1}
            sectionColor="#3f3f46"
            fadeDistance={350}
            fadeStrength={1}
          />

          <LureBody meshRef={meshRef} opaque={opaque} />
          <FeatureMarkers />
          <PhysicsMarkers />

          {transformMode && <TransformControls object={meshRef} mode={transformMode} />}

          <OrbitControls makeDefault enableDamping dampingFactor={0.08} />

          <GizmoHelper alignment="top-right" margin={[70, 70]}>
            <GizmoViewcube faces={['RIGHT', 'LEFT', 'TOP', 'BOTTOM', 'FRONT', 'BACK']} />
          </GizmoHelper>
        </Canvas>

        <div
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            background: 'rgba(19,19,22,0.85)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 6,
            padding: '6px 10px',
            fontSize: 11,
            color: 'var(--text-secondary)',
            pointerEvents: 'none',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          L {dimensions.l.toFixed(1)} mm &middot; W {dimensions.w.toFixed(1)} mm &middot; H{' '}
          {dimensions.h.toFixed(1)} mm
        </div>

        <div
          style={{
            position: 'absolute',
            top: 48,
            left: 12,
            background: 'rgba(19,19,22,0.85)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 6,
            padding: '6px 10px',
            fontSize: 11,
            color: 'var(--text-secondary)',
            pointerEvents: 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#e5484d',
                display: 'inline-block',
              }}
            />
            Center of gravity
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#3d8bd4',
                display: 'inline-block',
              }}
            />
            Center of buoyancy
          </span>
        </div>

        <WeightBadge />
      </div>
    </div>
  );
}
