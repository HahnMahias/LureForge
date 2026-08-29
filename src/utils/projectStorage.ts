import type { Point2D } from './smoothPath';
import type { NoseType, CurveKey, FillType, RetrieveAction } from '../store/useProfileStore';
import type { ExtraSegment } from '../store/useSegmentsStore';
import type { Feature } from '../store/useFeatureStore';
import type { BodyMaterial } from './materials';
import type { PaintPattern } from '../store/usePaintStore';

const STORAGE_KEY = 'lureworks.projects.v1';

export interface ProjectData {
  profile: {
    length: number;
    girth: number;
    noseType: NoseType;
    symmetric: boolean;
    // Fill/material/retrieveAction were added to useProfileStore in a later
    // pass than this shape — see the persistence-gap fix that added these:
    // without them, Save silently dropped Hollow/Balsa/Spinning-tail etc.
    // back to their defaults on the next Load, even though the save itself
    // reported success.
    fill: FillType;
    wallThicknessMm: number;
    material: BodyMaterial;
    retrieveAction: RetrieveAction;
    curves: Record<CurveKey, Point2D[]>;
  };
  segments: ExtraSegment[];
  features: Feature[];
  // Optional — undefined for projects saved before the Paint tab existed;
  // useLibraryStore.ts's applyProjectData falls back to usePaintStore's own
  // defaults for those, same pattern as the profile fields above.
  paint?: {
    pattern: PaintPattern;
    backColor: string;
    bellyColor: string;
    accentColor: string;
  };
}

export interface SavedProject {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  thumbnail: string; // data URL
  // The wizard preset label this lure was started from (e.g. "Jerkbait"),
  // tagged once at creation time — Fase G's Library sidebar filter chips
  // key off this. Optional/undefined for projects saved before this field
  // existed; those just don't match any type-specific chip (still show
  // under "All").
  lureType?: string;
  data: ProjectData;
}

export function listProjects(): SavedProject[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedProject[];
    return parsed.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export function saveProjectToStorage(project: SavedProject): void {
  const all = listProjects().filter((p) => p.id !== project.id);
  all.push(project);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch (err) {
    // Most likely a quota error from thumbnail size; surface it rather than
    // silently losing the save.
    throw new Error(
      `Could not save project (${err instanceof Error ? err.message : 'storage error'}).`,
    );
  }
}

export function deleteProjectFromStorage(id: string): void {
  const all = listProjects().filter((p) => p.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}
