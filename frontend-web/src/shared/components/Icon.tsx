import React from 'react';

type Props = {
  name: string;
  size?: number;
  color?: string;
  style?: React.CSSProperties;
  className?: string;
};

export const Icon: React.FC<Props> = ({ name, size = 24, color, style, className }) => (
  <span
    className={`material-icons-round${className ? ` ${className}` : ''}`}
    style={{ fontSize: size, color, lineHeight: 1, ...style }}
    aria-hidden
  >
    {name.replace(/-/g, '_')}
  </span>
);
