export type ACOParams = {
  numAnts: number;
  maxIterations: number;
  alpha: number;
  beta: number;
  rho: number;
  q: number;
  earlyStoppingThreshold: number;
};

export type PSOParams = {
  swarmSize: number;
  maxIterations: number;
  inertia: number;
  cognitive: number;
  social: number;
  earlyStoppingThreshold: number;
};

export type BenchmarkSetAttraction = {
  id: number;
  name: string;
};

export type BenchmarkSet = {
  name: string;
  n: number;
  attractionIds: number[];
  attractions: BenchmarkSetAttraction[];
};

export type AlgorithmResult = {
  key: string;
  label: string;
  cost: number;
  best?: number | null;
  std?: number | null;
  timeMs: number | null;
  improvementPct: number | null;
  gapPct: number | null;
};

export type ConvergencePoint = {
  iteration: number;
  cost: number;
};

export type CompareResult = {
  set: { name: string; n: number; attractionIds: number[] };
  runs: number;
  seed: number;
  acoParams: ACOParams;
  psoParams: PSOParams;
  algorithms: AlgorithmResult[];
  convergence: ConvergencePoint[];
  psoConvergence: ConvergencePoint[];
  bruteForceLimit: number;
  optimalAvailable: boolean;
};

export const DEFAULT_ACO_PARAMS: ACOParams = {
  numAnts: 30,
  maxIterations: 200,
  alpha: 1.0,
  beta: 2.0,
  rho: 0.5,
  q: 100.0,
  earlyStoppingThreshold: 50,
};

const DEFAULT_PSO_PARAMS: PSOParams = {
  swarmSize: 30,
  maxIterations: 200,
  inertia: 0.7,
  cognitive: 1.5,
  social: 1.5,
  earlyStoppingThreshold: 50,
};

const num = (v: unknown, fallback = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export const benchmarkSetFromJson = (json: any): BenchmarkSet => ({
  name: String(json?.name ?? ''),
  n: num(json?.n),
  attractionIds: Array.isArray(json?.attractionIds) ? json.attractionIds.map((x: unknown) => num(x)) : [],
  attractions: Array.isArray(json?.attractions)
    ? json.attractions.map((a: any) => ({ id: num(a?.id), name: String(a?.name ?? '') }))
    : [],
});

const acoParamsFromJson = (json: any): ACOParams => ({
  numAnts: num(json?.numAnts, DEFAULT_ACO_PARAMS.numAnts),
  maxIterations: num(json?.maxIterations, DEFAULT_ACO_PARAMS.maxIterations),
  alpha: num(json?.alpha, DEFAULT_ACO_PARAMS.alpha),
  beta: num(json?.beta, DEFAULT_ACO_PARAMS.beta),
  rho: num(json?.rho, DEFAULT_ACO_PARAMS.rho),
  q: num(json?.q, DEFAULT_ACO_PARAMS.q),
  earlyStoppingThreshold: num(json?.earlyStoppingThreshold, DEFAULT_ACO_PARAMS.earlyStoppingThreshold),
});

const psoParamsFromJson = (json: any): PSOParams => ({
  swarmSize: num(json?.swarmSize, DEFAULT_PSO_PARAMS.swarmSize),
  maxIterations: num(json?.maxIterations, DEFAULT_PSO_PARAMS.maxIterations),
  inertia: num(json?.inertia, DEFAULT_PSO_PARAMS.inertia),
  cognitive: num(json?.cognitive, DEFAULT_PSO_PARAMS.cognitive),
  social: num(json?.social, DEFAULT_PSO_PARAMS.social),
  earlyStoppingThreshold: num(json?.earlyStoppingThreshold, DEFAULT_PSO_PARAMS.earlyStoppingThreshold),
});

export const compareResultFromJson = (json: any): CompareResult => ({
  set: {
    name: String(json?.set?.name ?? ''),
    n: num(json?.set?.n),
    attractionIds: Array.isArray(json?.set?.attractionIds)
      ? json.set.attractionIds.map((x: unknown) => num(x))
      : [],
  },
  runs: num(json?.runs),
  seed: num(json?.seed),
  acoParams: acoParamsFromJson(json?.acoParams),
  psoParams: psoParamsFromJson(json?.psoParams),
  algorithms: Array.isArray(json?.algorithms)
    ? json.algorithms.map((a: any) => ({
        key: String(a?.key ?? ''),
        label: String(a?.label ?? ''),
        cost: num(a?.cost),
        best: a?.best == null ? null : num(a.best),
        std: a?.std == null ? null : num(a.std),
        timeMs: a?.timeMs == null ? null : num(a.timeMs),
        improvementPct: a?.improvementPct == null ? null : num(a.improvementPct),
        gapPct: a?.gapPct == null ? null : num(a.gapPct),
      }))
    : [],
  convergence: Array.isArray(json?.convergence)
    ? json.convergence.map((c: any) => ({ iteration: num(c?.iteration), cost: num(c?.cost) }))
    : [],
  psoConvergence: Array.isArray(json?.psoConvergence)
    ? json.psoConvergence.map((c: any) => ({ iteration: num(c?.iteration), cost: num(c?.cost) }))
    : [],
  bruteForceLimit: num(json?.bruteForceLimit, 12),
  optimalAvailable: Boolean(json?.optimalAvailable),
});
