import { useRef, useMemo, useEffect, useState } from 'react';
import type { RefObject, PointerEvent as ReactPointerEvent } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import LureBody from './LureBody';
import FeatureMarkers from './FeatureMarkers';
import WeightBadge from './WeightBadge';
import UnderwaterEnvironment from './UnderwaterEnvironment';
import { useSceneStore } from '../store/useSceneStore';
import { useFeatureStore, type Feature } from '../store/useFeatureStore';
import { useSimulationStore, type WaterType } from '../store/useSimulationStore';
import { useProfileStore } from '../store/useProfileStore';
import { computeTotalWeightG, computeCenterOfGravity, toWorld, WATER_DENSITY_G_CM3 } from '../utils/physics';
import type { BuoyancyPart } from '../utils/buoyancy';
import { simulateFallStep, TANK_FLOOR_Y } from '../utils/simulationPhysics';
import { applyLipDivePitch, lipDiveDropMmPerS, lipWobbleAngularVelocityRadPerS, lipWobbleYawOffsetRad } from '../utils/lipEffects';
import { spinAngularVelocityRadPerS } from '../utils/retrieveEffects';
import { localToWorld, solveReelOrientation } from '../utils/reelOrientation';
import { computeTrajectory, sampleTrajectory, trajectoryYRange, type TrajectoryFrame } from '../utils/simulateTrajectory';
import PlaybackTimeline from './PlaybackTimeline';
import { StatusCard, ViewportToolbar } from './SimulateOverlays';
import SwimmingActionPanel from './SwimmingActionPanel';
import TrajectorySparkline from './TrajectorySparkline';
import ConditionsPanel from './ConditionsPanel';
import { useConditionsStore, type CurrentLevel } from '../store/useConditionsStore';
import { lightBrightness, visibilityForLight, currentDriftMmPerS } from '../utils/conditionsEffects';

const CAMERA_FOV_DEG = 45;
// The viewing direction stays fixed regardless of tank size — only the
// distance along it changes, so bigger/smaller lures get the same "look,"
// just zoomed to fit. Flatter than a true isometric angle (a shallower Y
// component relative to X/Z) — closer to eye-level, with the floor reading
// as a band low in frame and plenty of headroom above for a "Reel in"
// retrieve to rise into, per the open-water reference image this was
// matched against, instead of the steeper overhead-ish angle it replaces.
const CAMERA_DIRECTION = new THREE.Vector3(240, 90, 240).normalize();
// The world-space direction that reads as "screen right" for the (fixed)
// camera angle above — derived once via the same eye/target/up basis
// construction THREE.Matrix4.lookAt itself uses internally (right = up ×
// eyeToTarget, where CAMERA_DIRECTION already IS the normalized
// eye-minus-target vector, since camera.position = focusPoint +
// CAMERA_DIRECTION * distance). Only needs computing once — CAMERA_DIRECTION
// is a constant, never derived from the live camera. Used to anchor "Reel
// in"'s retrieve target relative to the LURE's own current position (see
// getAnglerAnchor) instead of a fixed tank coordinate.
const SCREEN_RIGHT_DIRECTION = new THREE.Vector3(0, 1, 0).cross(CAMERA_DIRECTION).normalize();
// How far back the camera sits, as a multiple of the LURE's own
// bounding-sphere radius (not the tank's) — small enough that the lure
// reads as a clearly recognizable, prominent shape filling a large share of
// the viewport width, matching the redesign's reference image, instead of
// the tank-fit-only framing this replaces (which correctly kept the whole
// tank in view, but at the cost of shrinking the lure itself to a barely
// visible speck).
const LURE_FIT_MARGIN = 1.9;
// Floor for the fit radius so a blank/tiny lure — or the very first paint,
// before LureBody's own effect has measured real dimensions (see
// useSceneStore's zeroed { l:0, w:0, h:0 } default) — never collapses the
// camera to a degenerate near-zero distance.
const MIN_FIT_RADIUS_MM = 40;

function lureFitRadius(dimensions: { l: number; w: number; h: number }): number {
  const diagonal = Math.sqrt(dimensions.l ** 2 + dimensions.w ** 2 + dimensions.h ** 2);
  return Math.max(diagonal / 2, MIN_FIT_RADIUS_MM);
}

/**
 * Camera position + OrbitControls target framed around the LURE's own
 * bounding box, centered on `focusPoint` — the tank is still visible around
 * it (the tank is only mildly bigger than the lure that sizes it, see
 * tankSpan/tankHeight below), but is no longer what the fit distance is
 * solved for, so the lure itself stays prominent regardless of how much
 * floor/headroom the tank happens to have.
 */
function computeCameraFraming(dimensions: { l: number; w: number; h: number }, focusPoint: THREE.Vector3) {
  const fovRad = THREE.MathUtils.degToRad(CAMERA_FOV_DEG);
  const distance = (lureFitRadius(dimensions) / Math.sin(fovRad / 2)) * LURE_FIT_MARGIN;
  const position = focusPoint.clone().addScaledVector(CAMERA_DIRECTION, distance);
  return { position, target: focusPoint.clone() };
}

// Where the passive (resize-triggered) reframe below anchors its Y — a
// fraction of the way up from the tank floor to the water surface, biased
// low so there's headroom above for a "Reel in" retrieve to rise into (the
// floor reads as a band near the bottom of the frame, not dead center).
// Deliberately NOT the lure's own live Y position: CameraFollow (below)
// only ever tracks X/Z, so this Y is what the camera stays locked to for as
// long as the lure's own size doesn't change — it needs to be a stable,
// considered default, not wherever the lure happened to be sitting the
// moment a resize last fired.
const VERTICAL_ANCHOR_FRACTION = 0.28;

/**
 * Re-frames the camera whenever the lure's own measured size changes — not
 * every frame, so it never fights the user's own manual orbit/zoom (the
 * live horizontal follow that DOES run every frame is CameraFollow, below).
 * Lives inside the Canvas (needs useThree) rather than being set via the
 * Canvas's `camera` prop, since that prop only seeds the camera once on
 * mount and wouldn't keep up as the lure is resized.
 */
function CameraFraming({
  dimensions,
  waterSurfaceY,
  orbitRef,
}: {
  dimensions: { l: number; w: number; h: number };
  waterSurfaceY: number;
  orbitRef: RefObject<OrbitControlsImpl | null>;
}) {
  const { camera } = useThree();
  // Applying this straight from a useLayoutEffect (as earlier versions did)
  // silently no-ops the OrbitControls half of the sync: r3f doesn't
  // guarantee a later JSX sibling's ref (`<OrbitControls ref={orbitRef}>`
  // is declared after this component) is attached yet by the time an
  // earlier sibling's layout effect runs, so `orbitRef.current` can still
  // be null here — `orbitRef.current.target.copy(...)` would then just be
  // skipped, leaving OrbitControls' own target stuck at its (0,0,0)
  // default forever while camera.position was still set correctly,
  // producing a permanently wrong offset (confirmed live: a camera stuck
  // looking down at a much steeper angle than CAMERA_DIRECTION intends).
  // A dirty flag applied inside useFrame sidesteps the whole ordering
  // question — by the time any useFrame callback runs, the Canvas has
  // fully mounted and every ref in it, including OrbitControls', is
  // guaranteed to be attached.
  const needsReframeRef = useRef(true);

  useEffect(() => {
    needsReframeRef.current = true;
  }, [dimensions.l, dimensions.w, dimensions.h, waterSurfaceY]);

  useFrame(() => {
    if (!needsReframeRef.current || !orbitRef.current) return;
    needsReframeRef.current = false;
    const focusY = TANK_FLOOR_Y + (waterSurfaceY - TANK_FLOOR_Y) * VERTICAL_ANCHOR_FRACTION;
    const focusPoint = new THREE.Vector3(0, focusY, 0);
    const { position, target } = computeCameraFraming(dimensions, focusPoint);
    camera.position.copy(position);
    orbitRef.current.target.copy(target);
    orbitRef.current.update();
    if (camera instanceof THREE.PerspectiveCamera) camera.updateProjectionMatrix();
  });

  return null;
}

export type CameraShortcut = 'side' | 'top' | 'front' | 'reset';

/** Fixed-axis framings for Fase B's viewport toolbar — same lure-fit distance math as computeCameraFraming, just viewed from a specific axis instead of the default isometric angle, and centered on the same live `focusPoint` (the lure's current position). */
function computeCameraShortcut(
  shortcut: CameraShortcut,
  dimensions: { l: number; w: number; h: number },
  focusPoint: THREE.Vector3,
) {
  if (shortcut === 'reset') return computeCameraFraming(dimensions, focusPoint);

  const fovRad = THREE.MathUtils.degToRad(CAMERA_FOV_DEG);
  const distance = (lureFitRadius(dimensions) / Math.sin(fovRad / 2)) * LURE_FIT_MARGIN;

  // Top uses a tiny X/Z nudge instead of a pure (0, Y, 0) offset — looking
  // straight down with an up vector of (0,1,0) is a degenerate camera
  // orientation (lookAt can't derive a stable "right" axis), which would
  // otherwise make OrbitControls' azimuth snap unpredictably.
  const direction =
    shortcut === 'side'
      ? new THREE.Vector3(1, 0, 0)
      : shortcut === 'front'
        ? new THREE.Vector3(0, 0, 1)
        : new THREE.Vector3(0.001, 1, 0.001).normalize();

  const position = focusPoint.clone().addScaledVector(direction, distance);
  return { position, target: focusPoint.clone() };
}

/**
 * Applies a one-shot camera shortcut (Fase B) whenever `commandRef` is set
 * from the DOM toolbar — polled in useFrame rather than reacting to a prop
 * change, since the command is a plain ref (no re-render) like the rest of
 * this view's interaction state. Reads the lure's CURRENT position off
 * dragState at the moment the shortcut fires, not a fixed world point, so
 * pressing Side/Top/Front/Reset mid-retrieve frames around where the lure
 * actually is right then — CameraFollow (below) then keeps tracking it from
 * that new angle/distance afterward.
 */
function CameraShortcutHandler({
  commandRef,
  dimensions,
  dragState,
  orbitRef,
}: {
  commandRef: RefObject<CameraShortcut | null>;
  dimensions: { l: number; w: number; h: number };
  dragState: RefObject<DragState>;
  orbitRef: RefObject<OrbitControlsImpl | null>;
}) {
  const { camera } = useThree();

  useFrame(() => {
    const command = commandRef.current;
    if (!command) return;
    commandRef.current = null;
    const st = dragState.current;
    const focusPoint = new THREE.Vector3(st.x, st.y, st.z);
    const { position, target } = computeCameraShortcut(command, dimensions, focusPoint);
    camera.position.copy(position);
    camera.lookAt(target);
    if (camera instanceof THREE.PerspectiveCamera) camera.updateProjectionMatrix();
    if (orbitRef.current) {
      orbitRef.current.target.copy(target);
      orbitRef.current.update();
    }
  });

  return null;
}

// How quickly (1/s) the camera's pivot point chases the lure's actual world
// position every frame — an exponential catch-up (like simulateFallStep's
// own velocity relax), not a hard snap, so sudden direction changes (Reel in
// starting/stopping) ease in rather than jump. High enough that even at 4x
// Speed the lure never outruns the frame; still gentle enough at 1x/0.25x to
// read as a smooth tracking shot rather than a jittery snap-to.
const CAMERA_FOLLOW_RATE = 10;

/**
 * Keeps the lure horizontally centered on screen, without ever moving the
 * camera to follow its vertical (sink/float/rise) motion — that split is
 * deliberate, not an oversight: horizontal drift (Current, or the
 * horizontal leg of a "Reel in" retrieve) is compensated away so the lure
 * never slides off to one side, but vertical motion is exactly what the
 * user is meant to see happening — a "Reel in" retrieve should visibly
 * climb through the frame, and releasing it should visibly show it sink
 * back down, not sit pinned to the same on-screen spot throughout.
 *
 * Every frame, the OrbitControls target's X/Z (only) are eased toward the
 * lure's live world X/Z (dragState.x/z, valid in both Live and Playback —
 * LureRig's own useFrame keeps it authoritative either way), and the camera
 * position is shifted by that exact same X/Z delta — preserving whatever
 * viewing direction/distance is currently set (the default angle, or
 * whatever Side/Top/Front/Reset or the user's own manual orbit last left it
 * at) instead of recomputing a fresh angle from scratch, so this only ever
 * shifts the pivot sideways, never the "framing style," and never its own
 * Y (camera.position.y and controls.target.y are simply never touched
 * here).
 *
 * Paused while the user is actively orbiting the camera or dragging the
 * lure by hand (OrbitControls' own 'start'/'end' events, plus the same
 * `orbitRef.current.enabled` flag LureRig's handlePointerDown/endDrag
 * already toggle for a lure-drag) so the auto-follow never fights a
 * deliberate manual adjustment.
 */
function CameraFollow({
  dragState,
  orbitRef,
}: {
  dragState: RefObject<DragState>;
  orbitRef: RefObject<OrbitControlsImpl | null>;
}) {
  const { camera } = useThree();
  const userInteractingRef = useRef(false);

  useEffect(() => {
    const controls = orbitRef.current;
    if (!controls) return;
    const onStart = () => {
      userInteractingRef.current = true;
    };
    const onEnd = () => {
      userInteractingRef.current = false;
    };
    controls.addEventListener('start', onStart);
    controls.addEventListener('end', onEnd);
    return () => {
      controls.removeEventListener('start', onStart);
      controls.removeEventListener('end', onEnd);
    };
  }, [orbitRef]);

  useFrame((_, rawDelta) => {
    const controls = orbitRef.current;
    if (!controls) return;
    // `enabled` is the same flag LureRig's handlePointerDown/endDrag toggle
    // off while the user is dragging the lure by hand — reuse it here too,
    // alongside our own start/end listener for a plain camera-orbit drag.
    if (!controls.enabled || userInteractingRef.current) return;

    const st = dragState.current;
    const dt = Math.min(rawDelta, 0.1);
    const t = 1 - Math.exp(-CAMERA_FOLLOW_RATE * dt);
    if (t <= 0) return;

    // Y held at whatever the target's own Y already is — lerping toward
    // itself is a no-op, so only X/Z actually move.
    const desired = new THREE.Vector3(st.x, controls.target.y, st.z);
    const before = controls.target.clone();
    controls.target.lerp(desired, t);
    const appliedDelta = controls.target.clone().sub(before);
    if (appliedDelta.lengthSq() === 0) return;
    camera.position.add(appliedDelta);
    controls.update();
  });

  return null;
}

// How far (in world mm) the reel-in anchor sits from the lure's own
// position at the moment it's set, along SCREEN_RIGHT_DIRECTION. Fixed —
// deliberately NOT a fraction of tankSpan — because REEL_SPEED_MMS (below)
// is also a fixed mm/s figure: tying this to tankSpan meant a small lure
// (tankSpan clamped to its 170mm floor) got a leg barely 76.5mm long, which
// REEL_SPEED_MMS covers in ~0.35s — "Reel in" would arrive and freeze
// almost the instant it was pressed, for as long as the button stayed held.
// This value instead targets a leg that takes noticeably longer than a
// single frame to close at REEL_SPEED_MMS — a deliberate, visible haul —
// consistently across every lure size, not just larger ones (which
// happened to get a longer leg from a bigger tankSpan more or less by
// accident). See LureRig's reelAnchorRef for how a held retrieve chains
// many of these legs back to back instead of freezing after the first one.
const REEL_LEG_HORIZONTAL_OFFSET_MM = 300;

// Standing in for an angler positioned to one side — always screen-right of
// wherever the lure currently is (originX/originZ), not a fixed tank
// coordinate. A fixed world point stopped working once the camera started
// following the lure horizontally (CameraFollow) and Current could drift it
// anywhere (currentDriftMmPerS in LureRig's idle branch): whichever side of
// a *fixed* point the lure happened to be on determined whether "Reel in"
// visibly pulled left or right, which flipped unpredictably once the lure
// drifted past that fixed point. Anchoring relative to the lure's own
// position instead guarantees "Reel in" always pulls right on screen,
// regardless of how far the lure has drifted or in which direction — see
// LureRig's reelAnchorRef for where this gets called: once when a retrieve
// starts, and again every time the lure nearly reaches the current leg's
// anchor while still held, so a long hold chains one screen-right leg after
// another instead of freezing after the first.
function getAnglerAnchor(originX: number, originZ: number, waterSurfaceY: number, tankSpan: number): THREE.Vector3 {
  const offset = REEL_LEG_HORIZONTAL_OFFSET_MM;
  return new THREE.Vector3(
    originX + SCREEN_RIGHT_DIRECTION.x * offset,
    waterSurfaceY + tankSpan * 0.15,
    originZ + SCREEN_RIGHT_DIRECTION.z * offset,
  );
}

// --- Reel-in constants ---
// A press-and-hold retrieve, not a physically-driven force model like the
// fall/float simulation — these just shape a plausible-looking curved
// retrieve path (see LureRig's useFrame for how they combine).
const REEL_SPEED_MMS = 220; // constant horizontal "line coming in" speed, before the Speed slider
const REEL_VERTICAL_BASE_RATE = 0.6; // 1/s, gentle rise while still far from the anchor horizontally
const REEL_VERTICAL_BOOST_RATE = 2.6; // 1/s, extra rise rate that kicks in as the horizontal gap closes
// How close (world mm) the lure needs to get to the current reel-in leg's
// anchor before the NEXT leg is set — well above the 0.5mm "arrived, stop
// moving" threshold below, so the hand-off to a fresh anchor happens while
// there's still enough distance left to blend smoothly into the next leg's
// own direction/orientation, rather than at the exact moment motion would
// otherwise have stopped.
const REEL_LEG_REFRESH_DISTANCE_MM = 15;
const YAW_DECAY_RATE = 2.5; // 1/s, how fast leftover yaw settles back to 0 once physics resumes after release
// Pitch computed straight from the remaining-distance vector inevitably
// swings toward vertical right at the end of any retrieve (horizontal error
// hits ~0 before vertical does, so the direction vector degenerates to
// "straight up") — capping well below MAX_PITCH_RAD keeps the nose visibly
// "schuin" (oblique) throughout instead of snapping upright near the anchor.
const REEL_MAX_PITCH_RAD = THREE.MathUtils.degToRad(35);

export interface DragState {
  x: number;
  y: number;
  z: number;
  pitch: number;
  yaw: number;
  velocityY: number;
  angularVelocity: number;
  dragging: boolean;
  // Diving-lip wobble phase (radians, unbounded) — only advances/used while
  // reeling with a lip feature present; see lipEffects.ts.
  lipWobblePhase: number;
  // Whole-lure "spinning tail" roll (radians, unbounded) — only used when
  // the MAIN body itself is set to spinningTail (a segment spinning is
  // handled separately, inside LureBody, since only the segment's own mesh
  // should roll then, not the whole rig). See retrieveEffects.ts.
  mainRollAngle: number;
}

export type SimMode = 'live' | 'playback';

/**
 * Fase C's playable timeline: whether the rig's transform is currently
 * driven by live physics/interaction (reeling, dragging, natural sink/
 * float) or by scrubbing through the precomputed `trajectory` recording.
 * Plain refs throughout — read every frame inside LureRig's useFrame and
 * written directly from DOM/UI event handlers (PlaybackTimeline.tsx),
 * never React state, so neither playing back nor scrubbing ever triggers a
 * re-render of the Canvas tree (same reasoning as dragState/reelingRef).
 */
export interface PlaybackControl {
  modeRef: RefObject<SimMode>;
  isPlayingRef: RefObject<boolean>;
  playbackTimeRef: RefObject<number>;
  trajectory: TrajectoryFrame[];
  durationS: number;
}

/**
 * A thin tube from a lineTie feature's current world position (following
 * the lure as it sinks/floats/tilts) up to the current angler anchor.
 * Rendered as a sibling of the lure's rotating/translating group, not a
 * child of it — the anchor end must stay fixed in world space while only
 * the attachment end follows the lure, so the curve is rebuilt in world
 * coordinates every frame here rather than inheriting a parent transform.
 *
 * `anchor` is a ref, not a plain Vector3 prop — the anchor itself can change
 * (LureRig's reelAnchorRef is re-pointed at the start of every "Reel in"),
 * and since that happens outside React state (a plain ref write, like
 * dragState), reading `anchor.current` fresh every frame here is what makes
 * the line immediately snap to a new anchor the moment one is set, instead
 * of rendering with whatever anchor happened to be captured at mount.
 */
function FishingLine({
  feature,
  bodyOffset,
  dragState,
  anchor,
}: {
  feature: Feature;
  bodyOffset: { x: number; y: number };
  dragState: RefObject<DragState>;
  anchor: RefObject<THREE.Vector3>;
}) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const localPoint = useMemo(() => toWorld(feature.position, bodyOffset), [feature.position, bodyOffset]);

  useFrame(() => {
    const st = dragState.current;
    const attachPoint = localToWorld(localPoint, st.x, st.y, st.z, st.yaw, st.pitch);

    const curve = new THREE.CatmullRomCurve3([attachPoint, anchor.current]);
    const nextGeometry = new THREE.TubeGeometry(curve, 8, 0.35, 6, false);
    meshRef.current.geometry.dispose();
    meshRef.current.geometry = nextGeometry;
  });

  return (
    <mesh ref={meshRef}>
      <tubeGeometry args={[new THREE.CatmullRomCurve3([new THREE.Vector3(), anchor.current]), 8, 0.35, 6, false]} />
      <meshBasicMaterial color="#d8dce0" transparent opacity={0.55} depthWrite={false} />
    </mesh>
  );
}

interface PhysicsInputs {
  totalWeightG: number;
  // Mesh-local frame (belly at y=0, main body centered at x=0) — matches
  // BuoyancyPart's groupX and computeSubmerged's centroidX/centroidY.
  cogX: number;
  cogY: number;
  centerlineY: number;
  bodyParts: BuoyancyPart[];
}

/**
 * The position-independent inputs to the physics loop: total weight and the
 * center of gravity's position don't change from frame to frame (they're
 * intrinsic to the design), unlike submerged volume/center of buoyancy,
 * which depend on where the body currently is — those are recomputed every
 * frame inside LureRig's useFrame instead.
 */
function usePhysicsInputs(): PhysicsInputs {
  const bodyWeightG = useSceneStore((s) => s.bodyWeightG);
  const bodyCentroid = useSceneStore((s) => s.bodyCentroid);
  const bodyOffset = useSceneStore((s) => s.bodyOffset);
  const bodyParts = useSceneStore((s) => s.bodyParts);
  const features = useFeatureStore((s) => s.features);

  return useMemo(() => {
    const totalWeightG = computeTotalWeightG(bodyWeightG, features);
    const cog = computeCenterOfGravity(
      bodyWeightG,
      new THREE.Vector3(bodyCentroid.x, bodyCentroid.y, bodyCentroid.z),
      bodyOffset,
      features,
    );
    return { totalWeightG, cogX: cog.x, cogY: cog.y, centerlineY: bodyOffset.y, bodyParts };
  }, [bodyWeightG, bodyCentroid, bodyOffset, bodyParts, features]);
}

function LureRig({
  physics,
  waterSurfaceY,
  waterType,
  currentLevel,
  tankSpan,
  reelingRef,
  orbitRef,
  dragState,
  playback,
}: {
  physics: PhysicsInputs;
  waterSurfaceY: number;
  waterType: WaterType;
  currentLevel: CurrentLevel;
  tankSpan: number;
  reelingRef: RefObject<boolean>;
  orbitRef: RefObject<OrbitControlsImpl | null>;
  dragState: RefObject<DragState>;
  playback: PlaybackControl;
}) {
  const groupRef = useRef<THREE.Group>(null!);
  const rollGroupRef = useRef<THREE.Group>(null!);
  const bodyMeshRef = useRef<THREE.Mesh>(null!);
  const dimensions = useSceneStore((s) => s.dimensions);
  const bodyOffset = useSceneStore((s) => s.bodyOffset);
  const features = useFeatureStore((s) => s.features);
  const lineTieFeatures = features.filter((f) => f.type === 'lineTie');
  // The reel-in target: re-pointed once, at the moment "Reel in" starts
  // (see the reelingRef edge-detection at the top of useFrame below), always
  // screen-right of wherever the lure was AT THAT MOMENT — never recomputed
  // continuously while held (that would make the target "flee" at the same
  // speed the lure closes in, so it would never actually arrive — see
  // getAnglerAnchor's own comment for the full "why"). Seeded here with a
  // real anchor (not a placeholder) from the lure's spawn position, so the
  // fishing line has something sensible to point at before "Reel in" has
  // ever been pressed.
  const reelAnchorRef = useRef<THREE.Vector3>(
    getAnglerAnchor(dragState.current.x, dragState.current.z, waterSurfaceY, tankSpan),
  );
  const wasReelingRef = useRef(false);
  // Only the first lip matters for the dive/wobble effect — a lure with a
  // bill only ever has one in practice, and stacking several would just
  // double the same effect rather than mean anything new.
  const lipFeature = features.find((f) => f.type === 'lip');
  const mainRetrieveAction = useProfileStore((s) => s.retrieveAction);
  const speed = useSimulationStore((s) => s.speed);
  // Shared by LureBody (per-segment spinning tail) and FeatureMarkers
  // (spinner-blade spin) — one object so both effects read the exact same
  // reeling state and effective speed every frame.
  const spinDriver = useMemo(
    () => ({ reelingRef, speed, reelSpeedMmS: REEL_SPEED_MMS }),
    [reelingRef, speed],
  );
  // How far (horizontally) one reel-in leg starts — used to scale when the
  // vertical "rise" boost kicks in. Same fixed constant getAnglerAnchor
  // itself uses, since that's exactly what this distance is by definition.
  const reelCurveSpanMm = REEL_LEG_HORIZONTAL_OFFSET_MM;

  useFrame((_, rawDelta) => {
    const st = dragState.current;
    const dt = Math.min(rawDelta, 0.1) * speed; // clamp huge frame gaps (tab switches etc.), Speed slider applies here too

    // Re-point the reel-in target — screen-right of wherever the lure is AT
    // THIS MOMENT — in two cases: right as "Reel in" starts being held
    // (false→true edge), and again whenever the lure has nearly closed the
    // gap to its CURRENT leg's anchor while still held. Without that second
    // case, a single leg (REEL_LEG_HORIZONTAL_OFFSET_MM at REEL_SPEED_MMS)
    // gets fully closed in about a second, after which the whole
    // `totalDist > 0.5` block below stops running — position, orientation,
    // wobble, roll, all of it — for as long as the button stays held after
    // that, reading as "arrives, then freezes." Chaining a fresh leg the
    // moment the old one is nearly done keeps the retrieve moving
    // continuously for the whole hold instead. Deliberately NOT recomputed
    // every single frame while held (only at these two trigger points): see
    // getAnglerAnchor's comment for why that would make the target "flee"
    // at the same rate the lure closes the gap and never actually arrive.
    if (reelingRef.current) {
      const anchor = reelAnchorRef.current;
      const distToAnchor = Math.hypot(anchor.x - st.x, anchor.y - st.y, anchor.z - st.z);
      if (!wasReelingRef.current || distToAnchor <= REEL_LEG_REFRESH_DISTANCE_MM) {
        reelAnchorRef.current = getAnglerAnchor(st.x, st.z, waterSurfaceY, tankSpan);
      }
    }
    wasReelingRef.current = reelingRef.current;

    if (playback.modeRef.current === 'playback') {
      // Scrubbing through the precomputed recording (Fase C) instead of
      // driving live physics — Speed above doubles as playback speed here,
      // same dt already used everywhere else. The recording only models
      // the passive drop/settle (see simulateTrajectory.ts), so x/z/yaw
      // stay at 0 for its duration; switching back to Live (reeling or
      // dragging) picks up from whatever depth/pitch playback left it at.
      if (playback.isPlayingRef.current && dt > 0) {
        const next = (playback.playbackTimeRef.current ?? 0) + dt;
        if (next >= playback.durationS) {
          playback.playbackTimeRef.current = playback.durationS;
          playback.isPlayingRef.current = false; // stop at the end, don't loop past it
        } else {
          playback.playbackTimeRef.current = next;
        }
      }
      const frame = sampleTrajectory(playback.trajectory, playback.playbackTimeRef.current ?? 0);
      st.x = 0;
      st.z = 0;
      st.y = frame.positionY;
      st.pitch = frame.pitch;
      st.yaw = 0;
      st.velocityY = 0;
      st.angularVelocity = 0;
      st.dragging = false;
    } else if (reelingRef.current) {
      const anchor = reelAnchorRef.current;
      const dx = anchor.x - st.x;
      const dy = anchor.y - st.y;
      const dz = anchor.z - st.z;
      const horizontalDist = Math.hypot(dx, dz);
      const totalDist = Math.hypot(dx, dy, dz);

      if (totalDist > 0.5) {
        // Horizontal: close the gap at a roughly constant "reeling line in"
        // speed. Vertical: rise slowly while still far out, then rise much
        // faster as the horizontal gap closes — together these trace a
        // curved retrieve path (level-ish start, climbing near the anchor)
        // instead of a straight diagonal line.
        if (horizontalDist > 1e-6) {
          const hStep = Math.min(REEL_SPEED_MMS * dt, horizontalDist);
          st.x += (dx / horizontalDist) * hStep;
          st.z += (dz / horizontalDist) * hStep;
        }
        const closeness = 1 - THREE.MathUtils.clamp(horizontalDist / reelCurveSpanMm, 0, 1);
        const riseRate = REEL_VERTICAL_BASE_RATE + closeness * REEL_VERTICAL_BOOST_RATE;
        st.y += dy * (1 - Math.exp(-riseRate * dt));

        // Face the direction of travel: solveReelOrientation (reelOrientation.ts)
        // finds the (yaw, pitch) that makes NOSE_LOCAL_DIRECTION point along
        // (dx,dy,dz) — verified against the actual rendered rotation (Euler
        // order 'YXZ') and against generateLureMesh.ts's own nose placement,
        // so this can't silently drift out of sync with the mesh again. The
        // raw direction-vector pitch naturally swings toward straight-up
        // (±90°) right at the end of any retrieve, once horizontal error
        // has closed to ~0 but vertical hasn't — REEL_MAX_PITCH_RAD (a
        // tighter cap than MAX_PITCH_RAD, the buoyancy math's own limit)
        // keeps the retrieve reading as "coming in from the side, a bit
        // oblique" throughout, never nose-straight-up.
        const orientation = solveReelOrientation(dx, dy, dz, REEL_MAX_PITCH_RAD);
        st.pitch = orientation.pitch;
        st.yaw = orientation.yaw;

        // Diving lip: blends pitch toward the lip's dive target (0°=no
        // effect, 90°=as close to straight down as the physics safely
        // allows — see lipEffects.ts's applyLipDivePitch) and pulls the
        // actual trajectory down (a pitch-only version doesn't touch st.y
        // at all, so the body would still rise at the exact same rate as a
        // lip-less lure — see lipDiveDropMmPerS), plus a side-to-side
        // wobble whose speed tracks the actual reel speed. Lures without a
        // lip are completely unaffected.
        if (lipFeature) {
          const lipAngleDeg = lipFeature.lipAngleDeg ?? 45;
          st.pitch = applyLipDivePitch(st.pitch, lipAngleDeg);
          st.y = Math.max(TANK_FLOOR_Y, st.y - lipDiveDropMmPerS(lipAngleDeg) * dt);
          st.lipWobblePhase += lipWobbleAngularVelocityRadPerS(REEL_SPEED_MMS * speed) * dt;
          st.yaw += lipWobbleYawOffsetRad(st.lipWobblePhase);
        }

        // Spinning tail (Fase 3), main-body case: when the MAIN body itself
        // is set to spin, the whole rig rolls together (body + markers),
        // via rollGroupRef below — a per-segment spin instead rolls just
        // that segment's own mesh, handled inside LureBody.
        if (mainRetrieveAction === 'spinningTail') {
          st.mainRollAngle += spinAngularVelocityRadPerS(REEL_SPEED_MMS * speed) * dt;
        }
      }
      st.velocityY = 0;
      st.angularVelocity = 0;
      st.dragging = false;
    } else {
      // With a line tie present, the still-taut fishing line (drawn from
      // the current attach point straight to the fixed anchor regardless of
      // reeling state — see FishingLine) keeps implying a pull toward the
      // angler even when not actively holding "Reel in". Settling back to a
      // fixed yaw=0 ignored that, so a released/floating/sinking lure could
      // end up visibly facing away from its own taut line. Ease toward
      // whatever yaw currently faces the anchor from here instead — with no
      // line tie there's nothing to face, so it settles to 0 as before.
      const targetYaw =
        lineTieFeatures.length > 0
          ? solveReelOrientation(
              reelAnchorRef.current.x - st.x,
              reelAnchorRef.current.y - st.y,
              reelAnchorRef.current.z - st.z,
              REEL_MAX_PITCH_RAD,
            ).yaw
          : 0;
      if (dt > 0) st.yaw += (targetYaw - st.yaw) * Math.min(1, YAW_DECAY_RATE * dt);

      if (!st.dragging && dt > 0) {
        const next = simulateFallStep(
          { positionY: st.y, velocityY: st.velocityY, pitch: st.pitch, angularVelocity: st.angularVelocity },
          {
            bodyParts: physics.bodyParts,
            centerlineY: physics.centerlineY,
            waterSurfaceY,
            totalWeightG: physics.totalWeightG,
            cogX: physics.cogX,
            cogY: physics.cogY,
            waterDensityGCm3: WATER_DENSITY_G_CM3[waterType],
          },
          dt,
        );
        st.y = next.positionY;
        st.velocityY = next.velocityY;
        st.pitch = next.pitch;
        st.angularVelocity = next.angularVelocity;

        // Fase E's Current condition: a small constant sideways drift on
        // top of the calibrated sink/float model above — never feeding into
        // simulateFallStep itself, so the calibrated sink-rate curve stays
        // exactly as tested regardless of this. See conditionsEffects.ts
        // for why lighter lures drift more than heavy/dense ones.
        st.x += currentDriftMmPerS(currentLevel, physics.totalWeightG) * dt;
      }
    }

    if (
      !Number.isFinite(st.x) ||
      !Number.isFinite(st.y) ||
      !Number.isFinite(st.z) ||
      !Number.isFinite(st.pitch) ||
      !Number.isFinite(st.yaw)
    ) {
      st.x = 0;
      st.y = waterSurfaceY;
      st.z = 0;
      st.pitch = 0;
      st.yaw = 0;
      st.velocityY = 0;
      st.angularVelocity = 0;
    }

    if (groupRef.current) {
      groupRef.current.position.set(st.x, st.y, st.z);
      groupRef.current.rotation.order = 'YXZ';
      groupRef.current.rotation.set(0, st.yaw, st.pitch);
    }
    // Nested INSIDE groupRef so this roll is applied to the raw body-local
    // vectors first, before yaw/pitch reorient the whole rig — the only way
    // to get a roll that's truly "around the body's own nose-tail axis"
    // regardless of its current pitch/yaw, since Euler order 'YXZ' above
    // has no free slot left for a third, independent rotation.
    if (rollGroupRef.current) rollGroupRef.current.rotation.x = st.mainRollAngle;
  });

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (reelingRef.current) return; // Reel in owns motion while held — don't fight it with a drag
    playback.modeRef.current = 'live'; // hands-on interaction always takes over from a scrubbed recording
    playback.isPlayingRef.current = false;
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragState.current.dragging = true;
    if (orbitRef.current) orbitRef.current.enabled = false;
  };

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!dragState.current.dragging || reelingRef.current) return;
    const movementY = e.nativeEvent.movementY ?? 0;
    dragState.current.y -= movementY * 0.5;
  };

  const endDrag = (e: ThreeEvent<PointerEvent>) => {
    if (!dragState.current.dragging) return;
    dragState.current.dragging = false;
    // Resume the physics model from rest at wherever the drag left it,
    // rather than carrying over any velocity from the drag gesture itself.
    dragState.current.velocityY = 0;
    dragState.current.angularVelocity = 0;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    if (orbitRef.current) orbitRef.current.enabled = true;
  };

  const hitWidth = Math.max(dimensions.l, 10);
  const hitHeight = Math.max(dimensions.h, 10);
  const hitDepth = Math.max(dimensions.w, 10);

  return (
    <>
      <group ref={groupRef} position={[0, waterSurfaceY, 0]}>
        {/* Carries only the main-body "spinning tail" roll (rotation.x) —
            nested here, inside groupRef's own yaw/pitch, so the roll is
            always around the body's own current nose-tail axis. */}
        <group ref={rollGroupRef}>
          <LureBody meshRef={bodyMeshRef} spin={spinDriver} opaque />
          <FeatureMarkers spin={spinDriver} />
          <mesh
            position={[0, hitHeight / 2, 0]}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={endDrag}
            onPointerLeave={endDrag}
          >
            <boxGeometry args={[hitWidth, hitHeight, hitDepth]} />
            {/* Fully transparent but still raycast-hittable — visible={false}
                meshes are skipped by r3f's pointer events entirely. */}
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        </group>
      </group>
      {/* Rendered outside the group above: the line's anchor end must stay
          fixed in world space while only its attachment end follows the
          lure, so it can't inherit the group's own position/rotation. */}
      {lineTieFeatures.map((feature) => (
        <FishingLine key={feature.id} feature={feature} bodyOffset={bodyOffset} dragState={dragState} anchor={reelAnchorRef} />
      ))}
    </>
  );
}

/**
 * Press-and-hold control: a plain DOM button (outside the Canvas), so it
 * uses ordinary Pointer Events rather than r3f's raycasting — pointerdown/
 * up/leave/cancel all fire the same way for mouse, touch, and pen. Writes
 * straight into reelingRef; LureRig's useFrame reads it every frame, so
 * holding/releasing never causes a React re-render.
 */
function ReelInButton({ reelingRef, playback }: { reelingRef: RefObject<boolean>; playback: PlaybackControl }) {
  const start = (e: ReactPointerEvent<HTMLButtonElement>) => {
    playback.modeRef.current = 'live'; // hands-on interaction always takes over from a scrubbed recording
    playback.isPlayingRef.current = false;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    reelingRef.current = true;
  };
  const stop = (e: ReactPointerEvent<HTMLButtonElement>) => {
    reelingRef.current = false;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  return (
    <button
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        padding: '6px 14px',
        borderRadius: 6,
        border: '1px solid var(--accent)',
        background: 'var(--accent-dim)',
        color: 'var(--text-primary)',
        fontSize: 12,
        fontWeight: 600,
        touchAction: 'none',
        userSelect: 'none',
      }}
    >
      Reel in
    </button>
  );
}

/**
 * Fase B's "Path" toggle: a visual trace of the precomputed recording
 * (Fase C) — since that recording only models the passive drop/settle
 * (x=z=0 throughout, see simulateTrajectory.ts), this is a vertical
 * depth-range indicator rather than a curved 3D path, which honestly
 * reflects what's actually being recorded instead of implying lateral
 * motion the physics doesn't model.
 */
function TrajectoryPathLine({ trajectory }: { trajectory: TrajectoryFrame[] }) {
  const { min, max } = trajectoryYRange(trajectory);
  if (!(max > min)) return null;
  const mid = (min + max) / 2;
  const length = max - min;
  return (
    <mesh position={[0, mid, 0]}>
      <cylinderGeometry args={[0.6, 0.6, length, 8]} />
      <meshBasicMaterial color="#ffb020" transparent opacity={0.7} depthWrite={false} />
    </mesh>
  );
}

const WATER_LABELS: Record<WaterType, string> = { fresh: 'Fresh', salt: 'Salt' };

// How far ahead the passive drop/settle recording (Fase C) covers — long
// enough to see a lure fully settle, short enough to compute instantly.
const TRAJECTORY_DURATION_S = 20;
const TRAJECTORY_DT_S = 1 / 30;

export default function SimulateView() {
  const waterType = useSimulationStore((s) => s.waterType);
  const setWaterType = useSimulationStore((s) => s.setWaterType);
  const speed = useSimulationStore((s) => s.speed);
  const setSpeed = useSimulationStore((s) => s.setSpeed);
  const dimensions = useSceneStore((s) => s.dimensions);
  const length = dimensions.l;
  const orbitRef = useRef<OrbitControlsImpl>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  // Plain ref, not React state: read every frame inside LureRig's useFrame,
  // so holding/releasing the button never triggers a re-render — same
  // pattern as dragState.
  const reelingRef = useRef(false);
  const cameraCommandRef = useRef<CameraShortcut | null>(null);
  const [showPath, setShowPath] = useState(false);

  // No longer a visible box (see UnderwaterEnvironment.tsx — the tank walls
  // were removed in favor of an open, horizon-less underwater scene) —
  // waterSurfaceY still matters as the actual float/sink boundary the
  // physics uses, and tankSpan still scales the angler anchor and the
  // "area of interest" god-rays/floor-dressing/fog sit around.
  const tankHeight = Math.max(320, length * 2.6);
  const waterSurfaceY = tankHeight * 0.85;
  const tankSpan = Math.max(170, length * 1.6);

  const physics = usePhysicsInputs();

  const light = useConditionsStore((s) => s.light);
  const currentLevel = useConditionsStore((s) => s.current);

  // Fase D's Swimming Action panel reads these same configuration values —
  // duplicated here (cheap: filtering/reading a store) rather than lifting
  // LureRig's own copies up, since LureRig already has everything it needs.
  const features = useFeatureStore((s) => s.features);
  const lipFeature = features.find((f) => f.type === 'lip');
  const mainRetrieveAction = useProfileStore((s) => s.retrieveAction);

  // Fase C: the rig's transform when not doing anything live — created here
  // (not inside LureRig) so the status card (Fase B) and other overlays can
  // read the current depth/pitch too, in both Live and Playback modes.
  const dragState = useRef<DragState>({
    x: 0,
    y: waterSurfaceY,
    z: 0,
    pitch: 0,
    yaw: 0,
    velocityY: 0,
    angularVelocity: 0,
    dragging: false,
    lipWobblePhase: 0,
    mainRollAngle: 0,
  });
  const modeRef = useRef<SimMode>('live');
  const isPlayingRef = useRef(false);
  const playbackTimeRef = useRef(0);

  const trajectory = useMemo(
    () =>
      computeTrajectory(
        {
          bodyParts: physics.bodyParts,
          centerlineY: physics.centerlineY,
          waterSurfaceY,
          totalWeightG: physics.totalWeightG,
          cogX: physics.cogX,
          cogY: physics.cogY,
          waterDensityGCm3: WATER_DENSITY_G_CM3[waterType],
        },
        waterSurfaceY,
        TRAJECTORY_DURATION_S,
        TRAJECTORY_DT_S,
      ),
    [physics, waterSurfaceY, waterType],
  );

  const playback: PlaybackControl = useMemo(
    () => ({ modeRef, isPlayingRef, playbackTimeRef, trajectory, durationS: TRAJECTORY_DURATION_S }),
    [trajectory],
  );

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '10px 12px',
          borderBottom: '1px solid var(--border-subtle)',
          flexShrink: 0,
          flexWrap: 'wrap',
        }}
      >
        <WeightBadge water={waterType} style={{ position: 'static', transform: 'none' }} />

        <ReelInButton reelingRef={reelingRef} playback={playback} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Speed</span>
          <input
            type="range"
            min={0.25}
            max={4}
            step={0.25}
            value={speed}
            onChange={(e) => setSpeed(parseFloat(e.target.value))}
            style={{ width: 100 }}
          />
          <span style={{ fontSize: 12, color: 'var(--text-dim)', width: 32 }}>{speed}&times;</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Water</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['fresh', 'salt'] as WaterType[]).map((w) => {
              const active = waterType === w;
              return (
                <button
                  key={w}
                  onClick={() => setWaterType(w)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: 5,
                    border: '1px solid ' + (active ? 'var(--accent)' : 'var(--border-subtle)'),
                    background: active ? 'var(--accent-dim)' : 'transparent',
                    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontSize: 12,
                    fontWeight: 500,
                  }}
                >
                  {WATER_LABELS[w]}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div ref={viewportRef} style={{ flex: 1, position: 'relative', background: 'var(--bg-app)', minHeight: 0 }}>
        <Canvas
          shadows
          camera={{ position: [220, 160, 220], fov: CAMERA_FOV_DEG, near: 1, far: 5000 }}
          gl={{ localClippingEnabled: true }}
        >
          <UnderwaterEnvironment tankSpan={tankSpan} waterSurfaceY={waterSurfaceY} brightness={lightBrightness(light)} />
          <ambientLight intensity={0.4} />
          <directionalLight position={[150, 250, 150]} intensity={0.9} castShadow />
          <directionalLight position={[-150, 100, -150]} intensity={0.3} />

          <LureRig
            physics={physics}
            waterSurfaceY={waterSurfaceY}
            waterType={waterType}
            currentLevel={currentLevel}
            tankSpan={tankSpan}
            reelingRef={reelingRef}
            orbitRef={orbitRef}
            dragState={dragState}
            playback={playback}
          />
          {showPath && <TrajectoryPathLine trajectory={trajectory} />}

          {/* Reframes on lure-size change only — CameraFollow (every frame)
              and the user's own manual orbit/zoom otherwise freely own the
              camera in between. */}
          <CameraFraming dimensions={dimensions} waterSurfaceY={waterSurfaceY} orbitRef={orbitRef} />
          <CameraShortcutHandler
            commandRef={cameraCommandRef}
            dimensions={dimensions}
            dragState={dragState}
            orbitRef={orbitRef}
          />
          <CameraFollow dragState={dragState} orbitRef={orbitRef} />
          <OrbitControls ref={orbitRef} makeDefault enableDamping dampingFactor={0.08} />
        </Canvas>

        <StatusCard
          dragState={dragState}
          waterSurfaceY={waterSurfaceY}
          temperatureC={waterType === 'salt' ? 18.4 : 16.2}
          visibilityM={visibilityForLight(light)}
        />
        <ViewportToolbar
          cameraCommandRef={cameraCommandRef}
          showPath={showPath}
          onTogglePath={() => setShowPath((v) => !v)}
        />
      </div>

      <PlaybackTimeline playback={playback} speed={speed} viewportRef={viewportRef} />

      {/* Fase D: swim-action summary + a depth-over-time preview of the
          same recording the timeline scrubs through. */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 24,
          padding: '14px 16px',
          borderTop: '1px solid var(--border-subtle)',
          flexShrink: 0,
        }}
      >
        <div style={{ flex: '1 1 320px' }}>
          <SwimmingActionPanel
            trajectory={trajectory}
            waterSurfaceY={waterSurfaceY}
            dragState={dragState}
            hasLip={!!lipFeature}
            lipAngleDeg={lipFeature?.lipAngleDeg ?? 0}
            spinningTail={mainRetrieveAction === 'spinningTail'}
            reelSpeed={speed}
          />
        </div>
        <div style={{ flex: '0 0 auto' }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 10 }}>
            Trajectory Preview
          </div>
          <TrajectorySparkline trajectory={trajectory} playback={playback} dragState={dragState} />
        </div>
        <div style={{ flex: '0 0 200px' }}>
          <ConditionsPanel />
        </div>
      </div>

      {/* Laid out below the canvas (not overlaid on top of it) so it can
          never cover the tank floor — a resting lure used to end up hidden
          behind this bar for most tank sizes. */}
      <div
        style={{
          flexShrink: 0,
          fontSize: 11,
          color: 'var(--text-dim)',
          borderTop: '1px solid var(--border-subtle)',
          padding: '8px 12px',
          lineHeight: 1.5,
        }}
      >
        This is an estimate. A real lure is also affected by water temperature, your line and
        hooks, paint and clear-coat thickness, and how well the body is sealed — expect the
        tank to be close, not exact.
      </div>
    </div>
  );
}
