import React from 'react';
import { Icon } from './Icon';
import { Spinner } from './Spinner';

type Variant = 'filled' | 'outlined' | 'text' | 'tonal' | 'destructive';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  iconName?: string;
  disabled?: boolean;
  loading?: boolean;
  style?: React.CSSProperties;
};

export const AppButton: React.FC<Props> = ({
  label,
  onPress,
  variant = 'filled',
  iconName,
  disabled = false,
  loading = false,
  style,
}) => {
  const isDisabled = disabled || loading;
  return (
    <button
      type="button"
      className={`app-button ${variant}`}
      disabled={isDisabled}
      onClick={isDisabled ? undefined : onPress}
      style={style}
    >
      {loading ? (
        <Spinner size="small" />
      ) : (
        <>
          {iconName ? <Icon name={iconName} size={20} /> : null}
          {label}
        </>
      )}
    </button>
  );
};
