import { create } from 'zustand';
import { useProfileStore } from './useProfileStore';
import { useSegmentsStore } from './useSegmentsStore';
import { useFeatureStore } from './useFeatureStore';
import { usePaintStore } from './usePaintStore';
import {
  listProjects,
  saveProjectToStorage,
  deleteProjectFromStorage,
  type SavedProject,
  type ProjectData,
} from '../utils/projectStorage';

function gatherProjectData(): ProjectData {
  const profile = useProfileStore.getState();
  const segments = useSegmentsStore.getState();
  const features = useFeatureStore.getState();
  const paint = usePaintStore.getState();
  return {
    profile: {
      length: profile.length,
      girth: profile.girth,
      noseType: profile.noseType,
      symmetric: profile.symmetric,
      fill: profile.fill,
      wallThicknessMm: profile.wallThicknessMm,
      material: profile.material,
      retrieveAction: profile.retrieveAction,
      curves: profile.curves,
    },
    segments: segments.segments,
    features: features.features,
    paint: {
      pattern: paint.pattern,
      backColor: paint.backColor,
      bellyColor: paint.bellyColor,
      accentColor: paint.accentColor,
    },
  };
}

function applyProjectData(data: ProjectData) {
  useProfileStore.setState({
    length: data.profile.length,
    girth: data.profile.girth,
    noseType: data.profile.noseType,
    symmetric: data.profile.symmetric,
    // Fall back to defaults for projects saved before this fix (older
    // localStorage entries won't have these fields at all).
    fill: data.profile.fill ?? 'solid',
    wallThicknessMm: data.profile.wallThicknessMm ?? 2,
    material: data.profile.material ?? 'pla',
    retrieveAction: data.profile.retrieveAction ?? 'none',
    curves: data.profile.curves,
  });
  useSegmentsStore.setState({ segments: data.segments, activeId: null });
  useFeatureStore.setState({ features: data.features, selectedId: null });
  // Projects saved before the Paint tab existed have no `paint` field at
  // all — fall back to usePaintStore's own defaults rather than leaving
  // whatever pattern/colors happened to be active from the previously
  // loaded project bleeding into this one.
  const defaults = usePaintStore.getInitialState();
  usePaintStore.setState({
    pattern: data.paint?.pattern ?? defaults.pattern,
    backColor: data.paint?.backColor ?? defaults.backColor,
    bellyColor: data.paint?.bellyColor ?? defaults.bellyColor,
    accentColor: data.paint?.accentColor ?? defaults.accentColor,
  });
}

interface LibraryState {
  currentProjectId: string | null;
  currentProjectName: string;
  // The wizard preset this lure was started from (e.g. "Jerkbait") — set
  // once by NewLureWizard.handleCreate, carried into every save of this
  // project, and restored when loading an existing one. See
  // projectStorage.ts's SavedProject.lureType for why (Fase G's Library
  // sidebar filter chips).
  currentLureType: string;
  projects: SavedProject[];
  setCurrentProjectName: (name: string) => void;
  setCurrentLureType: (type: string) => void;
  refreshProjects: () => void;
  saveCurrent: (thumbnail: string, asNew: boolean) => void;
  loadProject: (id: string) => void;
  deleteProject: (id: string) => void;
  duplicateProject: (id: string) => void;
  // Fase H's Share button: a simple, working placeholder — a JSON export of
  // the current design, for the caller to copy to the clipboard. Not a real
  // sharing feature (no link, no server round-trip) yet, but genuinely
  // useful as-is (e.g. pasting into a bug report) rather than a dead button.
  getShareableJson: () => string;
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  currentProjectId: null,
  currentProjectName: 'Untitled lure',
  currentLureType: 'Custom',
  projects: [],

  setCurrentProjectName: (name) => set({ currentProjectName: name }),
  setCurrentLureType: (type) => set({ currentLureType: type }),

  refreshProjects: () => set({ projects: listProjects() }),

  saveCurrent: (thumbnail, asNew) => {
    const { currentProjectId, currentProjectName, currentLureType } = get();
    const id = asNew || !currentProjectId ? crypto.randomUUID() : currentProjectId;
    const existing = listProjects().find((p) => p.id === id);
    const now = Date.now();
    const project: SavedProject = {
      id,
      name: currentProjectName,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      thumbnail,
      lureType: currentLureType,
      data: gatherProjectData(),
    };
    saveProjectToStorage(project);
    set({ currentProjectId: id, projects: listProjects() });
  },

  loadProject: (id) => {
    const project = listProjects().find((p) => p.id === id);
    if (!project) return;
    applyProjectData(project.data);
    set({
      currentProjectId: project.id,
      currentProjectName: project.name,
      currentLureType: project.lureType ?? 'Custom',
    });
  },

  deleteProject: (id) => {
    deleteProjectFromStorage(id);
    const currentProjectId = get().currentProjectId === id ? null : get().currentProjectId;
    set({ currentProjectId, projects: listProjects() });
  },

  // Copies a saved project under a new id/name without opening it — the
  // duplicate is independent from here on, editing one never touches the
  // other (a fresh deep-cloned `data` via JSON round-trip, since it's
  // already a plain-data structure with no functions/class instances).
  duplicateProject: (id) => {
    const source = listProjects().find((p) => p.id === id);
    if (!source) return;
    const now = Date.now();
    const copy: SavedProject = {
      id: crypto.randomUUID(),
      name: `${source.name} copy`,
      createdAt: now,
      updatedAt: now,
      thumbnail: source.thumbnail,
      lureType: source.lureType,
      data: JSON.parse(JSON.stringify(source.data)) as ProjectData,
    };
    saveProjectToStorage(copy);
    set({ projects: listProjects() });
  },

  getShareableJson: () => {
    const { currentProjectName, currentLureType } = get();
    return JSON.stringify(
      { name: currentProjectName, lureType: currentLureType, data: gatherProjectData() },
      null,
      2,
    );
  },
}));
