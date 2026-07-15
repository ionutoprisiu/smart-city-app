import React from 'react';

export type ComparisonBar = {
  key: string;
  label: string;
  value: number;
  /** Best-of-N for stochastic algorithms; null/undefined for deterministic ones. */
  best?: number | null;
  color: string;
};

type Props = {
  bars: ComparisonBar[];
  unit?: string;
};

// Horizontal ranking chart: algorithms sorted shortest-tour-first (best on top),
// each bar drawn relative to the worst result so the visual gaps map to real gaps.
// The winner is highlighted and every row carries a delta chip vs. the best.
// Stochastic bars use the mean; a tick marks their best-of-N run so the reader can
// see that a "losing" mean often hides a best run tied with the deterministic ones.
export const ComparisonChart: React.FC<Props> = ({ bars, unit = 'km' }) => {
  if (bars.length === 0) return null;

  const sorted = [...bars].sort((a, b) => a.value - b.value);
  const best = sorted[0].value;
  const max = Math.max(...sorted.map((b) => b.value), 0.0001);
  const anyStochastic = sorted.some((b) => b.best != null && b.best < b.value);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {sorted.map((bar, i) => {
        const pct = Math.max(3, (bar.value / max) * 100);
        const isWinner = i === 0;
        const gap = best > 0 ? ((bar.value - best) / best) * 100 : 0;
        const isOptimal = bar.key === 'optimal';

        return (
          <div
            key={bar.key}
            style={{
              display: 'grid',
              gridTemplateColumns: '26px 1fr',
              alignItems: 'center',
              gap: 12,
              padding: '8px 10px',
              borderRadius: 12,
              background: isWinner
                ? `color-mix(in srgb, ${bar.color} 12%, transparent)`
                : 'transparent',
              border: isWinner
                ? `1px solid color-mix(in srgb, ${bar.color} 32%, transparent)`
                : '1px solid transparent',
            }}
          >
            {/* Rank medallion */}
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: 9,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 700,
                color: isWinner ? 'var(--on-primary)' : 'var(--on-surface-variant)',
                background: isWinner
                  ? bar.color
                  : 'color-mix(in srgb, var(--outline) 14%, transparent)',
              }}
            >
              {i + 1}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                <span
                  className="label-medium"
                  style={{
                    color: 'var(--on-surface)',
                    fontWeight: isWinner ? 700 : 500,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {bar.label}
                  {isOptimal ? (
                    <span
                      style={{
                        marginLeft: 8,
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: 0.4,
                        padding: '1px 6px',
                        borderRadius: 5,
                        color: bar.color,
                        background: `color-mix(in srgb, ${bar.color} 15%, transparent)`,
                      }}
                    >
                      OPTIM
                    </span>
                  ) : null}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 8, flexShrink: 0 }}>
                  <span
                    style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: 'var(--on-surface)' }}
                  >
                    {bar.value.toFixed(2)}
                    <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--on-surface-variant)' }}> {unit}</span>
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      fontVariantNumeric: 'tabular-nums',
                      minWidth: 46,
                      textAlign: 'right',
                      color: isWinner ? bar.color : 'var(--on-surface-variant)',
                    }}
                  >
                    {isWinner ? 'cel mai bun' : `+${gap.toFixed(1)}%`}
                  </span>
                </span>
              </div>

              <div
                style={{
                  position: 'relative',
                  height: 12,
                  borderRadius: 7,
                  background: 'color-mix(in srgb, var(--outline) 10%, transparent)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${pct}%`,
                    height: '100%',
                    borderRadius: 7,
                    background: isOptimal
                      ? `repeating-linear-gradient(135deg, ${bar.color}, ${bar.color} 5px, color-mix(in srgb, ${bar.color} 55%, transparent) 5px, color-mix(in srgb, ${bar.color} 55%, transparent) 10px)`
                      : `linear-gradient(90deg, color-mix(in srgb, ${bar.color} 70%, transparent), ${bar.color})`,
                    transition: 'width 650ms cubic-bezier(0.22, 1, 0.36, 1)',
                  }}
                />
                {/* Best-of-N tick for stochastic algorithms (mean bar, best marker). */}
                {bar.best != null && bar.best < bar.value ? (
                  <span
                    title={`Cea mai bună rulare: ${bar.best.toFixed(2)} ${unit}`}
                    style={{
                      position: 'absolute',
                      top: -2,
                      bottom: -2,
                      left: `${Math.max(1, (bar.best / max) * 100)}%`,
                      width: 2.5,
                      borderRadius: 2,
                      background: 'var(--on-surface)',
                      boxShadow: '0 0 0 1.5px color-mix(in srgb, var(--surface) 80%, transparent)',
                    }}
                  />
                ) : null}
              </div>
            </div>
          </div>
        );
      })}

      {anyStochastic ? (
        <div
          className="body-small"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 2,
            color: 'var(--on-surface-variant)',
            fontSize: 11.5,
          }}
        >
          <span
            style={{
              width: 2.5,
              height: 13,
              borderRadius: 2,
              background: 'var(--on-surface)',
              boxShadow: '0 0 0 1.5px color-mix(in srgb, var(--surface) 80%, transparent)',
              flexShrink: 0,
            }}
          />
          <span>
            Bara = media celor N rulări; reperul marchează <strong>cea mai bună rulare</strong> a algoritmilor
            stocastici (ACO, ACO+2-opt, PSO). Algoritmii determiniști au o singură valoare.
          </span>
        </div>
      ) : null}
    </div>
  );
};
