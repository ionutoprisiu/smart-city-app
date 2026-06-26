import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppButton } from '@shared/components/AppButton';
import { CustomTextField } from '@shared/components/CustomTextField';
import { Icon } from '@shared/components/Icon';
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
    ? Validators.required('First name')(firstName)
    : undefined;
  const lastNameError = showFieldErrors
    ? Validators.required('Last name')(lastName)
    : undefined;
  const emailError = showFieldErrors ? Validators.email(email) : undefined;
  const passwordError = showFieldErrors ? Validators.password(password) : undefined;
  const phoneError = showFieldErrors ? Validators.phone(phone) : undefined;

  const handleRegister = async () => {
    setShowFieldErrors(true);
    if (
      Validators.required('First name')(firstName) ||
      Validators.required('Last name')(lastName) ||
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
        <div className="app-content">
          <form
            className="page"
            style={{ maxWidth: 480 }}
            onSubmit={(e) => {
              e.preventDefault();
              handleRegister();
            }}
          >
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                background: 'var(--primary-container)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto',
              }}
            >
              <Icon name="person-add" size={38} color="var(--primary)" />
            </div>
            <div style={{ height: 24 }} />
            <div className="headline-small" style={{ textAlign: 'center' }}>
              Join Smart City
            </div>
            <div
              className="body-medium"
              style={{ color: 'var(--on-surface-variant)', textAlign: 'center', marginTop: 8 }}
            >
              A few details and you're ready to explore.
            </div>
            <div style={{ height: 32 }} />

            <CustomTextField
              label="First name"
              hint="Ion"
              value={firstName}
              onChangeText={setFirstName}
              prefixIcon="badge"
              errorMessage={firstNameError}
            />
            <div style={{ height: 16 }} />
            <CustomTextField
              label="Last name"
              hint="Popescu"
              value={lastName}
              onChangeText={setLastName}
              prefixIcon="badge"
              errorMessage={lastNameError}
            />
            <div style={{ height: 16 }} />
            <CustomTextField
              label="Email"
              hint="you@example.com"
              value={email}
              onChangeText={setEmail}
              type="email"
              prefixIcon="mail-outline"
              errorMessage={emailError}
            />
            <div style={{ height: 16 }} />
            <CustomTextField
              label="Password"
              hint="At least 6 characters"
              value={password}
              onChangeText={setPassword}
              obscureText
              prefixIcon="lock-outline"
              errorMessage={passwordError}
            />
            <div style={{ height: 16 }} />
            <CustomTextField
              label="Phone (optional)"
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
            <AppButton label="Create account" onPress={handleRegister} disabled={isLoading} />
            <div style={{ height: 16 }} />
            <AppButton
              label="Already have an account? Sign in"
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
