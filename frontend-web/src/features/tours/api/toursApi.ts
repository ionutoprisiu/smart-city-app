import { ApiClient } from '@shared/api/client';
import { Logger } from '@shared/utils/logger';
import { RouteResult, RoutingProfile, routeResultFromJson } from '@features/visit-city/types';
import { TourDetail, TourSummary, tourDetailFromJson, tourSummaryFromJson } from '../types';

export type TourCreatePayload = {
  title: string;
  description?: string;
  routingProfile: RoutingProfile;
  attractionIds: number[];
  visitDurationsMinutes: number[];
};

export const ToursApi = {
  async list(): Promise<TourSummary[]> {
    try {
      const data = await ApiClient.getList('/tours');
      return data.map((t) => tourSummaryFromJson(t));
    } catch (e) {
      Logger.error('Failed to load tours', e);
      throw e;
    }
  },

  // Publish a new tour (guide-only, enforced server-side). Sends the candidate
  // attractions and their per-visit durations — the instance of the OP.
  async create(payload: TourCreatePayload): Promise<TourDetail> {
    const data = await ApiClient.post('/tours', payload as unknown as Record<string, unknown>);
    return tourDetailFromJson(data);
  },

  async getTour(id: number): Promise<TourDetail> {
    const data = await ApiClient.get(`/tours/${id}`);
    return tourDetailFromJson(data);
  },

  // Delete a tour (author-only, enforced server-side).
  async remove(id: number): Promise<void> {
    try {
      await ApiClient.delete(`/tours/${id}`);
    } catch (e) {
      Logger.error('Failed to delete tour', e);
      throw e;
    }
  },

  // Optimize the tour server-side. With a time budget the run is an
  // Orienteering Problem: the response covers only the subset that fits and
  // reports the collected score plus the skipped attractions.
  async optimize(id: number, timeBudgetMinutes?: number | null): Promise<RouteResult> {
    try {
      const body = timeBudgetMinutes != null ? { timeBudgetMinutes } : {};
      const data = await ApiClient.post(`/tours/${id}/optimize`, body);
      return routeResultFromJson(data);
    } catch (e) {
      Logger.error('Failed to optimize tour', e);
      throw e;
    }
  },
};
