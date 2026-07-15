import React, { useMemo, useState } from 'react';
import { ConvergencePoint } from '../types';

type Props = {
  data: ConvergencePoint[];
  totalIterations: number;
  yDomain: [number, number];
  optimal?: number | null;
  greedy?: number | null;
  pso?: number | null;
  lineColor?: string;
  gradientId?: string;
};

type RefLine = {
  value: number;
  color: string;
  shortName: string;
  label: string;
  dash: string;
};

const WIDTH = 640;
const HEIGHT = 300;
const PAD = { top: 20, right: 108, bottom: 40, left: 52 };

const formatCost = (value: number, span: number): string => {
  if (span < 0.05) return value.toFixed(3);
  if (span < 0.5) return value.toFixed(2);
  if (span < 5) return value.toFixed(1);
  return value.toFixed(0);
};

const niceLinearTicks = (min: number, max: number, target = 5): number[] => {
  if (!(max > min)) return [min];
  const span = max - min;
  const rawStep = span / Math.max(1, target - 1);
  const power = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const residual = rawStep / power;
  let step = power;
  if (residual > 5) step = 10 * power;
  else if (residual > 2) step = 5 * power;
  else if (residual > 1) step = 2 * power;

  const start = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let t = start; t <= max + step * 0.001; t += step) {
    ticks.push(Number(t.toFixed(10)));
  }
  if (ticks.length < 2) {
    return [min, max];
  }
  return ticks;
};

const labelOffsets = (items: { y: number }[], minGap = 14): number[] => {
  const order = items.map((item, i) => ({ i, y: item.y })).sort((a, b) => a.y - b.y);
  const offsets = new Array<number>(items.length).fill(0);
  let prevY = -Infinity;
  for (const entry of order) {
    const delta = entry.y - prevY;
    if (delta < minGap) {
      offsets[entry.i] = minGap - delta;
      prevY = entry.y + minGap - delta;
    } else {
      prevY = entry.y;
    }
  }
  return offsets;
};

type FocusWindow = {
  xMax: number;
  lastImprovement: number;
  zoomed: boolean;
};

const computeFocusWindow = (data: ConvergencePoint[], totalIterations: number): FocusWindow => {
  if (data.length === 0) {
    return { xMax: Math.max(totalIterations, 1), lastImprovement: 1, zoomed: false };
  }

  const eps = 1e-9;
  let lastImprovement = data[0].iteration;
  for (let i = 1; i < data.length; i++) {
    if (data[i].cost < data[i - 1].cost - eps) {
      lastImprovement = data[i].iteration;
    }
  }

  const padding = Math.max(2, Math.ceil(lastImprovement * 0.25));
  const focusedMax = Math.min(totalIterations, Math.max(3, lastImprovement + padding));
  const zoomed = focusedMax < totalIterations * 0.8;

  return {
    xMax: zoomed ? focusedMax : Math.max(totalIterations, 1),
    lastImprovement,
    zoomed,
  };
};

const buildFocusedYDomain = (
  data: ConvergencePoint[],
  xMax: number,
  refs: Omit<RefLine, 'label'>[],
): [number, number] => {
  const windowed = data.filter((p) => p.iteration <= xMax);
  const values = windowed.map((p) => p.cost);
  for (const ref of refs) values.push(ref.value);
  if (values.length === 0) return [0, 1];

  let min = Math.min(...values);
  let max = Math.max(...values);
  const range = max - min || max * 0.02 || 0.1;
  const pad = Math.max(range * 0.1, 0.01);
  return [Math.max(0, min - pad), max + pad];
};

export const ConvergenceChart: React.FC<Props> = ({
  data,
  totalIterations,
  yDomain,
  optimal,
  greedy,
  pso,
  lineColor = 'var(--primary)',
  gradientId = 'convArea',
}) => {
  const [hover, setHover] = useState<ConvergencePoint | null>(null);

  const focus = useMemo(() => computeFocusWindow(data, totalIterations), [data, totalIterations]);

  const refs = useMemo(() => {
    const lines: Omit<RefLine, 'label'>[] = [];
    if (greedy != null) {
      lines.push({ value: greedy, color: 'var(--tertiary, #b08968)', shortName: 'NN', dash: '6 4' });
    }
    if (pso != null) {
      lines.push({ value: pso, color: '#7c4dff', shortName: 'PSO', dash: '4 4' });
    }
    if (optimal != null) {
      lines.push({ value: optimal, color: 'var(--error)', shortName: 'Opt', dash: '2 4' });
    }
    return lines;
  }, [greedy, pso, optimal]);

  const autoYDomain = useMemo(
    () => (focus.zoomed ? buildFocusedYDomain(data, focus.xMax, refs) : yDomain),
    [data, focus.xMax, focus.zoomed, refs, yDomain],
  );

  const innerW = WIDTH - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const [yMin, yMax] = autoYDomain;
  const span = yMax - yMin || 0.1;
  const xMax = focus.xMax;

  const displayData = useMemo(() => {
    if (data.length === 0) return [];
    const windowed = data.filter((p) => p.iteration <= xMax);
    if (windowed.length === 0) return data.slice(0, 1);
    const lastInWindow = windowed[windowed.length - 1];
    const lastOverall = data[data.length - 1];
    if (lastInWindow.iteration < xMax && lastInWindow.iteration === lastOverall.iteration) {
      return [...windowed, { iteration: xMax, cost: lastInWindow.cost }];
    }
    return windowed;
  }, [data, xMax]);

  const refsWithLabels = useMemo(
    (): RefLine[] =>
      refs.map((ref) => ({
        ...ref,
        label: `${ref.shortName} ${formatCost(ref.value, span)}`,
      })),
    [refs, span],
  );

  const xScale = (i: number) => PAD.left + (xMax <= 1 ? 0 : (i - 1) / (xMax - 1)) * innerW;
  const yScale = (v: number) => PAD.top + (1 - (v - yMin) / span) * innerH;

  const linePath =
    displayData.length === 0
      ? ''
      : displayData
          .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${xScale(p.iteration).toFixed(1)} ${yScale(p.cost).toFixed(1)}`)
          .join(' ');

  const areaPath = (() => {
    if (displayData.length === 0) return '';
    const top = displayData
      .map((p) => `L ${xScale(p.iteration).toFixed(1)} ${yScale(p.cost).toFixed(1)}`)
      .join(' ');
    const x0 = xScale(displayData[0].iteration).toFixed(1);
    const xN = xScale(displayData[displayData.length - 1].iteration).toFixed(1);
    const yBase = (PAD.top + innerH).toFixed(1);
    return `M ${x0} ${yBase} ${top} L ${xN} ${yBase} Z`;
  })();

  const yTicks = niceLinearTicks(yMin, yMax, 5);
  const xTicks = niceLinearTicks(1, xMax, Math.min(6, Math.max(2, xMax))).map((t) => Math.round(t));
  const first = displayData[0];
  const last = displayData[displayData.length - 1];
  const refLayout = refsWithLabels.map((ref) => ({ ref, y: yScale(ref.value) }));
  const refOffsets = labelOffsets(refLayout);

  const nearestPoint = (clientX: number, rect: DOMRect): ConvergencePoint | null => {
    if (displayData.length === 0) return null;
    const x = ((clientX - rect.left) / rect.width) * WIDTH;
    let best = displayData[0];
    let bestDist = Infinity;
    for (const p of displayData) {
      const dist = Math.abs(xScale(p.iteration) - x);
      if (dist < bestDist) {
        bestDist = dist;
        best = p;
      }
    }
    return bestDist <= 28 ? best : null;
  };

  return (
    <div style={{ position: 'relative' }}>
      {hover ? (
        <div
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            zIndex: 2,
            padding: '6px 10px',
            borderRadius: 10,
            background: 'color-mix(in srgb, var(--surface-container-highest) 92%, transparent)',
            border: '1px solid color-mix(in srgb, var(--outline-variant) 40%, transparent)',
            fontSize: 12,
            color: 'var(--on-surface)',
            pointerEvents: 'none',
          }}
        >
          <strong>Iterația {hover.iteration}</strong>
          <span style={{ color: 'var(--on-surface-variant)' }}> · </span>
          {formatCost(hover.cost, span)} km
        </div>
      ) : null}

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width="100%"
        role="img"
        aria-label="Graficul de convergență ACO"
        style={{ display: 'block', cursor: data.length > 0 ? 'crosshair' : 'default' }}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setHover(nearestPoint(e.clientX, rect));
        }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity="0.28" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
          </linearGradient>
        </defs>

        <text
          x={14}
          y={PAD.top + innerH / 2}
          textAnchor="middle"
          fontSize={11}
          fill="var(--on-surface-variant)"
          transform={`rotate(-90 14 ${PAD.top + innerH / 2})`}
        >
          Lungime traseu (km)
        </text>

        {yTicks.map((t, i) => (
          <g key={`y${i}`}>
            <line
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={yScale(t)}
              y2={yScale(t)}
              stroke="color-mix(in srgb, var(--outline) 18%, transparent)"
              strokeWidth={1}
            />
            <text x={PAD.left - 8} y={yScale(t) + 4} textAnchor="end" fontSize={11} fill="var(--on-surface-variant)">
              {formatCost(t, span)}
            </text>
          </g>
        ))}

        {xTicks.map((t, i) => (
          <text
            key={`x${i}`}
            x={xScale(t)}
            y={HEIGHT - PAD.bottom + 18}
            textAnchor="middle"
            fontSize={11}
            fill="var(--on-surface-variant)"
          >
            {t}
          </text>
        ))}
        <text x={PAD.left + innerW / 2} y={HEIGHT - 6} textAnchor="middle" fontSize={11} fill="var(--on-surface-variant)">
          Iterație
        </text>

        {refsWithLabels.map((ref) => (
          <line
            key={ref.label}
            x1={PAD.left}
            x2={WIDTH - PAD.right}
            y1={yScale(ref.value)}
            y2={yScale(ref.value)}
            stroke={ref.color}
            strokeWidth={1.5}
            strokeDasharray={ref.dash}
            opacity={0.9}
          />
        ))}

        {focus.zoomed && focus.lastImprovement <= xMax ? (
          <line
            x1={xScale(focus.lastImprovement)}
            x2={xScale(focus.lastImprovement)}
            y1={PAD.top}
            y2={PAD.top + innerH}
            stroke="color-mix(in srgb, var(--primary) 35%, transparent)"
            strokeWidth={1}
            strokeDasharray="4 3"
          />
        ) : null}

        {optimal != null && last && last.cost > optimal ? (
          <g>
            <rect
              x={PAD.left}
              y={yScale(last.cost)}
              width={innerW}
              height={Math.max(0, yScale(optimal) - yScale(last.cost))}
              fill="color-mix(in srgb, var(--error) 9%, transparent)"
            />
            {yScale(optimal) - yScale(last.cost) > 16 ? (
              <text
                x={PAD.left + 8}
                y={(yScale(last.cost) + yScale(optimal)) / 2 + 3}
                fontSize={10}
                fontWeight={600}
                fill="var(--error)"
                opacity={0.85}
              >
                decalaj față de optim
              </text>
            ) : null}
          </g>
        ) : null}

        {areaPath ? <path d={areaPath} fill={`url(#${gradientId})`} /> : null}
        {linePath ? (
          <path d={linePath} fill="none" stroke={lineColor} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        ) : null}

        {first && first.cost !== last?.cost ? (
          <circle cx={xScale(first.iteration)} cy={yScale(first.cost)} r={3.5} fill="var(--surface)" stroke={lineColor} strokeWidth={2} />
        ) : null}

        {last ? (
          <g>
            <circle cx={xScale(last.iteration)} cy={yScale(last.cost)} r={9} fill={lineColor} opacity={0.16} />
            <circle cx={xScale(last.iteration)} cy={yScale(last.cost)} r={4.5} fill={lineColor} stroke="var(--surface)" strokeWidth={1.5} />
          </g>
        ) : null}

        {hover ? (
          <g>
            <line
              x1={xScale(hover.iteration)}
              x2={xScale(hover.iteration)}
              y1={PAD.top}
              y2={PAD.top + innerH}
              stroke="color-mix(in srgb, var(--outline) 35%, transparent)"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <circle cx={xScale(hover.iteration)} cy={yScale(hover.cost)} r={5} fill={lineColor} stroke="#fff" strokeWidth={2} />
          </g>
        ) : null}

        {refLayout.map(({ ref, y }, i) => (
          <g key={ref.label}>
            <rect
              x={WIDTH - PAD.right + 6}
              y={y - 9 + refOffsets[i]}
              width={96}
              height={18}
              rx={6}
              fill="color-mix(in srgb, var(--surface) 88%, transparent)"
              stroke={ref.color}
              strokeWidth={1}
            />
            <text
              x={WIDTH - PAD.right + 12}
              y={y + 4 + refOffsets[i]}
              fontSize={10}
              fontWeight={600}
              fill={ref.color}
            >
              {ref.label}
            </text>
          </g>
        ))}
      </svg>

      {focus.zoomed ? (
        <div className="body-small" style={{ marginTop: 8, color: 'var(--on-surface-variant)' }}>
          Zoom automat: iterațiile 1–{xMax} (a convergent la iterația {focus.lastImprovement}; rulare completă: {totalIterations} iterații)
        </div>
      ) : null}
    </div>
  );
};
