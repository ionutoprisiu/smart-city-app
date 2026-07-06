import React from 'react';

export type ComparisonBar = {
  key: string;
  label: string;
  value: number;
  color: string;
};

type Props = {
  bars: ComparisonBar[];
  unit?: string;
};

export const ComparisonChart: React.FC<Props> = ({ bars, unit = 'km' }) => {
  const max = Math.max(...bars.map((b) => b.value), 0.0001);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {bars.map((bar) => {
        const pct = Math.max(2, (bar.value / max) * 100);
        return (
          <div key={bar.key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span className="label-medium" style={{ color: 'var(--on-surface)' }}>
                {bar.label}
              </span>
              <span className="label-medium" style={{ color: 'var(--on-surface-variant)' }}>
                {bar.value.toFixed(2)} {unit}
              </span>
            </div>
            <div
              style={{
                height: 14,
                borderRadius: 8,
                background: 'color-mix(in srgb, var(--outline) 12%, transparent)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${pct}%`,
                  height: '100%',
                  borderRadius: 8,
                  background: bar.color,
                  transition: 'width 600ms cubic-bezier(0.22, 1, 0.36, 1)',
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
