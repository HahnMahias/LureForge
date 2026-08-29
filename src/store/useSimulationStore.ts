import { create } from 'zustand';

export type WaterType = 'fresh' | 'salt';

interface SimulationState {
  waterType: WaterType;
  setWaterType: (w: WaterType) => void;
  // Multiplier on the settle-animation's exponential lerp speed. 1 = normal.
  speed: number;
  setSpeed: (s: number) => void;
  // How far (world mm) one "Reel in" leg travels before SimulateView's
  // LureRig sets a fresh anchor and starts the next leg — at a fixed
  // reel speed, this is directly "how long a single haul feels," which is
  // what the Simulate tab's Line length slider actually controls.
  lineLengthMm: number;
  setLineLengthMm: (mm: number) => void;
}

export const useSimulationStore = create<SimulationState>((set) => ({
  waterType: 'fresh',
  setWaterType: (w) => set({ waterType: w }),
  speed: 1,
  setSpeed: (s) => set({ speed: s }),
  lineLengthMm: 300,
  setLineLengthMm: (mm) => set({ lineLengthMm: mm }),
}));
