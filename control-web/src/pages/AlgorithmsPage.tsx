import React, { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../components/Icon";
import { extractErrorMessage } from "../api/errors";
import { AlgorithmsApi } from "../features/algorithms/api/algorithmsApi";
import {
  ACOParams,
  AlgorithmResult,
  BenchmarkSet,
  CompareResult,
  DEFAULT_ACO_PARAMS,
} from "../features/algorithms/types";
import { ConvergenceChart } from "../features/algorithms/components/ConvergenceChart";
import { ComparisonChart, ComparisonBar } from "../features/algorithms/components/ComparisonChart";

const ALGO_COLORS: Record<string, string> = {
  initial: '#9aa0a6',
  nearest_neighbor: 'var(--tertiary, #b08968)',
  aco: 'var(--primary)',
  pso: '#7c4dff',
  optimal: 'var(--error)',
};

const PSO_COLOR = '#7c4dff';

type SliderDef<K extends string> = {
  key: K;
  label: string;
  min: number;
  max: number;
  step: number;
  hint: string;
};

const ACO_SLIDERS: SliderDef<keyof ACOParams>[] = [
  { key: 'alpha', label: 'Alpha (α) — pheromone weight', min: 0, max: 5, step: 0.1, hint: 'How strongly ants follow existing trails.' },
  { key: 'beta', label: 'Beta (β) — distance weight', min: 0, max: 5, step: 0.1, hint: 'How strongly ants prefer shorter edges.' },
  { key: 'rho', label: 'Rho (ρ) — evaporation', min: 0, max: 1, step: 0.05, hint: 'Fraction of pheromone lost each iteration.' },
  { key: 'q', label: 'Q — deposit factor', min: 10, max: 500, step: 10, hint: 'Amount of pheromone laid per tour.' },
  { key: 'numAnts', label: 'Ants per iteration', min: 5, max: 100, step: 5, hint: 'Population size each iteration.' },
  {
    key: 'earlyStoppingThreshold',
    label: 'Early stopping',
    min: 5,
    max: 100,
    step: 5,
    hint: 'Stop after this many iterations without a better tour.',
  },
];

export const AlgorithmsPage: React.FC = () => {
  const [sets, setSets] = useState<BenchmarkSet[]>([]);
  const [selectedSet, setSelectedSet] = useState<string>('');
  const [params, setParams] = useState<ACOParams>({ ...DEFAULT_ACO_PARAMS });
  const [runs, setRuns] = useState(10);
  const [hiddenAlgos, setHiddenAlgos] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CompareResult | null>(null);
  const [revealCount, setRevealCount] = useState(0);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    AlgorithmsApi.getSets()
      .then((data) => {
        setSets(data);
        if (data.length > 0) setSelectedSet((prev) => prev || data[0].name);
      })
      .catch((e) => setError(extractErrorMessage(e)));
  }, []);

  useEffect(
    () => () => {
      if (animRef.current != null) window.clearInterval(animRef.current);
    },
    [],
  );

  const animateConvergence = (total: number) => {
    if (animRef.current != null) window.clearInterval(animRef.current);
    setRevealCount(0);
    if (total <= 1) {
      setRevealCount(total);
      return;
    }
    const stepSize = Math.max(1, Math.round(total / 60));
    animRef.current = window.setInterval(() => {
      setRevealCount((prev) => {
        const next = prev + stepSize;
        if (next >= total) {
          if (animRef.current != null) window.clearInterval(animRef.current);
          return total;
        }
        return next;
      });
    }, 30);
  };

  const runBenchmark = async () => {
    if (!selectedSet) return;
    setLoading(true);
    setError(null);
    try {
      const res = await AlgorithmsApi.compare({ setName: selectedSet, runs, acoParams: params });
      setResult(res);
      animateConvergence(res.convergence.length);
    } catch (e) {
      setError(extractErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const resetParams = () => setParams({ ...DEFAULT_ACO_PARAMS });

  const toggleAlgo = (key: string) =>
    setHiddenAlgos((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const isVisible = (key: string) => !hiddenAlgos.has(key);

  const acoResult = result?.algorithms.find((a) => a.key === 'aco') ?? null;
  const psoResult = result?.algorithms.find((a) => a.key === 'pso') ?? null;
  const optimalResult = result?.algorithms.find((a) => a.key === 'optimal') ?? null;
  const greedyResult = result?.algorithms.find((a) => a.key === 'nearest_neighbor') ?? null;

  const visibleAlgorithms = useMemo(
    () => (result ? result.algorithms.filter((a) => !hiddenAlgos.has(a.key)) : []),
    [result, hiddenAlgos],
  );

  const comparisonBars: ComparisonBar[] = useMemo(
    () =>
      visibleAlgorithms.map((a) => ({
        key: a.key,
        label: a.label,
        value: a.cost,
        color: ALGO_COLORS[a.key] ?? 'var(--primary)',
      })),
    [visibleAlgorithms],
  );

  const yDomain: [number, number] = useMemo(() => {
    if (!result || result.convergence.length === 0) return [0, 1];
    const costs = result.convergence.map((c) => c.cost);
    let min = Math.min(...costs);
    let max = Math.max(...costs);
    if (psoResult && !hiddenAlgos.has('pso')) {
      min = Math.min(min, psoResult.cost);
      max = Math.max(max, psoResult.cost);
    }
    if (optimalResult && !hiddenAlgos.has('optimal')) {
      min = Math.min(min, optimalResult.cost);
      max = Math.max(max, optimalResult.cost);
    }
    if (greedyResult && !hiddenAlgos.has('nearest_neighbor')) {
      min = Math.min(min, greedyResult.cost);
      max = Math.max(max, greedyResult.cost);
    }
    const range = max - min || max * 0.02 || 0.1;
    const pad = Math.max(range * 0.08, 0.012);
    return [Math.max(0, min - pad), max + pad];
  }, [result, optimalResult, greedyResult, psoResult, hiddenAlgos]);

  const revealedConvergence = result ? result.convergence.slice(0, Math.max(1, revealCount)) : [];

  const acoVsPsoLabel = useMemo(() => {
    if (!acoResult || !psoResult) return '—';
    if (acoResult.cost < psoResult.cost) {
      const pct = ((psoResult.cost - acoResult.cost) / psoResult.cost) * 100;
      return `−${pct.toFixed(1)}% vs PSO`;
    }
    if (acoResult.cost > psoResult.cost) {
      const pct = ((acoResult.cost - psoResult.cost) / acoResult.cost) * 100;
      return `+${pct.toFixed(1)}% vs PSO`;
    }
    return 'Tied with PSO';
  }, [acoResult, psoResult]);

  return (
    <div className="algorithms-page">
      <div className="algorithms-page__inner">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              background: 'color-mix(in srgb, var(--primary-container) 55%, transparent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="science" size={24} color="var(--primary)" />
          </div>
          <div>
            <div className="title-large">Algorithms</div>
            <div className="body-small" style={{ color: "var(--on-surface-variant)" }}>
              Calibrează și evaluează ACO. Comparația principală: nearest-neighbor și optimul exact. PSO rulează cu parametri impliciți, fără calibrare — reper suplimentar, nu rival optimizat.
            </div>
          </div>
        </div>

        <section style={cardStyle}>
          <div className="label-medium" style={sectionLabel}>DATASET</div>
          <div className="chip-row" style={{ marginBottom: 4 }}>
            {sets.map((s) => {
              const active = s.name === selectedSet;
              return (
                <button
                  key={s.name}
                  type="button"
                  onClick={() => setSelectedSet(s.name)}
                  className={`chip${active ? ' active' : ''}`}
                >
                  {s.name} · {s.n} pts
                </button>
              );
            })}
          </div>

          <div className="label-medium" style={{ ...sectionLabel, marginTop: 18 }}>
            REPETITIONS: {runs}
          </div>
          <input
            type="range"
            min={1}
            max={30}
            step={1}
            value={runs}
            onChange={(e) => setRuns(Number(e.target.value))}
            style={{ width: '100%' }}
          />
          <div className="body-small" style={{ color: 'var(--on-surface-variant)', fontSize: 11 }}>
            ACO runs {runs} times with different random seeds; results show mean ± std, not a single lucky run.
          </div>

          <div className="label-medium" style={{ ...sectionLabel, marginTop: 18, display: 'flex', justifyContent: 'space-between' }}>
            <span>ACO PARAMETERS</span>
            <button type="button" onClick={resetParams} style={resetBtnStyle}>
              <Icon name="restart-alt" size={14} /> Reset
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            {ACO_SLIDERS.map((slider) => (
              <div key={slider.key}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span className="body-small" style={{ color: 'var(--on-surface)' }}>{slider.label}</span>
                  <span className="label-medium" style={{ color: 'var(--primary)' }}>
                    {Number(params[slider.key]).toFixed(slider.step < 1 ? 2 : 0)}
                  </span>
                </div>
                <input
                  type="range"
                  min={slider.min}
                  max={slider.max}
                  step={slider.step}
                  value={params[slider.key]}
                  onChange={(e) => setParams((p) => ({ ...p, [slider.key]: Number(e.target.value) }))}
                  style={{ width: '100%' }}
                />
                <div className="body-small" style={{ color: 'var(--on-surface-variant)', fontSize: 11 }}>
                  {slider.hint}
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={runBenchmark}
            disabled={loading || !selectedSet}
            style={{
              marginTop: 20,
              width: '100%',
              padding: '14px 0',
              borderRadius: 14,
              background: loading ? 'var(--surface-container-high)' : 'var(--primary)',
              color: loading ? 'var(--on-surface-variant)' : 'var(--on-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              fontWeight: 600,
            }}
          >
            <Icon name={loading ? 'hourglass-top' : 'play-arrow'} size={20} color="currentColor" />
            {loading ? 'Running…' : 'Run benchmark'}
          </button>

          {error ? (
            <div className="body-small" style={{ color: 'var(--error)', marginTop: 10 }}>{error}</div>
          ) : null}
        </section>

        {result ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginTop: 16 }}>
              <Stat
                icon="trending-down"
                label="ACO vs initial"
                value={`−${acoResult?.improvementPct?.toFixed(1) ?? '0'}%`}
                tone="var(--primary)"
              />
              <Stat
                icon="emoji-events"
                label="ACO best tour"
                value={`${acoResult?.best?.toFixed(2) ?? '—'} km`}
                tone="var(--on-surface)"
              />
              <Stat
                icon="rule"
                label={optimalResult ? 'Gap to optimum' : 'Optimum'}
                value={optimalResult ? `+${acoResult?.gapPct?.toFixed(1) ?? '0'}%` : 'n > limit'}
                tone={optimalResult ? 'var(--error)' : 'var(--on-surface-variant)'}
              />
              <Stat
                icon="compare-arrows"
                label="ACO vs PSO"
                value={acoVsPsoLabel}
                tone={acoResult && psoResult && acoResult.cost <= psoResult.cost ? 'var(--primary)' : PSO_COLOR}
              />
            </div>

            <section style={cardStyle}>
              <div className="title-small" style={{ marginBottom: 4 }}>ACO convergence (best run)</div>
              <div className="body-small" style={{ color: 'var(--on-surface-variant)', marginBottom: 8 }}>
                Blue line: ACO best run over iterations. Dashed bands: NN, PSO mean ({result.runs} runs), and optimal — same
                metrics as the bar chart below.
              </div>
              {result.convergence.length > 0 ? (
                <div
                  className="body-small"
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 12,
                    marginBottom: 10,
                    color: 'var(--on-surface-variant)',
                  }}
                >
                  <span>
                    Start: <strong style={{ color: 'var(--on-surface)' }}>{result.convergence[0].cost.toFixed(3)} km</strong>
                  </span>
                  <span>
                    End: <strong style={{ color: 'var(--primary)' }}>{result.convergence[result.convergence.length - 1].cost.toFixed(3)} km</strong>
                  </span>
                  {optimalResult && isVisible('optimal') ? (
                    <span>
                      Optimal: <strong style={{ color: 'var(--error)' }}>{optimalResult.cost.toFixed(3)} km</strong>
                    </span>
                  ) : null}
                </div>
              ) : null}
              <ConvergenceChart
                data={revealedConvergence}
                totalIterations={result.convergence.length}
                yDomain={yDomain}
                optimal={optimalResult && isVisible('optimal') ? optimalResult.cost : null}
                greedy={greedyResult && isVisible('nearest_neighbor') ? greedyResult.cost : null}
                pso={psoResult && isVisible('pso') ? psoResult.cost : null}
              />
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8 }}>
                <Legend color="var(--primary)" label="ACO best cost" />
                {psoResult && isVisible('pso') ? (
                  <Legend color={PSO_COLOR} label="PSO mean (fixed params)" dashed />
                ) : null}
                {greedyResult && isVisible('nearest_neighbor') ? (
                  <Legend color="var(--tertiary, #b08968)" label="Nearest neighbor" dashed />
                ) : null}
                {optimalResult && isVisible('optimal') ? (
                  <Legend color="var(--error)" label="Optimal" dashed />
                ) : null}
              </div>
            </section>

            <section style={cardStyle}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 8,
                  marginBottom: 12,
                }}
              >
                <span className="title-small">Route length comparison</span>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {result.algorithms.map((a) => {
                    const on = isVisible(a.key);
                    return (
                      <button
                        key={a.key}
                        type="button"
                        onClick={() => toggleAlgo(a.key)}
                        className="chip small"
                        style={{ opacity: on ? 1 : 0.4 }}
                      >
                        <span
                          style={{
                            width: 9,
                            height: 9,
                            borderRadius: 3,
                            background: ALGO_COLORS[a.key] ?? 'var(--primary)',
                          }}
                        />
                        {a.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              {comparisonBars.length > 0 ? (
                <ComparisonChart bars={comparisonBars} />
              ) : (
                <div className="body-small" style={{ color: 'var(--on-surface-variant)' }}>
                  Select at least one algorithm to display.
                </div>
              )}
              <div className="body-small" style={{ color: 'var(--on-surface-variant)', marginTop: 10 }}>
                PSO folosește parametri impliciți (necalibrați) — aceeași metrică (medie) ca în graficul de convergență.
              </div>
            </section>

            <section style={cardStyle}>
              <div className="title-small" style={{ marginBottom: 12 }}>Detailed results</div>
              <ResultsTable algorithms={visibleAlgorithms} optimalAvailable={result.optimalAvailable} />
              {!result.optimalAvailable ? (
                <div className="body-small" style={{ color: 'var(--on-surface-variant)', marginTop: 10 }}>
                  Brute-force optimum is only computed for instances up to {result.bruteForceLimit} points
                  (factorial search space).
                </div>
              ) : null}
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
};

const cardStyle: React.CSSProperties = {
  marginTop: 16,
  padding: 18,
  borderRadius: 20,
  border: '1px solid color-mix(in srgb, var(--outline-variant) 35%, transparent)',
  background: 'color-mix(in srgb, var(--surface-container-highest) 55%, transparent)',
};

const sectionLabel: React.CSSProperties = {
  color: 'var(--on-surface-variant)',
  letterSpacing: 0.8,
  marginBottom: 10,
};

const resetBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  color: 'var(--primary)',
  fontWeight: 600,
};

const Stat: React.FC<{ icon: string; label: string; value: string; tone: string }> = ({
  icon,
  label,
  value,
  tone,
}) => (
  <div style={{ ...cardStyle, marginTop: 0, padding: 14 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <Icon name={icon} size={16} color={tone} />
      <span className="body-small" style={{ color: 'var(--on-surface-variant)' }}>{label}</span>
    </div>
    <div className="title-medium" style={{ marginTop: 6, color: tone }}>{value}</div>
  </div>
);

const Legend: React.FC<{ color: string; label: string; dashed?: boolean }> = ({ color, label, dashed }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
    <span
      style={{
        width: 18,
        height: 0,
        borderTop: `3px ${dashed ? 'dashed' : 'solid'} ${color}`,
        display: 'inline-block',
      }}
    />
    <span className="body-small" style={{ color: 'var(--on-surface-variant)' }}>{label}</span>
  </span>
);

const ResultsTable: React.FC<{ algorithms: AlgorithmResult[]; optimalAvailable: boolean }> = ({
  algorithms,
  optimalAvailable,
}) => (
  <div style={{ overflowX: 'auto' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
      <thead>
        <tr style={{ textAlign: 'left', color: 'var(--on-surface-variant)' }}>
          <th style={thStyle}>Algorithm</th>
          <th style={thStyle}>Cost (km)</th>
          <th style={thStyle}>vs initial</th>
          {optimalAvailable ? <th style={thStyle}>Gap to opt.</th> : null}
          <th style={thStyle}>Time (ms)</th>
        </tr>
      </thead>
      <tbody>
        {algorithms.map((a) => (
          <tr key={a.key} style={{ borderTop: '1px solid color-mix(in srgb, var(--outline) 12%, transparent)' }}>
            <td style={tdStyle}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: ALGO_COLORS[a.key] ?? 'var(--primary)' }} />
                {a.label}
              </span>
            </td>
            <td style={tdStyle}>
              {a.cost.toFixed(2)}
              {(a.key === 'aco' || a.key === 'pso') && a.std != null ? (
                <span style={{ color: 'var(--on-surface-variant)' }}> ±{a.std.toFixed(2)}</span>
              ) : null}
            </td>
            <td style={tdStyle}>{a.improvementPct != null ? `−${a.improvementPct.toFixed(1)}%` : '—'}</td>
            {optimalAvailable ? (
              <td style={tdStyle}>{a.gapPct != null ? `+${a.gapPct.toFixed(1)}%` : '—'}</td>
            ) : null}
            <td style={tdStyle}>{a.timeMs != null ? a.timeMs.toFixed(1) : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const thStyle: React.CSSProperties = { padding: '6px 8px', fontWeight: 600 };
const tdStyle: React.CSSProperties = { padding: '8px 8px', color: 'var(--on-surface)' };
