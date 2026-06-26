import React from 'react';

type Props = {
  size?: 'small' | 'medium' | 'large';
  style?: React.CSSProperties;
};

export const Spinner: React.FC<Props> = ({ size = 'medium', style }) => (
  <div
    className={`spinner${size === 'small' ? ' small' : size === 'large' ? ' large' : ''}`}
    style={style}
  />
);
