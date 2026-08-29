import { create } from 'zustand';

interface ReferenceImageState {
  url: string | null;
  x: number; // mm, left edge
  y: number; // mm, bottom edge (image extends upward from here)
  width: number; // mm
  height: number; // mm
  opacity: number;
  setImage: (url: string, width: number, height: number) => void;
  setTransform: (t: Partial<{ x: number; y: number; width: number; height: number; opacity: number }>) => void;
  clear: () => void;
}

export const useReferenceImageStore = create<ReferenceImageState>((set) => ({
  url: null,
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  opacity: 0.6,
  setImage: (url, width, height) => set({ url, width, height, x: 0, y: 0 }),
  setTransform: (t) => set((s) => ({ ...s, ...t })),
  clear: () => set({ url: null, width: 0, height: 0 }),
}));
