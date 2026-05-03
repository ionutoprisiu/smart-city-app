import { ApiClient } from '@shared/api/client';
import { Logger } from '@shared/utils/logger';
import {
  Attraction,
  RouteResult,
  RoutingProfile,
  attractionFromJson,
  routeResultFromJson,
} from '../types';

type FetchAttractionsArgs = {
  category?: string | null;
  query?: string | null;
};

type LiveAttractionsArgs = {
  query?: string | null;
  limit?: number | null;
};

type OptimizeArgs = {
  attractionIds: number[];
  startLat?: number | null;
  startLon?: number | null;
  routingProfile?: RoutingProfile;
};

const buildQuery = (params: Record<string, string | number | null | undefined>) => {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === '') continue;
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }
  return parts.length > 0 ? `?${parts.join('&')}` : '';
};

export const VisitCityApi = {
  async getAttractions({ category, query }: FetchAttractionsArgs = {}): Promise<Attraction[]> {
    try {
      const endpoint = `/visit-city/attractions${buildQuery({ category, q: query })}`;
      const data = await ApiClient.getList(endpoint);
      return data.map((item) => attractionFromJson(item));
    } catch (e) {
      Logger.error('Failed to fetch attractions', e);
      throw e;
    }
  },

  async getLiveAttractions({ query, limit }: LiveAttractionsArgs = {}): Promise<Attraction[]> {
    try {
      const endpoint = `/visit-city/attractions/live${buildQuery({ q: query, limit })}`;
      const data = await ApiClient.getList(endpoint);
      return data.map((item) => attractionFromJson(item));
    } catch (e) {
      Logger.warning('Live attractions failed, falling back to DB attractions', e);
      return VisitCityApi.getAttractions({ query });
    }
  },

  async optimizeRoute({
    attractionIds,
    startLat,
    startLon,
    routingProfile = 'driving',
  }: OptimizeArgs): Promise<RouteResult> {
    try {
      const body: Record<string, unknown> = {
        attractionIds,
        routingProfile,
      };
      if (startLat != null) body.startLatitude = startLat;
      if (startLon != null) body.startLongitude = startLon;

      const data = await ApiClient.post('/visit-city/optimize', body);
      return routeResultFromJson(data);
    } catch (e) {
      Logger.error('Failed to optimize route', e);
      throw e;
    }
  },
};
