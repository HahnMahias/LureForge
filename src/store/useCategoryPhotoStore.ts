import { create } from 'zustand';
import type { LureCategory } from '../data/lureCategories';

interface CategoryPhotoState {
  photos: Record<string, string>; // LureCategory -> data URL
  setPhoto: (category: LureCategory, dataUrl: string) => void;
}

const STORAGE_KEY = 'lureworks.categoryPhotos.v1';

function loadInitial(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

// Small per-category thumbnail photos, persisted directly via localStorage
// (unlike Simulate recordings — these are tiny images, not video, so
// localStorage's quota is a non-issue here) — same data-URL upload pattern
// as useReferenceImageStore.ts.
export const useCategoryPhotoStore = create<CategoryPhotoState>((set, get) => ({
  photos: loadInitial(),
  setPhoto: (category, dataUrl) => {
    const photos = { ...get().photos, [category]: dataUrl };
    set({ photos });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(photos));
  },
}));
