import { create } from 'zustand';
import { Logger } from '@shared/utils/logger';
import { PreferencesApi } from '../api/preferencesApi';

type Status = 'unknown' | 'loading' | 'ready';

type PreferencesState = {
  status: Status;
  completed: boolean;
  categories: string[];
  isSaving: boolean;

  load: () => Promise<void>;
  save: (categories: string[]) => Promise<boolean>;
  reset: () => void;
};

export const usePreferencesStore = create<PreferencesState>((set) => ({
  status: 'unknown',
  completed: false,
  categories: [],
  isSaving: false,

  load: async () => {
    set({ status: 'loading' });
    try {
      const prefs = await PreferencesApi.get();
      set({
        status: 'ready',
        completed: prefs.completed,
        categories: prefs.categories,
      });
    } catch (e) {
      // Fail open: don't trap the user behind onboarding if the backend is unreachable.
      Logger.warning(`Preferences load failed, skipping onboarding gate: ${e}`);
      set({ status: 'ready', completed: true, categories: [] });
    }
  },

  save: async (categories) => {
    set({ isSaving: true });
    try {
      const prefs = await PreferencesApi.save(categories);
      set({
        isSaving: false,
        status: 'ready',
        completed: prefs.completed,
        categories: prefs.categories,
      });
      return true;
    } catch (e) {
      Logger.error('Failed to save preferences', e);
      set({ isSaving: false });
      return false;
    }
  },

  reset: () => set({ status: 'unknown', completed: false, categories: [], isSaving: false }),
}));
