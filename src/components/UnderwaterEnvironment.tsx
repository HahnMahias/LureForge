import { useMemo, useRef, useLayoutEffect } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import {
  createUnderwaterGradientTexture,
  underwaterFogColor,
  createSoftDotTexture,
  createRayFadeTexture,
  createSandTexture,
} from '../utils/proceduralTextures';

/**
 * The Simulate tank's underwater atmosphere (Fase A of the visual redesign):
 * a vertical sky-to-depth gradient + fog, a few drifting god-ray shafts,
 * a sandy/rocky floor dressing, and a slow-drifting particle field. All
 * deliberately cheap procedural stand-ins (canvas-texture gradients/noise,
 * a handful of low-poly meshes, a small THREE.Points cloud) for a
 * believable mood — not an attempt at photorealism, which would need a
 * completely different baked-panorama rendering path (see the brief this
 * was built from). `brightness` (0..1) is Fase E's Light condition hook —
 * lower brightness also thickens the fog, so "Low" light reads as murkier
 * water, not just a darker sky tint.
 */

// FogExp2's falloff is `1 - exp(-(density * distance)^2)` — quadratic in
// distance, so a density tuned to look right at one camera distance badly
// over-fogs at a much larger one (blows straight past "faded" to "fully
// obscured") and under-fogs at a much smaller one. Since the follow-camera
// (SimulateView.tsx) always sits at roughly `lureFitRadius * a few`, and
// tankSpan scales with the same lure dimensions, dividing by tankSpan here
// keeps density × distance — and therefore the fog factor actually landing
// on the lure itself — roughly constant across a tiny 60mm lure, a 120mm
// one, and a 250mm one, instead of a fixed absolute density that only ever
// looked right for whichever single size it was tuned against.
// REFERENCE_TANK_SPAN_MM is that one size (a ~120mm lure's own tankSpan) —
// the constant below is tuned to look right there, then scaled for others.
const REFERENCE_TANK_SPAN_MM = 190;

function BackgroundAndFog({ brightness, tankSpan }: { brightness: number; tankSpan: number }) {
  const { scene } = useThree();
  const texture = useMemo(() => createUnderwaterGradientTexture(brightness), [brightness]);
  const fogColor = useMemo(() => underwaterFogColor(brightness), [brightness]);

  useLayoutEffect(() => {
    scene.background = texture;
    return () => {
      if (scene.background === texture) scene.background = null;
    };
  }, [scene, texture]);

  // Darker light = thicker fog (murkier water), not just a dimmer tint —
  // ties directly into Fase E's Visibility readout in the status card.
  const baseDensity = 0.0048 - brightness * 0.0021;
  const density = baseDensity * (REFERENCE_TANK_SPAN_MM / Math.max(tankSpan, 1));

  return <fogExp2 attach="fog" args={[fogColor, Math.max(0.0006, density)]} />;
}

interface RayDef {
  x: number;
  z: number;
  tiltX: number;
  tiltZ: number;
  length: number;
  radius: number;
  phase: number;
}

function GodRays({ tankSpan, waterSurfaceY }: { tankSpan: number; waterSurfaceY: number }) {
  const texture = useMemo(() => createRayFadeTexture(), []);
  const groupRef = useRef<THREE.Group>(null!);

  const rays = useMemo<RayDef[]>(() => {
    const count = 4;
    const list: RayDef[] = [];
    for (let i = 0; i < count; i++) {
      const t = i / count;
      list.push({
        x: (t - 0.5) * tankSpan * 0.7,
        z: (Math.sin(t * 7.3) * 0.5) * tankSpan * 0.5,
        tiltX: THREE.MathUtils.degToRad(14 + t * 6),
        tiltZ: THREE.MathUtils.degToRad(-10 + t * 14),
        length: waterSurfaceY * (0.9 + t * 0.3),
        radius: tankSpan * (0.05 + t * 0.02),
        phase: t * Math.PI * 2,
      });
    }
    return list;
  }, [tankSpan, waterSurfaceY]);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.getElapsedTime();
    groupRef.current.children.forEach((child, i) => {
      const mesh = child as THREE.Mesh;
      const material = mesh.material as THREE.MeshBasicMaterial;
      material.opacity = 0.05 + 0.03 * Math.sin(t * 0.3 + rays[i].phase);
    });
  });

  return (
    <group ref={groupRef}>
      {rays.map((ray, i) => (
        <mesh
          key={i}
          position={[ray.x, waterSurfaceY - ray.length / 2, ray.z]}
          rotation={[Math.PI + ray.tiltX, 0, ray.tiltZ]}
        >
          <coneGeometry args={[ray.radius, ray.length, 12, 1, true]} />
          <meshBasicMaterial
            map={texture}
            transparent
            opacity={0.06}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}

const ROCK_COLOR = '#5b5148';

// The floor plane deliberately extends WAY past the "area of interest"
// tankSpan scales (rocks, god rays, particles) — the redesign brief asks
// for an open, horizon-less underwater world with no visible box/edge from
// any camera angle or zoom level, not a tank floor sized to match its own
// walls (which no longer exist — see SimulateView.tsx's removed WaterTank).
// This relies on the scene's own fog (BackgroundAndFog below) to dissolve
// the plane's actual edge into the background well before it could ever
// reach the frame; the multiplier just needs to keep that edge outside the
// fog's own "fully obscured" distance across the whole range of lure sizes
// the follow-camera frames for (fog density itself already scales with
// tankSpan — see BackgroundAndFog — so this scales the same way).
const FLOOR_SPAN_MULTIPLIER = 16;

function TankFloorDressing({ tankSpan }: { tankSpan: number }) {
  const floorSpan = tankSpan * FLOOR_SPAN_MULTIPLIER;

  const sandTexture = useMemo(() => {
    const t = createSandTexture();
    const repeat = Math.max(1, Math.round(floorSpan / 40));
    t.repeat.set(repeat, repeat);
    return t;
  }, [floorSpan]);

  // Scattered within the original (pre-expansion) footprint, close to
  // wherever the lure/camera actually are — spreading them across the
  // whole, much-larger floor plane would just thin them out to nothing
  // meaningful; the plain sand beyond this radius is meant to fade into
  // the fog unnoticed, the same way a real sea floor does past visibility
  // range.
  const rocks = useMemo(() => {
    const count = 6;
    const list: { x: number; z: number; scale: number; rotY: number; kind: number }[] = [];
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + i * 0.7;
      const r = tankSpan * (0.2 + 0.25 * ((i * 37) % 5) / 5);
      list.push({
        x: Math.cos(a) * r,
        z: Math.sin(a) * r,
        scale: tankSpan * (0.025 + 0.02 * ((i * 13) % 4) / 4),
        rotY: a * 1.7,
        kind: i % 2,
      });
    }
    return list;
  }, [tankSpan]);

  return (
    <>
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[floorSpan, floorSpan]} />
        <meshStandardMaterial map={sandTexture} roughness={0.95} metalness={0} fog />
      </mesh>
      {rocks.map((rock, i) => (
        <mesh
          key={i}
          position={[rock.x, rock.scale * 0.35, rock.z]}
          rotation={[0.3, rock.rotY, 0.15]}
          scale={rock.scale}
        >
          {rock.kind === 0 ? <dodecahedronGeometry args={[1, 0]} /> : <icosahedronGeometry args={[1, 0]} />}
          <meshStandardMaterial color={ROCK_COLOR} roughness={0.9} metalness={0} flatShading />
        </mesh>
      ))}
    </>
  );
}

function ParticleField({ tankSpan, waterSurfaceY }: { tankSpan: number; waterSurfaceY: number }) {
  const texture = useMemo(() => createSoftDotTexture(), []);
  const pointsRef = useRef<THREE.Points>(null!);
  const count = 140;

  const { positions, speeds } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const spd = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * tankSpan;
      pos[i * 3 + 1] = Math.random() * waterSurfaceY;
      pos[i * 3 + 2] = (Math.random() - 0.5) * tankSpan;
      spd[i] = 3 + Math.random() * 6;
    }
    return { positions: pos, speeds: spd };
  }, [tankSpan, waterSurfaceY]);

  useFrame((_, delta) => {
    const geo = pointsRef.current?.geometry;
    if (!geo) return;
    const attr = geo.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < count; i++) {
      let y = attr.getY(i) + speeds[i] * delta;
      if (y > waterSurfaceY) y -= waterSurfaceY;
      attr.setY(i, y);
    }
    attr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        map={texture}
        size={Math.max(1.5, tankSpan * 0.01)}
        transparent
        opacity={0.35}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}

export default function UnderwaterEnvironment({
  tankSpan,
  waterSurfaceY,
  brightness = 0.7,
}: {
  tankSpan: number;
  waterSurfaceY: number;
  brightness?: number;
}) {
  return (
    <>
      <BackgroundAndFog brightness={brightness} tankSpan={tankSpan} />
      <GodRays tankSpan={tankSpan} waterSurfaceY={waterSurfaceY} />
      <TankFloorDressing tankSpan={tankSpan} />
      <ParticleField tankSpan={tankSpan} waterSurfaceY={waterSurfaceY} />
    </>
  );
}
