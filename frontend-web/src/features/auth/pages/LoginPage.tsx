import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppButton } from '@shared/components/AppButton';
import { CustomTextField } from '@shared/components/CustomTextField';
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
  const passwordError = showFieldErrors ? Validators.loginPassword(password) : undefined;

  const handleLogin = async () => {
    setShowFieldErrors(true);
    if (Validators.email(email) || Validators.loginPassword(password)) return;
    clearError();
    await login({ email: email.trim(), password });
  };

  return (
    <div className="app-shell">
      <LoadingOverlay isLoading={isLoading}>
        <div className="auth-page">
          <form
            className="auth-card rise-in"
            onSubmit={(e) => {
              e.preventDefault();
              handleLogin();
            }}
          >
            <div className="auth-brand">
              <div className="brand-badge">🗺️</div>
              <span className="brand-eyebrow-line">Smart City · Cluj-Napoca</span>
              <div className="headline-small">Bine ai revenit</div>
              <div
                className="body-medium"
                style={{ color: 'var(--on-surface-variant)', marginTop: 6 }}
              >
                Trasee optime prin oraș, construite de algoritm.
              </div>
            </div>

            <CustomTextField
              label="Email"
              hint="tu@exemplu.com"
              value={email}
              onChangeText={setEmail}
              validator={Validators.email}
              type="email"
              prefixIcon="mail-outline"
              errorMessage={emailError}
            />
            <div style={{ height: 16 }} />
            <CustomTextField
              label="Parolă"
              hint="Parola ta"
              value={password}
              onChangeText={setPassword}
              validator={Validators.loginPassword}
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
            <AppButton label="Autentificare" onPress={handleLogin} disabled={isLoading} />
            <div style={{ height: 16 }} />
            <AppButton
              label="Nu ai cont? Creează unul"
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
