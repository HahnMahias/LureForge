import * as THREE from 'three';
import { Brush, Evaluator, ADDITION, SUBTRACTION } from 'three-bvh-csg';
import { sampleClosedCurve } from './curveMath';
import { hollowGeometry } from './meshShell';
import type { Feature } from '../store/useFeatureStore';

/**
 * Shared body-local mm frame every marker in FeatureMarkers.tsx places
 * itself in: x/z unchanged, y re-centered on the mesh's own vertical offset
 * (see generateLureMesh.ts). Also used here (finGeometry.ts) so a fin's CSG
 * brushes line up with exactly where FeatureMarkers.tsx would have drawn
 * each fin individually.
 */
export function toWorld(
  pos: { x: number; y: number; z: number },
  offset: { x: number; y: number },
): [number, number, number] {
  return [pos.x - offset.x, pos.y + offset.y, pos.z];
}

/**
 * Builds one fin feature's own extrude geometry (outline -> shape -> extrude,
 * with Fase C's edge rounding/hollowing applied), in the fin's own local
 * frame — i.e. before `position`/`rotation` are applied. Shared by the
 * plain single-fin render path, the Fase D/E CSG cluster path below, and
 * ExportPanel's STL export, so all three always agree on what a fin
 * actually looks like.
 */
export function buildFinLocalGeometry(feature: Feature): THREE.BufferGeometry | null {
  const outline = feature.finOutline ?? [];
  if (outline.length < 3) return null;
  const thickness = feature.finThickness ?? 1.5;
  // Clamped so bevelSize/bevelThickness can never reach half the fin's own
  // thickness — ExtrudeGeometry's bevel is applied from both faces, so an
  // unclamped value could make the two bevels overlap and invert the mesh.
  const edgeRounding = Math.min(feature.finEdgeRoundingMm ?? 0, thickness / 2 - 0.02);
  const areaThicknessPct = feature.finAreaThicknessPct ?? 100;

  const smoothed = sampleClosedCurve(outline, 8);
  const shape = new THREE.Shape(smoothed.map((p) => new THREE.Vector2(p.x, p.y)));
  const bevelEnabled = edgeRounding > 0.01;
  let geo: THREE.BufferGeometry = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled,
    bevelThickness: edgeRounding,
    bevelSize: edgeRounding,
    bevelSegments: bevelEnabled ? 3 : 1,
  });
  geo.translate(0, 0, -thickness / 2);

  if (areaThicknessPct < 100) {
    // Same vertex-normal-offset shell technique meshShell.ts already uses
    // for the hollow body — wallThickness clamped to thickness/2 so the
    // inner offset surface can't cross through the opposite face.
    const wallThicknessMm = Math.min(thickness * (areaThicknessPct / 100), thickness / 2 - 0.02);
    if (wallThicknessMm > 0.02) geo = hollowGeometry(geo, wallThicknessMm);
  }

  geo.computeVertexNormals();
  return geo;
}

/**
 * Fase E — the cavity a 'separatePart' fin needs carved into the body: the
 * same outline, inflated outward from its own centroid by `clearanceMm` so
 * the printed fin can actually slide in, with the extrude depth padded by
 * clearance on both faces too. This is a simple radial-offset approximation
 * (not a true 2D polygon buffer/Minkowski sum) — fine for the gently convex
 * outlines a fin realistically has, but a very concave/notched outline could
 * end up with slightly uneven clearance at reflex corners.
 */
export function buildFinCavityLocalGeometry(
  feature: Feature,
  clearanceMm: number,
): THREE.BufferGeometry | null {
  const outline = feature.finOutline ?? [];
  if (outline.length < 3) return null;
  const thickness = feature.finThickness ?? 1.5;
  const cx = outline.reduce((sum, p) => sum + p.x, 0) / outline.length;
  const cy = outline.reduce((sum, p) => sum + p.y, 0) / outline.length;
  const inflated = outline.map((p) => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    const dist = Math.hypot(dx, dy) || 1;
    const scale = (dist + clearanceMm) / dist;
    return { x: cx + dx * scale, y: cy + dy * scale };
  });
  const smoothed = sampleClosedCurve(inflated, 8);
  const shape = new THREE.Shape(smoothed.map((p) => new THREE.Vector2(p.x, p.y)));
  const cavityDepth = thickness + clearanceMm * 2;
  const geo = new THREE.ExtrudeGeometry(shape, { depth: cavityDepth, bevelEnabled: false });
  geo.translate(0, 0, -cavityDepth / 2);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Fase E — subtracts every 'separatePart' fin's cavity (see above) out of
 * the main body geometry, which is already in the same body-local "world"
 * frame these fins are positioned in (generateLureMesh.ts's
 * buildLureGeometry bakes its own offset translation into the returned
 * geometry). A no-op passthrough when there are no separate-part fins, so
 * bodies without one pay no CSG cost at all.
 */
export function subtractFinCavities(
  bodyGeometry: THREE.BufferGeometry,
  separatePartFeatures: Feature[],
  offset: { x: number; y: number },
): THREE.BufferGeometry {
  if (separatePartFeatures.length === 0) return bodyGeometry;
  const evaluator = new Evaluator();
  let bodyBrush = new Brush(bodyGeometry);
  bodyBrush.updateMatrixWorld();
  for (const f of separatePartFeatures) {
    const clearanceMm = f.finSlotClearanceMm ?? 0.1;
    const cavityGeo = buildFinCavityLocalGeometry(f, clearanceMm);
    if (!cavityGeo) continue;
    const cavityBrush = new Brush(cavityGeo);
    const [x, y, z] = toWorld(f.position, offset);
    cavityBrush.position.set(x, y, z);
    const rot = f.rotation ?? { x: 0, y: 0, z: 0 };
    cavityBrush.rotation.set((rot.x * Math.PI) / 180, (rot.y * Math.PI) / 180, (rot.z * Math.PI) / 180);
    cavityBrush.updateMatrixWorld();
    bodyBrush = evaluator.evaluate(bodyBrush, cavityBrush, SUBTRACTION);
    bodyBrush.updateMatrixWorld();
  }
  bodyBrush.geometry.computeVertexNormals();
  return bodyBrush.geometry;
}

export interface FinCluster {
  adds: Feature[];
  cuts: Feature[];
}

// How close two fins' positions need to be (mm) to count as "the same spot"
// for Fase D's cut-into-add clustering — deliberately generous, since the
// point is "drawn on top of the base fin", not pixel-exact coordinates.
const FIN_CLUSTER_EPS_MM = 3;

/**
 * Groups fin features by position into Add/Cut clusters (Fase D scope: fin-
 * on-fin CSG only, not against the whole body). A cluster with no Cut fins
 * is not "special" — every Add fin in it still renders/exports on its own,
 * exactly as before this feature existed; only a cluster that actually has
 * a Cut fin needs the CSG path in buildFinClusterGeometry below.
 */
export function groupFinClusters(features: Feature[]): FinCluster[] {
  const fins = features.filter((f) => f.type === 'fin');
  const clusters: FinCluster[] = [];
  for (const f of fins) {
    const op = f.finOperation ?? 'add';
    const cluster = clusters.find((c) => {
      const ref = c.adds[0] ?? c.cuts[0];
      return (
        Math.hypot(
          ref.position.x - f.position.x,
          ref.position.y - f.position.y,
          ref.position.z - f.position.z,
        ) < FIN_CLUSTER_EPS_MM
      );
    });
    const target = cluster ?? { adds: [], cuts: [] };
    if (!cluster) clusters.push(target);
    if (op === 'cut') target.cuts.push(f);
    else target.adds.push(f);
  }
  return clusters;
}

function featureToBrush(feature: Feature, offset: { x: number; y: number }): Brush | null {
  const geo = buildFinLocalGeometry(feature);
  if (!geo) return null;
  const brush = new Brush(geo);
  const [x, y, z] = toWorld(feature.position, offset);
  brush.position.set(x, y, z);
  const rot = feature.rotation ?? { x: 0, y: 0, z: 0 };
  brush.rotation.set((rot.x * Math.PI) / 180, (rot.y * Math.PI) / 180, (rot.z * Math.PI) / 180);
  brush.updateMatrixWorld();
  return brush;
}

/**
 * Builds one cluster's resulting geometry, already positioned in the shared
 * body-local "world" frame (see toWorld above) — every Add fin in the
 * cluster unioned together, then every Cut fin subtracted out. Returns null
 * when there's nothing to build (no Add fins — a lone Cut with nothing to
 * cut into is a no-op, not an error).
 */
export function buildFinClusterGeometry(
  cluster: FinCluster,
  offset: { x: number; y: number },
): THREE.BufferGeometry | null {
  const addBrushes = cluster.adds
    .map((f) => featureToBrush(f, offset))
    .filter((b): b is Brush => b !== null);
  if (addBrushes.length === 0) return null;
  const cutBrushes = cluster.cuts
    .map((f) => featureToBrush(f, offset))
    .filter((b): b is Brush => b !== null);

  const evaluator = new Evaluator();
  let result: Brush = addBrushes[0];
  for (let i = 1; i < addBrushes.length; i++) {
    result = evaluator.evaluate(result, addBrushes[i], ADDITION);
    result.updateMatrixWorld();
  }
  for (const cutBrush of cutBrushes) {
    result = evaluator.evaluate(result, cutBrush, SUBTRACTION);
    result.updateMatrixWorld();
  }
  result.geometry.computeVertexNormals();
  return result.geometry;
}
