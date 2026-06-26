import React, { useState } from 'react';
import { Icon } from './Icon';

type Props = {
  label: string;
  hint?: string;
  value: string;
  onChangeText: (text: string) => void;
  validator?: (value: string) => string | undefined;
  obscureText?: boolean;
  type?: string;
  prefixIcon?: string;
  enabled?: boolean;
  errorMessage?: string;
};

export const CustomTextField: React.FC<Props> = ({
  label,
  hint,
  value,
  onChangeText,
  validator,
  obscureText = false,
  type,
  prefixIcon,
  enabled = true,
  errorMessage,
}) => {
  const [focused, setFocused] = useState(false);
  const [touched, setTouched] = useState(false);

  const error = touched ? validator?.(value) ?? errorMessage : errorMessage;

  return (
    <div>
      <div className={`text-field${focused ? ' focused' : ''}${error ? ' error' : ''}`}>
        {prefixIcon ? <Icon name={prefixIcon} size={20} className="prefix-icon" /> : null}
        <div className="field-main">
          <span className="field-label">{label}</span>
          <input
            value={value}
            onChange={(e) => onChangeText(e.target.value)}
            placeholder={hint}
            type={obscureText ? 'password' : type ?? 'text'}
            disabled={!enabled}
            autoCapitalize="off"
            autoCorrect="off"
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false);
              setTouched(true);
            }}
          />
        </div>
      </div>
      {error ? <div className="field-error">{error}</div> : null}
    </div>
  );
};
