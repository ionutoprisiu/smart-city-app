import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppButton } from '@shared/components/AppButton';
import { CustomTextField } from '@shared/components/CustomTextField';
import { Icon } from '@shared/components/Icon';
import { LoadingOverlay } from '@shared/components/LoadingOverlay';
import { Validators } from '@shared/utils/validators';
import { useAuthStore } from '../store/authStore';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, isLoading, errorMessage, clearError } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showFieldErrors, setShowFieldErrors] = useState(false);

  const emailError = showFieldErrors ? Validators.email(email) : undefined;
  const passwordError = showFieldErrors ? Validators.password(password) : undefined;

  const handleLogin = async () => {
    setShowFieldErrors(true);
    if (Validators.email(email) || Validators.password(password)) return;
    clearError();
    await login({ email: email.trim(), password });
  };

  return (
    <div className="app-shell">
      <LoadingOverlay isLoading={isLoading}>
        <div className="app-content">
          <form
            className="page"
            style={{ maxWidth: 480 }}
            onSubmit={(e) => {
              e.preventDefault();
              handleLogin();
            }}
          >
            <div style={{ height: 24 }} />
            <div
              style={{
                width: 88,
                height: 88,
                borderRadius: 44,
                background: 'var(--primary-container)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto',
              }}
            >
              <Icon name="lock-open" size={40} color="var(--primary)" />
            </div>
            <div style={{ height: 32 }} />
            <div className="headline-small" style={{ textAlign: 'center' }}>
              Welcome back
            </div>
            <div
              className="body-medium"
              style={{ color: 'var(--on-surface-variant)', textAlign: 'center', marginTop: 8 }}
            >
              Sign in to explore Cluj and plan your visits.
            </div>
            <div style={{ height: 32 }} />

            <CustomTextField
              label="Email"
              hint="you@example.com"
              value={email}
              onChangeText={setEmail}
              validator={Validators.email}
              type="email"
              prefixIcon="mail-outline"
              errorMessage={emailError}
            />
            <div style={{ height: 16 }} />
            <CustomTextField
              label="Password"
              hint="Your password"
              value={password}
              onChangeText={setPassword}
              validator={Validators.password}
              obscureText
              prefixIcon="lock-outline"
              errorMessage={passwordError}
            />
            <div style={{ height: 16 }} />

            {errorMessage ? (
              <div className="body-medium" style={{ color: 'var(--error)', textAlign: 'center' }}>
                {errorMessage}
              </div>
            ) : null}

            <div style={{ height: 24 }} />
            <AppButton label="Sign in" onPress={handleLogin} disabled={isLoading} />
            <div style={{ height: 16 }} />
            <AppButton
              label="No account yet? Create one"
              variant="text"
              onPress={() => navigate('/register')}
            />
            <button type="submit" hidden />
          </form>
        </div>
      </LoadingOverlay>
    </div>
  );
};
