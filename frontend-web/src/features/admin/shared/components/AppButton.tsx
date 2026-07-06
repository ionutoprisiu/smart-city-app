import React from "react";
import { Icon } from "../../components/Icon";
import { Spinner } from "./Spinner";

type Variant = "filled" | "outlined" | "text" | "tonal" | "destructive";

type Props = {
  label: string;
  onPress?: () => void;
  type?: "button" | "submit";
  variant?: Variant;
  iconName?: string;
  disabled?: boolean;
  loading?: boolean;
  style?: React.CSSProperties;
  className?: string;
};

export const AppButton: React.FC<Props> = ({
  label,
  onPress,
  type = "button",
  variant = "filled",
  iconName,
  disabled = false,
  loading = false,
  style,
  className,
}) => {
  const isDisabled = disabled || loading;
  return (
    <button
      type={type}
      className={`app-button ${variant}${className ? ` ${className}` : ""}`}
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
