import { create } from 'zustand';

export type TabId = 'library' | 'editor' | 'simulate' | 'export';

interface AppState {
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeTab: 'editor',
  setActiveTab: (tab) => set({ activeTab: tab }),
}));
