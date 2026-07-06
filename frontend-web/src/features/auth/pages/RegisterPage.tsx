import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppButton } from '@shared/components/AppButton';
import { CustomTextField } from '@shared/components/CustomTextField';
import { LoadingOverlay } from '@shared/components/LoadingOverlay';
import { Validators } from '@shared/utils/validators';
import { useAuthStore } from '../store/authStore';

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { register, isLoading, errorMessage, clearError } = useAuthStore();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [showFieldErrors, setShowFieldErrors] = useState(false);

  const firstNameError = showFieldErrors
    ? Validators.required('Prenumele')(firstName)
    : undefined;
  const lastNameError = showFieldErrors
    ? Validators.required('Numele')(lastName)
    : undefined;
  const emailError = showFieldErrors ? Validators.email(email) : undefined;
  const passwordError = showFieldErrors ? Validators.password(password) : undefined;
  const phoneError = showFieldErrors ? Validators.phone(phone) : undefined;

  const handleRegister = async () => {
    setShowFieldErrors(true);
    if (
      Validators.required('Prenumele')(firstName) ||
      Validators.required('Numele')(lastName) ||
      Validators.email(email) ||
      Validators.password(password) ||
      Validators.phone(phone)
    ) {
      return;
    }
    clearError();
    await register({
      email: email.trim(),
      password,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phoneNumber: phone.trim() || undefined,
    });
  };

  return (
    <div className="app-shell">
      <LoadingOverlay isLoading={isLoading}>
        <div className="auth-page" style={{ alignItems: 'flex-start', overflowY: 'auto' }}>
          <form
            className="auth-card rise-in"
            onSubmit={(e) => {
              e.preventDefault();
              handleRegister();
            }}
          >
            <div className="auth-brand">
              <div className="brand-badge">🗺️</div>
              <span className="brand-eyebrow-line">Smart City · Cluj-Napoca</span>
              <div className="headline-small">Creează-ți contul</div>
              <div
                className="body-medium"
                style={{ color: 'var(--on-surface-variant)', marginTop: 6 }}
              >
                Câteva detalii și ești gata de explorat.
              </div>
            </div>

            <CustomTextField
              label="Prenume"
              hint="Ion"
              value={firstName}
              onChangeText={setFirstName}
              prefixIcon="badge"
              errorMessage={firstNameError}
            />
            <div style={{ height: 16 }} />
            <CustomTextField
              label="Nume"
              hint="Popescu"
              value={lastName}
              onChangeText={setLastName}
              prefixIcon="badge"
              errorMessage={lastNameError}
            />
            <div style={{ height: 16 }} />
            <CustomTextField
              label="Email"
              hint="tu@exemplu.com"
              value={email}
              onChangeText={setEmail}
              type="email"
              prefixIcon="mail-outline"
              errorMessage={emailError}
            />
            <div style={{ height: 16 }} />
            <CustomTextField
              label="Parolă"
              hint="Minim 6 caractere"
              value={password}
              onChangeText={setPassword}
              obscureText
              prefixIcon="lock-outline"
              errorMessage={passwordError}
            />
            <div style={{ height: 16 }} />
            <CustomTextField
              label="Telefon (opțional)"
              hint="07xx xxx xxx"
              value={phone}
              onChangeText={setPhone}
              type="tel"
              prefixIcon="phone"
              errorMessage={phoneError}
            />
            <div style={{ height: 16 }} />

            {errorMessage ? (
              <div className="body-medium" style={{ color: 'var(--error)', textAlign: 'center' }}>
                {errorMessage}
              </div>
            ) : null}

            <div style={{ height: 24 }} />
            <AppButton label="Creează cont" onPress={handleRegister} disabled={isLoading} />
            <div style={{ height: 16 }} />
            <AppButton
              label="Ai deja cont? Autentifică-te"
              variant="text"
              onPress={() => navigate('/login')}
            />
            <button type="submit" hidden />
          </form>
        </div>
      </LoadingOverlay>
    </div>
  );
};
