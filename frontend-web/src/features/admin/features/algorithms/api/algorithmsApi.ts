import { ApiError, messageFromResponseBody } from "../../../api/errors";
import { Logger } from "../../../utils/logger";
import {
  ACOParams,
  BenchmarkSet,
  CompareResult,
  benchmarkSetFromJson,
  compareResultFromJson,
} from "../types";

const TIMEOUT_MS = 60_000;

const request = async (path: string, init: RequestInit): Promise<unknown> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(path, {
      ...init,
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
    });
    const body = await res.text();
    if (!res.ok) {
      throw new ApiError(messageFromResponseBody(body), res.status);
    }
    return body ? JSON.parse(body) : null;
  } finally {
    clearTimeout(timer);
  }
};

type CompareArgs = {
  setName: string;
  runs: number;
  seed?: number;
  acoParams?: ACOParams;
};

export const AlgorithmsApi = {
  async getSets(): Promise<BenchmarkSet[]> {
    try {
      const data = await request("/research/sets", { method: "GET" });
      return Array.isArray(data) ? data.map((item) => benchmarkSetFromJson(item)) : [];
    } catch (e) {
      Logger.error("Failed to fetch benchmark sets", e);
      throw e;
    }
  },

  async compare({ setName, runs, seed = 0, acoParams }: CompareArgs): Promise<CompareResult> {
    try {
      const body: Record<string, unknown> = { setName, runs, seed };
      if (acoParams) body.acoParams = acoParams;
      const data = await request("/research/compare", {
        method: "POST",
        body: JSON.stringify(body),
      });
      return compareResultFromJson(data);
    } catch (e) {
      Logger.error("Failed to run comparison", e);
      throw e;
    }
  },
};
