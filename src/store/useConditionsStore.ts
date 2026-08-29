import { create } from 'zustand';

export type LightLevel = 'low' | 'moderate' | 'bright';
export type CurrentLevel = 'calm' | 'moderate' | 'strong';
// Wind is purely cosmetic — see conditionsEffects.ts's header for why this
// tank has no physical use for it and why it's kept anyway.
export type WindLevel = 'calm' | 'light' | 'strong';

interface ConditionsState {
  light: LightLevel;
  current: CurrentLevel;
  wind: WindLevel;
  setLight: (l: LightLevel) => void;
  setCurrent: (c: CurrentLevel) => void;
  setWind: (w: WindLevel) => void;
}

export const useConditionsStore = create<ConditionsState>((set) => ({
  light: 'moderate',
  current: 'calm',
  wind: 'light',
  setLight: (light) => set({ light }),
  setCurrent: (current) => set({ current }),
  setWind: (wind) => set({ wind }),
}));
