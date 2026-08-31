import { useEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useProfileStore } from '../store/useProfileStore';
import { useSegmentsStore } from '../store/useSegmentsStore';
import { useSceneStore } from '../store/useSceneStore';
import { useFeatureStore, type Feature } from '../store/useFeatureStore';
import { usePaintStore } from '../store/usePaintStore';
import { buildLureGeometry } from '../utils/generateLureMesh';
import { computeMeshVolumeAndCentroid } from '../utils/meshVolume';
import { computeFillAwareVolumeMm3, computeBodyWeightG, type BodyMassPart } from '../utils/physics';
import { computeVolumeCorrection } from '../utils/buoyancy';
import { createScaleTexture } from '../utils/scaleTexture';
import { createPaintTexture } from '../utils/paintTexture';
import { BODY_MATERIAL_DENSITY_G_CM3 } from '../utils/materials';
import { spinAngularVelocityRadPerS } from '../utils/retrieveEffects';
import {
  jointSwingAngularVelocityRadPerS,
  jointSwingYawOffsetRad,
  jointSwingPitchOffsetRad,
} from '../utils/jointEffects';
import { subtractFinCavities } from '../utils/finGeometry';

/**
 * Renders the procedural scale pattern as a bump-mapped overlay reusing the
 * body's own geometry (so it fits the surface perfectly with no seams),
 * clipped to the chosen length-coverage range via WebGL clipping planes.
 * This is a rendering-only effect — it doesn't touch the body's actual
 * geometry, so it has no effect on the exported STL (same as how fine
 * surface texture is normally handled: paint/print detail, not a
 * structural change to the print).
 */
function ScalesOverlay({
  feature,
  geometry,
  offset,
  length,
  girth,
  hasFeatures,
  selected,
}: {
  feature: Feature;
  geometry: THREE.BufferGeometry;
  offset: { x: number; y: number };
  length: number;
  girth: number;
  hasFeatures: boolean;
  selected: boolean;
}) {
  const startPct = feature.scalesCoverageStart ?? 0;
  const endPct = feature.scalesCoverageEnd ?? 100;
  const size = feature.scalesSize ?? 6;
  const depth = feature.scalesDepth ?? 0.5;

  const clippingPlanes = useMemo(() => {
    const startWorldX = length * (Math.min(startPct, endPct) / 100) - offset.x;
    const endWorldX = length * (Math.max(startPct, endPct) / 100) - offset.x;
    return [
      new THREE.Plane(new THREE.Vector3(1, 0, 0), -startWorldX),
      new THREE.Plane(new THREE.Vector3(-1, 0, 0), endWorldX),
    ];
  }, [startPct, endPct, length, offset.x]);

  const texture = useMemo(() => {
    const t = createScaleTexture();
    const repeatX = Math.max(1, Math.round(length / Math.max(size, 1)));
    const repeatY = Math.max(1, Math.round((Math.PI * girth) / Math.max(size, 1)));
    t.repeat.set(repeatX, repeatY);
    return t;
  }, [size, length, girth]);

  return (
    <mesh geometry={geometry} renderOrder={1}>
      <meshStandardMaterial
        color={selected ? '#ff5c39' : hasFeatures ? '#3d8bd4' : '#c9b278'}
        roughness={0.65}
        metalness={0.05}
        bumpMap={texture}
        bumpScale={depth}
        transparent={hasFeatures}
        opacity={hasFeatures ? 0.4 : 1}
        clippingPlanes={clippingPlanes}
        polygonOffset
        polygonOffsetFactor={-4}
        polygonOffsetUnits={-4}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function JointMarker({ x, y, girth, selected }: { x: number; y: number; girth: number; selected: boolean }) {
  const pinRadius = Math.max(girth * 0.05, 0.6);
  const pinLength = girth * 1.05;
  const collarOuter = pinRadius * 2.2;
  const collarTube = pinRadius * 0.6;
  const color = selected ? '#ff5c39' : '#c9ccd1';
  const material = <meshStandardMaterial color={color} roughness={0.3} metalness={0.8} />;

  return (
    <group position={[x, y, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[pinRadius, pinRadius, pinLength, 12]} />
        {material}
      </mesh>
      <mesh rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[collarOuter, collarTube, 8, 16]} />
        {material}
      </mesh>
    </group>
  );
}

interface SpinDriver {
  reelingRef: RefObject<boolean>;
  speed: number;
  reelSpeedMmS: number;
}

export default function LureBody({
  meshRef,
  spin,
  opaque,
}: {
  meshRef: RefObject<THREE.Mesh>;
  // Drives per-segment "spinning tail" rolling while Reel in is held — only
  // provided by SimulateView's LureRig; the Editor's static 3D view (which
  // never reels anything in) simply omits it, so segments there never spin.
  spin?: SpinDriver;
  // The Editor's 3D view turns the body translucent blue whenever it has
  // features, so feature markers stay visible through the hull while
  // placing them — useful there, but Simulate has no markers to see through
  // and wants the lure to look like an actual lure in its underwater scene.
  // Only SimulateView passes this to force the normal opaque body color.
  opaque?: boolean;
}) {
  const curves = useProfileStore((s) => s.curves);
  const length = useProfileStore((s) => s.length);
  const girth = useProfileStore((s) => s.girth);
  const noseType = useProfileStore((s) => s.noseType);
  const symmetric = useProfileStore((s) => s.symmetric);
  const fill = useProfileStore((s) => s.fill);
  const wallThicknessMm = useProfileStore((s) => s.wallThicknessMm);
  const bodyMaterial = useProfileStore((s) => s.material);
  const extraSegments = useSegmentsStore((s) => s.segments);
  const activeSegmentId = useSegmentsStore((s) => s.activeId);
  const setDimensions = useSceneStore((s) => s.setDimensions);
  const setBodyOffset = useSceneStore((s) => s.setBodyOffset);
  const setBodyVolumeMm3 = useSceneStore((s) => s.setBodyVolumeMm3);
  const setBodyWeightG = useSceneStore((s) => s.setBodyWeightG);
  const setBodyCentroid = useSceneStore((s) => s.setBodyCentroid);
  const setBodyParts = useSceneStore((s) => s.setBodyParts);
  const features = useFeatureStore((s) => s.features);
  const selectedFeatureId = useFeatureStore((s) => s.selectedId);
  const hasFeatures = features.length > 0;
  const scalesFeatures = features.filter((f) => f.type === 'scales' && f.visible);

  // The Paint tab's own color/pattern choices, rendered as a texture on the
  // body's existing UV layout (u = length, v = belly→back→belly — see
  // paintTexture.ts's own header comment) rather than a flat material color,
  // so the body actually shows the countershading/bands/spots the pattern
  // implies instead of just changing a single flat tint.
  const paintPattern = usePaintStore((s) => s.pattern);
  const paintBackColor = usePaintStore((s) => s.backColor);
  const paintBellyColor = usePaintStore((s) => s.bellyColor);
  const paintAccentColor = usePaintStore((s) => s.accentColor);
  const paintTexture = useMemo(
    () =>
      createPaintTexture(paintPattern, {
        backColor: paintBackColor,
        bellyColor: paintBellyColor,
        accentColor: paintAccentColor,
      }),
    [paintPattern, paintBackColor, paintBellyColor, paintAccentColor],
  );

  const mainResult = useMemo(
    () => buildLureGeometry(curves, length, girth, noseType, symmetric),
    [curves, length, girth, noseType, symmetric],
  );

  // Fase E — 'separatePart' fins carve a matching cavity into the main
  // body's own geometry (a real CSG subtract, not a visual overlap), so the
  // live weight/buoyancy calc below and the printed STL both see the same
  // hollowed-out body a separate printed insert would actually need. A
  // no-op passthrough when there's no separate-part fin.
  const separatePartFins = useMemo(
    () => features.filter((f) => f.type === 'fin' && f.finOperation === 'separatePart' && f.visible),
    [features],
  );
  const bodyGeometry = useMemo(
    () => subtractFinCavities(mainResult.geometry, separatePartFins, mainResult.offset),
    [mainResult, separatePartFins],
  );

  const extraResults = useMemo(
    () =>
      extraSegments.map((seg) => ({
        seg,
        result: buildLureGeometry(seg.curves, seg.length, seg.girth, seg.noseType, seg.symmetric),
      })),
    [extraSegments],
  );

  const assembly = useMemo(() => {
    // Extra segments are strung on tail-first, nose touching the previous
    // segment's tail, with their centerlines aligned to the main body's.
    let cumulativeTailX = length / 2;
    const placed = extraResults.map(({ seg, result }) => {
      const groupX = cumulativeTailX + seg.length / 2;
      const groupY = mainResult.offset.y - result.offset.y;
      const jointX = cumulativeTailX;
      cumulativeTailX += seg.length;
      return { seg, result, groupX, groupY, jointX };
    });

    const bodyMass = computeMeshVolumeAndCentroid(bodyGeometry);
    let totalVolumeMm3 = bodyMass.volumeMm3;
    const mainMaterialVolumeMm3 = computeFillAwareVolumeMm3(bodyGeometry, bodyMass.volumeMm3, fill, wallThicknessMm);
    const massParts: BodyMassPart[] = [
      { materialVolumeMm3: mainMaterialVolumeMm3, densityGCm3: BODY_MATERIAL_DENSITY_G_CM3[bodyMaterial] },
    ];
    const weightedCentroid = bodyMass.centroid.clone().multiplyScalar(bodyMass.volumeMm3);

    bodyGeometry.computeBoundingBox();
    const box = bodyGeometry.boundingBox!.clone();

    const placedWithVolume = placed.map((p) => {
      const localMass = computeMeshVolumeAndCentroid(p.result.geometry);
      totalVolumeMm3 += localMass.volumeMm3;
      const segMaterialVolumeMm3 = computeFillAwareVolumeMm3(
        p.result.geometry,
        localMass.volumeMm3,
        p.seg.fill,
        p.seg.wallThicknessMm,
      );
      massParts.push({
        materialVolumeMm3: segMaterialVolumeMm3,
        densityGCm3: BODY_MATERIAL_DENSITY_G_CM3[p.seg.material],
      });
      const worldCentroid = localMass.centroid.clone().add(new THREE.Vector3(p.groupX, p.groupY, 0));
      weightedCentroid.addScaledVector(worldCentroid, localMass.volumeMm3);

      p.result.geometry.computeBoundingBox();
      const segBox = p.result.geometry.boundingBox!.clone();
      segBox.translate(new THREE.Vector3(p.groupX, p.groupY, 0));
      box.union(segBox);

      return { ...p, volumeMm3: localMass.volumeMm3 };
    });

    const combinedCentroid = totalVolumeMm3 > 0 ? weightedCentroid.divideScalar(totalVolumeMm3) : bodyMass.centroid;

    return {
      placed: placedWithVolume,
      mainVolumeMm3: bodyMass.volumeMm3,
      totalVolumeMm3,
      bodyWeightG: computeBodyWeightG(massParts),
      combinedCentroid,
      dimensions: {
        l: box.max.x - box.min.x,
        w: box.max.z - box.min.z,
        h: box.max.y - box.min.y,
      },
    };
  }, [mainResult, bodyGeometry, extraResults, length, fill, wallThicknessMm, bodyMaterial]);

  // Curve data for Simulate's buoyancy integration (utils/buoyancy.ts) — one
  // entry per lofted piece, in the same shared frame as assembly.placed's
  // groupX so submerged-volume sampling doesn't need to re-derive the joint
  // placement math above. Each part's volumeCorrection anchors the cheap
  // ellipse-cross-section model (see buoyancy.ts) to this piece's real,
  // exact mesh volume, computed just above.
  const bodyParts = useMemo(() => {
    const mainPart = { ...curves, length, symmetric, groupX: 0 };
    return [
      { ...mainPart, volumeCorrection: computeVolumeCorrection(mainPart, assembly.mainVolumeMm3) },
      ...assembly.placed.map((p) => {
        const part = { ...p.seg.curves, length: p.seg.length, symmetric: p.seg.symmetric, groupX: p.groupX };
        return { ...part, volumeCorrection: computeVolumeCorrection(part, p.volumeMm3) };
      }),
    ];
  }, [curves, length, symmetric, assembly.placed, assembly.mainVolumeMm3]);

  useEffect(() => {
    setBodyOffset(mainResult.offset);
    setBodyVolumeMm3(assembly.totalVolumeMm3);
    setBodyWeightG(assembly.bodyWeightG);
    setBodyCentroid({
      x: assembly.combinedCentroid.x,
      y: assembly.combinedCentroid.y,
      z: assembly.combinedCentroid.z,
    });
    setDimensions(assembly.dimensions);
    setBodyParts(bodyParts);
  }, [
    mainResult.offset,
    assembly,
    bodyParts,
    setDimensions,
    setBodyOffset,
    setBodyVolumeMm3,
    setBodyParts,
    setBodyWeightG,
    setBodyCentroid,
  ]);

  const showFeatureTint = hasFeatures && !opaque;
  // White (rather than the old flat #c9b278) lets the paint texture's own
  // colors show through unmodified — meshStandardMaterial's color always
  // multiplies its map, so anything but white would re-tint the paint job.
  // The feature-tint blue still applies on top the same way it always did.
  const material = (
    <meshStandardMaterial
      map={paintTexture}
      color={showFeatureTint ? '#3d8bd4' : '#ffffff'}
      roughness={showFeatureTint ? 0.15 : 0.85}
      metalness={0.05}
      side={THREE.DoubleSide}
      transparent={showFeatureTint}
      opacity={showFeatureTint ? 0.35 : 1}
      depthWrite={!showFeatureTint}
    />
  );

  // Per-segment "spinning tail" roll (Fase 3) — each spinning segment gets
  // its own pivot group (keyed by segment id) so its rotation.x can be
  // driven directly here without going through React state every frame.
  const spinPivotRefs = useRef<Map<string, THREE.Group>>(new Map());
  const spinAngles = useRef<Map<string, number>>(new Map());
  // Joint swing (Fase F) — pivots at the joint itself (jointX), not the
  // segment's own centerline, so a swinging segment fans out from its
  // fixed "socket" rather than orbiting off-center. Only segments with a
  // non-rigid jointType get animated; rigid ones are left untouched (their
  // pivot group just sits at rotation 0, same as before this feature).
  const jointPivotRefs = useRef<Map<string, THREE.Group>>(new Map());
  const jointPhases = useRef<Map<string, number>>(new Map());

  useFrame((_, rawDelta) => {
    if (!spin || !spin.reelingRef.current) return;
    // spin.speed already applies once, inside each *AngularVelocityRadPerS
    // call below (reelSpeedMmS * spin.speed) — multiplying it into dt too
    // applied it twice (quadratically): at Speed=2x this spun/swung 4x
    // instead of 2x. Same fix as SimulateView.tsx's own dt already got.
    const dt = Math.min(rawDelta, 0.1);
    if (dt <= 0) return;
    const rate = spinAngularVelocityRadPerS(spin.reelSpeedMmS * spin.speed);
    for (const p of assembly.placed) {
      if (p.seg.retrieveAction !== 'spinningTail') continue;
      const group = spinPivotRefs.current.get(p.seg.id);
      if (!group) continue;
      const next = (spinAngles.current.get(p.seg.id) ?? 0) + rate * dt;
      spinAngles.current.set(p.seg.id, next);
      group.rotation.x = next;
    }

    for (let chainIndex = 0; chainIndex < assembly.placed.length; chainIndex++) {
      const p = assembly.placed[chainIndex];
      if (p.seg.jointType === 'rigid') continue;
      const group = jointPivotRefs.current.get(p.seg.id);
      if (!group) continue;
      const rate2 = jointSwingAngularVelocityRadPerS(spin.reelSpeedMmS * spin.speed, p.seg.jointType);
      const amplitudeScale = 1 + chainIndex * 0.25;
      const next = (jointPhases.current.get(p.seg.id) ?? 0) + rate2 * dt;
      jointPhases.current.set(p.seg.id, next);
      group.rotation.y = jointSwingYawOffsetRad(next, p.seg.jointType) * amplitudeScale;
      group.rotation.x = jointSwingPitchOffsetRad(next, p.seg.jointType) * amplitudeScale;
    }
  });

  return (
    <>
      <mesh ref={meshRef} geometry={bodyGeometry} castShadow receiveShadow>
        {material}
      </mesh>
      {scalesFeatures.map((feature) => (
        <ScalesOverlay
          key={feature.id}
          feature={feature}
          geometry={bodyGeometry}
          offset={mainResult.offset}
          length={length}
          girth={girth}
          hasFeatures={hasFeatures}
          selected={feature.id === selectedFeatureId}
        />
      ))}
      {assembly.placed.map(({ seg, result, groupX, groupY, jointX }) => (
        <group key={seg.id}>
          {/* Outer group pivots at the JOINT (jointX — where JointMarker
              sits), for the Fase F swing (hinge/ball/flex tube). Inner group
              pivots at this segment's own centerline (mainResult.offset.y —
              every segment's centerline is aligned to the main body's, see
              the groupY comment above) so a "spinning tail" still rolls in
              place around its true length axis, independent of any joint
              swing the outer group is doing. */}
          <group
            ref={(el) => {
              if (el) jointPivotRefs.current.set(seg.id, el);
              else jointPivotRefs.current.delete(seg.id);
            }}
            position={[jointX, mainResult.offset.y, 0]}
          >
            <group
              ref={(el) => {
                if (el) spinPivotRefs.current.set(seg.id, el);
                else spinPivotRefs.current.delete(seg.id);
              }}
              position={[groupX - jointX, 0, 0]}
            >
              <mesh
                geometry={result.geometry}
                position={[0, groupY - mainResult.offset.y, 0]}
                castShadow
                receiveShadow
              >
                {material}
              </mesh>
            </group>
          </group>
          <JointMarker
            x={jointX}
            y={mainResult.offset.y}
            girth={Math.min(girth, seg.girth)}
            selected={activeSegmentId === seg.id}
          />
        </group>
      ))}
    </>
  );
}
