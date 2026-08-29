import { create } from 'zustand';

export type WaterType = 'fresh' | 'salt';

interface SimulationState {
  waterType: WaterType;
  setWaterType: (w: WaterType) => void;
  // Multiplier on the settle-animation's exponential lerp speed. 1 = normal.
  speed: number;
  setSpeed: (s: number) => void;
}

export const useSimulationStore = create<SimulationState>((set) => ({
  waterType: 'fresh',
  setWaterType: (w) => set({ waterType: w }),
  speed: 1,
  setSpeed: (s) => set({ speed: s }),
}));
