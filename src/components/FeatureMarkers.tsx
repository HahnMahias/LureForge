import { useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useProfileStore } from '../store/useProfileStore';
import { useSceneStore } from '../store/useSceneStore';
import { useFeatureStore, type Feature, type LipShape, type BladeShape } from '../store/useFeatureStore';
import type { MetalType } from '../utils/materials';
import { WIRE_FRAME_DEFS, type WirePoint } from '../data/wireFrameDefs';
import { DECAL_PRESETS } from '../data/decalPresets';
import { sampleClosedCurve } from '../utils/curveMath';
import { computeSurfacePlacement } from '../utils/surfacePlacement';
import type { LureCurves } from '../utils/generateLureMesh';
import { spinAngularVelocityRadPerS } from '../utils/retrieveEffects';

const METAL_COLOR: Record<MetalType, string> = {
  lead: '#5b5d63',
  tungsten: '#2b2b2e',
  steel: '#b8bcc4',
};

function toWorld(pos: { x: number; y: number; z: number }, offset: { x: number; y: number }) {
  return [pos.x - offset.x, pos.y + offset.y, pos.z] as [number, number, number];
}

function EyesMarker({ feature, girth, offset, selected }: MarkerProps) {
  const radius = Math.max(girth * 0.06, 0.6);
  const [x, y, z] = toWorld(feature.position, offset);
  return (
    <>
      {[z, -z].map((zPos, i) => (
        <mesh key={i} position={[x, y, zPos]}>
          <sphereGeometry args={[radius, 16, 16]} />
          <meshStandardMaterial
            color={selected ? '#ff5c39' : '#111111'}
            roughness={0.3}
            metalness={0.4}
          />
        </mesh>
      ))}
    </>
  );
}

function RingMarker({ feature, girth, offset, selected, color }: MarkerProps & { color: string }) {
  const outerRadius = Math.max(girth * 0.09, 1.2);
  const tubeRadius = outerRadius * 0.28;
  const [x, y, z] = toWorld(feature.position, offset);
  return (
    <mesh position={[x, y, z]} rotation={[0, Math.PI / 2, 0]}>
      <torusGeometry args={[outerRadius, tubeRadius, 10, 20]} />
      <meshStandardMaterial
        color={selected ? '#ff5c39' : color}
        roughness={0.35}
        metalness={0.7}
      />
    </mesh>
  );
}

function LineTieMarker({ feature, girth, offset, selected }: MarkerProps) {
  const outerRadius = Math.max(girth * 0.09, 1.2);
  const tubeRadius = outerRadius * 0.28;
  const [x, y, z] = toWorld(feature.position, offset);
  const rot = feature.rotation ?? { x: 0, y: 0, z: 0 };
  const rotRad: [number, number, number] = [
    (rot.x * Math.PI) / 180,
    (rot.y * Math.PI) / 180,
    (rot.z * Math.PI) / 180,
  ];
  const style = feature.lineTieStyle ?? 'ring';
  const color = selected ? '#ff5c39' : '#c0c0c8';
  const material = <meshStandardMaterial color={color} roughness={0.35} metalness={0.7} />;

  return (
    // Outer group carries position + the user-adjustable rotation; inner
    // group holds the marker's default "loop facing forward" orientation,
    // so the two rotations compose predictably instead of fighting.
    <group position={[x, y, z]} rotation={rotRad}>
      <group rotation={[0, Math.PI / 2, 0]}>
        {style === 'ring' && (
          <mesh>
            <torusGeometry args={[outerRadius, tubeRadius, 10, 20]} />
            {material}
          </mesh>
        )}
        {style === 'staple' && (
          <mesh>
            <torusGeometry args={[outerRadius, tubeRadius, 8, 16, Math.PI]} />
            {material}
          </mesh>
        )}
        {style === 'screwEye' && (
          <>
            <mesh>
              <torusGeometry args={[outerRadius * 0.75, tubeRadius * 0.85, 10, 20]} />
              {material}
            </mesh>
            <mesh position={[0, 0, -outerRadius * 1.4]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[tubeRadius * 0.7, tubeRadius * 0.7, outerRadius * 1.8, 8]} />
              {material}
            </mesh>
          </>
        )}
      </group>
    </group>
  );
}

function BallastMarker({ feature, offset, selected }: MarkerProps) {
  const diameter = feature.diameterMm ?? 6;
  const radius = diameter / 2;
  const metal = feature.metal ?? 'lead';
  const [x, y, z] = toWorld(feature.position, offset);
  const color = selected ? '#ff5c39' : METAL_COLOR[metal];
  const material = <meshStandardMaterial color={color} roughness={0.4} metalness={0.85} />;
  const rotY = ((feature.rotation?.y ?? 0) * Math.PI) / 180;

  return (
    <mesh position={[x, y, z]} rotation={[0, rotY, 0]}>
      {feature.shape === 'box' ? (
        <boxGeometry args={[diameter, diameter, diameter]} />
      ) : feature.shape === 'cylinder' ? (
        <cylinderGeometry args={[radius, radius, diameter, 16]} />
      ) : (
        <sphereGeometry args={[radius, 16, 16]} />
      )}
      {material}
    </mesh>
  );
}

function WireStrut({
  a,
  b,
  radius,
  material,
}: {
  a: THREE.Vector3;
  b: THREE.Vector3;
  radius: number;
  material: React.ReactNode;
}) {
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const dir = b.clone().sub(a);
  const len = dir.length();
  if (len < 1e-6) return null;
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    dir.normalize(),
  );
  return (
    <mesh position={mid} quaternion={quaternion}>
      <cylinderGeometry args={[radius, radius, len, 8]} />
      {material}
    </mesh>
  );
}

function WireFrameMarker({ feature, length, girth, offset, selected }: MarkerProps & { length: number }) {
  const style = feature.wireFrameStyle ?? 'throughWire';
  const def = WIRE_FRAME_DEFS[style];
  const amplitude = girth * 0.35;
  const wireRadius = Math.max(girth * 0.022, 0.3);
  const ringOuter = Math.max(girth * 0.07, 0.9);
  const ringTube = ringOuter * 0.3;
  const color = selected ? '#ff5c39' : '#c9ccd1';
  const material = <meshStandardMaterial color={color} roughness={0.3} metalness={0.75} />;

  const toWorldWire = (p: WirePoint) =>
    new THREE.Vector3(p.x * length - offset.x, p.y * amplitude + offset.y, (p.z ?? 0) * amplitude);

  return (
    <group>
      {def.segments.map((segment, segIndex) => {
        const worldPoints = segment.map(toWorldWire);
        const isBranch = def.stemThickness !== undefined && segIndex > 0;
        const radius = isBranch ? wireRadius * def.stemThickness! : wireRadius;
        return (
          <group key={segIndex}>
            {worldPoints.slice(0, -1).map((p, i) => (
              <WireStrut key={i} a={p} b={worldPoints[i + 1]} radius={radius} material={material} />
            ))}
            {segment.map(
              (p, i) =>
                p.ring && (
                  <mesh key={`ring${i}`} position={worldPoints[i]} rotation={[0, Math.PI / 2, 0]}>
                    <torusGeometry args={[ringOuter, ringTube, 8, 16]} />
                    {material}
                  </mesh>
                ),
            )}
          </group>
        );
      })}
    </group>
  );
}

function FinMarker({ feature, offset, selected }: MarkerProps) {
  const outline = feature.finOutline ?? [];
  const thickness = feature.finThickness ?? 1.5;
  const mirror = feature.finMirror ?? false;
  const [x, y, z] = toWorld(feature.position, offset);
  const rot = feature.rotation ?? { x: 0, y: 0, z: 0 };
  const rotRad: [number, number, number] = [
    (rot.x * Math.PI) / 180,
    (rot.y * Math.PI) / 180,
    (rot.z * Math.PI) / 180,
  ];

  const geometry = useMemo(() => {
    if (outline.length < 3) return null;
    const smoothed = sampleClosedCurve(outline, 8);
    const shape = new THREE.Shape(smoothed.map((p) => new THREE.Vector2(p.x, p.y)));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
    geo.translate(0, 0, -thickness / 2);
    geo.computeVertexNormals();
    return geo;
  }, [outline, thickness]);

  if (!geometry) return null;

  const color = selected ? '#ff5c39' : '#3a3f47';
  const material = <meshStandardMaterial color={color} roughness={0.5} metalness={0.1} side={THREE.DoubleSide} />;

  return (
    <>
      <group position={[x, y, z]} rotation={rotRad}>
        <mesh geometry={geometry}>{material}</mesh>
      </group>
      {mirror && (
        // Mirroring the outer, unrotated group across world Z gives the
        // mathematically correct reflection regardless of the fin's own
        // rotation (mirror-then-place, rather than negating Euler angles).
        <group scale={[1, 1, -1]}>
          <group position={[x, y, z]} rotation={rotRad}>
            <mesh geometry={geometry}>{material}</mesh>
          </group>
        </group>
      )}
    </>
  );
}

/**
 * Builds the small embossed/engraved pad geometry: the preset outline
 * extruded along local +Z. "Ramp" adds a beveled edge (ExtrudeGeometry's
 * bevel options) instead of a flat stamped wall. "Engraved" flips the
 * extrusion to point into the body rather than out of it.
 *
 * This only ever produces a free-floating decoration mesh sitting at the
 * surface — it does not modify the body's own geometry. A real emboss/
 * engrave would need a CSG boolean union/subtract against the hollowed
 * shell (e.g. via a library like three-bvh-csg, which isn't part of this
 * project), which is a substantially bigger undertaking than this pass
 * covers. TODO: wire real geometry engraving into the STL export once a
 * CSG solution is in place; for now decals are visual-only and the
 * exported STL is unaffected by them, same as ExportPanel already notes.
 */
function buildDecalGeometry(
  pattern: keyof typeof DECAL_PRESETS,
  style: 'flat' | 'ramp',
  fill: 'rounded' | 'engraved',
  depth: number,
): THREE.BufferGeometry {
  const outline = DECAL_PRESETS[pattern].points;
  const shape = new THREE.Shape(outline.map((p) => new THREE.Vector2(p.x, p.y)));
  const extrudeDepth = Math.max(depth, 0.1);
  const isRamp = style === 'ramp';
  const bevelSize = isRamp ? Math.min(extrudeDepth * 0.6, 2) : 0;

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: extrudeDepth,
    bevelEnabled: isRamp,
    bevelSize,
    bevelThickness: extrudeDepth * 0.4,
    bevelSegments: 2,
    steps: 1,
  });

  // Engraved pads point into the body instead of out of it.
  if (fill === 'engraved') geo.scale(1, 1, -1);
  geo.computeVertexNormals();
  return geo;
}

function DecalMarker({
  feature,
  offset,
  selected,
  curves,
  length,
  symmetric,
}: MarkerProps & { curves: LureCurves; length: number; symmetric: boolean }) {
  const pattern = feature.decalPattern ?? 'star';
  const style = feature.decalStyle ?? 'flat';
  const fill = feature.decalFill ?? 'rounded';
  const depth = feature.decalDepth ?? 1;
  const mirror = feature.decalMirror ?? false;
  const readableBothSides = feature.decalReadableBothSides ?? false;

  const geometry = useMemo(
    () => buildDecalGeometry(pattern, style, fill, depth),
    [pattern, style, fill, depth],
  );

  const color = selected ? '#ff5c39' : fill === 'engraved' ? '#8a6a4a' : '#c9b278';
  const material = <meshStandardMaterial color={color} roughness={0.55} metalness={0.05} side={THREE.DoubleSide} />;

  const placement = computeSurfacePlacement(curves, length, symmetric, feature.position);
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), placement.normal);
  const [wx, wy, wz] = toWorld(
    { x: placement.point.x, y: placement.point.y, z: placement.point.z },
    offset,
  );

  return (
    <>
      <mesh position={[wx, wy, wz]} quaternion={quat} geometry={geometry}>
        {material}
      </mesh>

      {mirror &&
        (readableBothSides ? (
          // A true mirror would read backwards from the other side, so
          // instead of flipping the mesh, re-place an unflipped copy at the
          // opposite surface point — same orientation logic, just evaluated
          // for -z, so both sides read the same way round.
          (() => {
            const mirroredPos = { x: feature.position.x, y: feature.position.y, z: -feature.position.z };
            const mPlacement = computeSurfacePlacement(curves, length, symmetric, mirroredPos);
            const mQuat = new THREE.Quaternion().setFromUnitVectors(
              new THREE.Vector3(0, 0, 1),
              mPlacement.normal,
            );
            const [mx, my, mz] = toWorld(
              { x: mPlacement.point.x, y: mPlacement.point.y, z: mPlacement.point.z },
              offset,
            );
            return (
              <mesh position={[mx, my, mz]} quaternion={mQuat} geometry={geometry}>
                {material}
              </mesh>
            );
          })()
        ) : (
          <group scale={[1, 1, -1]}>
            <mesh position={[wx, wy, wz]} quaternion={quat} geometry={geometry}>
              {material}
            </mesh>
          </group>
        ))}
    </>
  );
}

const LIP_THICKNESS_MM = 1.5;

/**
 * Flat outline points for a lip's own local frame: X spans 0 (mount, at the
 * feature's position) to -lengthMm (tip), Y spans -widthMm/2..widthMm/2 —
 * fed straight into buildLipGeometry, which extrudes/reorients this into a
 * thin 3D plate. Coffin = a rectangle with its two tip-end corners chamfered
 * off, the classic diving-lip shape name.
 */
function lipShapePoints(shape: LipShape, widthMm: number, lengthMm: number): { x: number; y: number }[] {
  const w = widthMm;
  const l = lengthMm;
  if (shape === 'square') {
    return [
      { x: 0, y: -w / 2 },
      { x: 0, y: w / 2 },
      { x: -l, y: w / 2 },
      { x: -l, y: -w / 2 },
    ];
  }
  if (shape === 'coffin') {
    const chamfer = Math.min(w * 0.25, l * 0.3);
    return [
      { x: 0, y: -w / 2 },
      { x: 0, y: w / 2 },
      { x: -(l - chamfer), y: w / 2 },
      { x: -l, y: w / 2 - chamfer },
      { x: -l, y: -(w / 2 - chamfer) },
      { x: -(l - chamfer), y: -w / 2 },
    ];
  }
  // round: a simple oval spanning the same bounding length/width.
  const segments = 20;
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    points.push({ x: -l / 2 + (l / 2) * Math.cos(t), y: (w / 2) * Math.sin(t) });
  }
  return points;
}

/**
 * Builds a thin lip/bill plate. ExtrudeGeometry always extrudes a flat XY
 * shape along Z, which would put the plate's thin dimension sideways — the
 * -90° X-rotation below remaps (X=length, Y=width, Z=thickness) to
 * (X=length, Y=thickness, Z=width), so the plate ends up thin top-to-bottom
 * and wide side-to-side, matching a real bill mounted flat under the nose.
 */
function buildLipGeometry(shape: LipShape, widthMm: number, lengthMm: number): THREE.BufferGeometry {
  const points = lipShapePoints(shape, widthMm, lengthMm);
  const outline = new THREE.Shape(points.map((p) => new THREE.Vector2(p.x, p.y)));
  const geo = new THREE.ExtrudeGeometry(outline, { depth: LIP_THICKNESS_MM, bevelEnabled: false });
  geo.translate(0, 0, -LIP_THICKNESS_MM / 2);
  geo.rotateX(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

function LipMarker({ feature, offset, selected }: MarkerProps) {
  const shape = feature.lipShape ?? 'round';
  const widthMm = feature.lipWidthMm ?? 14;
  const lengthMm = feature.lipLengthMm ?? 18;
  const angleDeg = feature.lipAngleDeg ?? 45;
  const [x, y, z] = toWorld(feature.position, offset);
  const rot = feature.rotation ?? { x: 0, y: 0, z: 0 };
  const rotRad: [number, number, number] = [
    (rot.x * Math.PI) / 180,
    (rot.y * Math.PI) / 180,
    (rot.z * Math.PI) / 180,
  ];

  const geometry = useMemo(() => buildLipGeometry(shape, widthMm, lengthMm), [shape, widthMm, lengthMm]);

  const color = selected ? '#ff5c39' : '#2b2f36';
  const material = (
    <meshStandardMaterial color={color} roughness={0.25} metalness={0.15} side={THREE.DoubleSide} transparent opacity={0.85} />
  );

  return (
    <group position={[x, y, z]} rotation={rotRad}>
      {/* Default orientation: sweeps the plate's length axis from -X (0°,
          flush forward off the nose) to -Y (90°, straight down) as angleDeg
          increases — see the rotation derivation in FeatureMarkers.tsx's
          history for why this is a plain +Z rotation. */}
      <group rotation={[0, 0, THREE.MathUtils.degToRad(angleDeg)]}>
        <mesh geometry={geometry}>{material}</mesh>
      </group>
    </group>
  );
}

/**
 * Flat outline points for a spinner blade's own local frame: Y spans 0
 * (mount ring) to -lengthMm (tip), X spans -widthMm/2..widthMm/2 — the
 * blade hangs down from its mount point by default, same "outer group
 * carries user rotation" pattern as FinMarker/LipMarker. Aspect ratio is
 * the whole distinguishing feature between the three standard shapes
 * (Colorado nearly round, Willow long and narrow, Indiana in between) —
 * not photorealistic, just recognizable, per the spec's own allowance.
 */
function bladeDimensions(shape: BladeShape, sizeMm: number): { width: number; length: number } {
  if (shape === 'willow') return { width: sizeMm * 0.5, length: sizeMm * 2.2 };
  if (shape === 'indiana') return { width: sizeMm * 0.75, length: sizeMm * 1.3 };
  return { width: sizeMm * 0.9, length: sizeMm }; // colorado
}

function buildBladeGeometry(shape: BladeShape, sizeMm: number): THREE.BufferGeometry {
  const { width, length } = bladeDimensions(shape, sizeMm);
  const segments = 20;
  const points: THREE.Vector2[] = [];
  for (let i = 0; i < segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    points.push(new THREE.Vector2((width / 2) * Math.sin(t), -length / 2 - (length / 2) * Math.cos(t)));
  }
  const outline = new THREE.Shape(points);
  const thickness = 0.6;
  const geo = new THREE.ExtrudeGeometry(outline, { depth: thickness, bevelEnabled: false });
  geo.translate(0, 0, -thickness / 2);
  geo.computeVertexNormals();
  return geo;
}

interface SpinDriver {
  reelingRef: RefObject<boolean>;
  speed: number;
  reelSpeedMmS: number;
}

function SpinnerBladeMarker({
  feature,
  offset,
  selected,
  spin,
}: MarkerProps & { spin?: SpinDriver }) {
  const shape = feature.bladeShape ?? 'colorado';
  const sizeMm = feature.bladeSizeMm ?? 16;
  const [x, y, z] = toWorld(feature.position, offset);
  const rot = feature.rotation ?? { x: 0, y: 0, z: 0 };
  const rotRad: [number, number, number] = [
    (rot.x * Math.PI) / 180,
    (rot.y * Math.PI) / 180,
    (rot.z * Math.PI) / 180,
  ];
  const { width } = bladeDimensions(shape, sizeMm);
  const ringOuter = Math.max(width * 0.18, 1.2);
  const ringTube = ringOuter * 0.3;

  const geometry = useMemo(() => buildBladeGeometry(shape, sizeMm), [shape, sizeMm]);
  const spinGroupRef = useRef<THREE.Group>(null!);

  useFrame((_, rawDelta) => {
    if (!spin || !spin.reelingRef.current || !spinGroupRef.current) return;
    const dt = Math.min(rawDelta, 0.1) * spin.speed;
    if (dt <= 0) return;
    const rate = spinAngularVelocityRadPerS(spin.reelSpeedMmS * spin.speed);
    spinGroupRef.current.rotation.y += rate * dt;
  });

  const color = selected ? '#ff5c39' : '#d8dde3';
  const material = (
    <meshStandardMaterial color={color} roughness={0.15} metalness={0.9} side={THREE.DoubleSide} />
  );
  const ringColor = selected ? '#ff5c39' : '#9a9aa2';
  const ringMaterial = <meshStandardMaterial color={ringColor} roughness={0.35} metalness={0.7} />;

  return (
    <group position={[x, y, z]} rotation={rotRad}>
      <mesh rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[ringOuter, ringTube, 8, 16]} />
        {ringMaterial}
      </mesh>
      {/* Spins around its own hanging axis (local Y, ring-to-tip) while
          reeling — the same axis a real blade spins around its wire shaft. */}
      <group ref={spinGroupRef}>
        <mesh geometry={geometry}>{material}</mesh>
      </group>
    </group>
  );
}

function SkirtMarker({ feature, offset, selected }: MarkerProps) {
  const color = selected ? '#ff5c39' : feature.skirtColor ?? '#c8342f';
  const lengthMm = feature.skirtLengthMm ?? 40;
  const [x, y, z] = toWorld(feature.position, offset);
  const material = <meshStandardMaterial color={color} roughness={0.6} metalness={0} side={THREE.DoubleSide} />;

  // A ring of thin strands trailing backward (+X, toward the tail) and
  // flaring slightly outward — enough to read as "skirt" without needing
  // to be photorealistic silicone geometry.
  const strandCount = 10;
  const strands = useMemo(() => {
    const list: { start: THREE.Vector3; end: THREE.Vector3 }[] = [];
    for (let i = 0; i < strandCount; i++) {
      const a = (i / strandCount) * Math.PI * 2;
      const flare = lengthMm * 0.22;
      list.push({
        start: new THREE.Vector3(0, 0, 0),
        end: new THREE.Vector3(lengthMm, Math.sin(a) * flare, Math.cos(a) * flare),
      });
    }
    return list;
  }, [strandCount, lengthMm]);

  return (
    <group position={[x, y, z]}>
      {strands.map((s, i) => (
        <WireStrut key={i} a={s.start} b={s.end} radius={0.5} material={material} />
      ))}
    </group>
  );
}

interface MarkerProps {
  feature: Feature;
  girth: number;
  offset: { x: number; y: number };
  selected: boolean;
}

export default function FeatureMarkers({ spin }: { spin?: SpinDriver } = {}) {
  const features = useFeatureStore((s) => s.features);
  const selectedId = useFeatureStore((s) => s.selectedId);
  const girth = useProfileStore((s) => s.girth);
  const length = useProfileStore((s) => s.length);
  const curves = useProfileStore((s) => s.curves);
  const symmetric = useProfileStore((s) => s.symmetric);
  const offset = useSceneStore((s) => s.bodyOffset);

  return (
    <>
      {features
        .filter((f) => f.visible)
        .map((feature) => {
          const selected = feature.id === selectedId;
          if (feature.type === 'eyes') {
            return (
              <EyesMarker key={feature.id} feature={feature} girth={girth} offset={offset} selected={selected} />
            );
          }
          if (feature.type === 'ballast') {
            return (
              <BallastMarker key={feature.id} feature={feature} girth={girth} offset={offset} selected={selected} />
            );
          }
          if (feature.type === 'lineTie') {
            return (
              <LineTieMarker key={feature.id} feature={feature} girth={girth} offset={offset} selected={selected} />
            );
          }
          if (feature.type === 'wireFrame') {
            return (
              <WireFrameMarker
                key={feature.id}
                feature={feature}
                length={length}
                girth={girth}
                offset={offset}
                selected={selected}
              />
            );
          }
          if (feature.type === 'fin') {
            return (
              <FinMarker key={feature.id} feature={feature} girth={girth} offset={offset} selected={selected} />
            );
          }
          if (feature.type === 'spinnerBlade') {
            return (
              <SpinnerBladeMarker
                key={feature.id}
                feature={feature}
                girth={girth}
                offset={offset}
                selected={selected}
                spin={spin}
              />
            );
          }
          if (feature.type === 'skirt') {
            return (
              <SkirtMarker key={feature.id} feature={feature} girth={girth} offset={offset} selected={selected} />
            );
          }
          if (feature.type === 'lip') {
            return (
              <LipMarker key={feature.id} feature={feature} girth={girth} offset={offset} selected={selected} />
            );
          }
          if (feature.type === 'decal') {
            return (
              <DecalMarker
                key={feature.id}
                feature={feature}
                girth={girth}
                offset={offset}
                selected={selected}
                curves={curves}
                length={length}
                symmetric={symmetric}
              />
            );
          }
          return (
            <RingMarker
              key={feature.id}
              feature={feature}
              girth={girth}
              offset={offset}
              selected={selected}
              color="#9a9aa2"
            />
          );
        })}
    </>
  );
}
