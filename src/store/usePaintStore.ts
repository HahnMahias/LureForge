import { create } from 'zustand';

export type PaintPattern = 'solid' | 'twoTone' | 'perch' | 'firetiger' | 'shad' | 'clown';

interface PaintState {
  pattern: PaintPattern;
  // Solid only uses backColor. Every other pattern uses all three — see
  // utils/paintTexture.ts for how each pattern lays them out (countershading
  // gradient back→belly, plus accentColor for bands/spots/patches).
  backColor: string;
  bellyColor: string;
  accentColor: string;
  setPattern: (p: PaintPattern) => void;
  setBackColor: (c: string) => void;
  setBellyColor: (c: string) => void;
  setAccentColor: (c: string) => void;
}

// backColor's default deliberately matches LureBody.tsx's old fixed neutral
// color (#c9b278) — a freshly created lure design shouldn't suddenly look
// different than it did before Paint existed.
export const usePaintStore = create<PaintState>((set) => ({
  pattern: 'solid',
  backColor: '#c9b278',
  bellyColor: '#e7ddc0',
  accentColor: '#3a3f47',
  setPattern: (pattern) => set({ pattern }),
  setBackColor: (backColor) => set({ backColor }),
  setBellyColor: (bellyColor) => set({ bellyColor }),
  setAccentColor: (accentColor) => set({ accentColor }),
}));
