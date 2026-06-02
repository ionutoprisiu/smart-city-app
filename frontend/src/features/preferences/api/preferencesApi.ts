import { ApiClient } from '@shared/api/client';
import { Logger } from '@shared/utils/logger';

export type Preferences = {
  completed: boolean;
  categories: string[];
};

const ENDPOINT = '/visit-city/preferences';

const parse = (raw: unknown): Preferences => {
  const obj = (raw ?? {}) as Record<string, unknown>;
  return {
    completed: Boolean(obj.completed),
    categories: Array.isArray(obj.categories)
      ? obj.categories.map((c) => String(c).toLowerCase())
      : [],
  };
};

export const PreferencesApi = {
  async get(): Promise<Preferences> {
    try {
      const data = await ApiClient.get(ENDPOINT);
      return parse(data);
    } catch (e) {
      Logger.error('Failed to fetch preferences', e);
      throw e;
    }
  },

  async save(categories: string[]): Promise<Preferences> {
    try {
      const data = await ApiClient.put(ENDPOINT, { categories });
      return parse(data);
    } catch (e) {
      Logger.error('Failed to save preferences', e);
      throw e;
    }
  },
};
