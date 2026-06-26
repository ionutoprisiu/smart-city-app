import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StackHeader } from '@app/StackHeader';
import { AppButton } from '@shared/components/AppButton';
import { ErrorMessage } from '@shared/components/ErrorMessage';
import { useAuthStore } from '@features/auth/store/authStore';
import { ActivitiesApi } from '../api/activitiesApi';
import { ACTIVITIES_CITY } from '../constants';

const CLUB_CATEGORIES = ['OTHER', 'CULTURE', 'SPORTS', 'MUSIC', 'TECH', 'OUTDOORS'] as const;

type ClubVisibility = 'PUBLIC' | 'APPROVAL_REQUIRED';

const inputStyle: React.CSSProperties = {
  borderRadius: 12,
  padding: '11px 12px',
  background: 'var(--surface-container-low)',
  color: 'var(--on-surface)',
  width: '100%',
  fontSize: 15,
};

const labelStyle: React.CSSProperties = {
  color: 'var(--on-surface-variant)',
  marginTop: 10,
  marginBottom: 4,
};

export const CreateClubPage: React.FC = () => {
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.currentUser);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>('OTHER');
  const [visibility, setVisibility] = useState<ClubVisibility>('PUBLIC');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async () => {
    if (!currentUser) return;
    setErrorMessage(null);
    const n = name.trim();
    if (n.length < 3) {
      setErrorMessage('Club name must be at least 3 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      await ActivitiesApi.createClub({
        name: n,
        description: description.trim() || undefined,
        category,
        visibility,
      });
      navigate(-1);
    } catch (e: unknown) {
      setErrorMessage(String((e as { message?: string })?.message ?? e ?? 'Could not create club'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const visibilityBtn = (value: ClubVisibility, label: string) => {
    const active = visibility === value;
    return (
      <button
        type="button"
        onClick={() => setVisibility(value)}
        style={{
          flex: 1,
          borderRadius: 10,
          padding: '12px 0',
          background: active ? 'var(--primary-container)' : 'var(--surface-container-high)',
          color: active ? 'var(--on-primary-container)' : 'var(--on-surface-variant)',
          fontWeight: 600,
          fontSize: 14,
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="app-shell">
      <StackHeader title="Create group" />
      <div className="app-content" style={{ overflowY: 'auto' }}>
        <div style={{ padding: '16px 16px 40px', maxWidth: 720, margin: '0 auto', width: '100%' }}>
          {errorMessage ? <ErrorMessage message={errorMessage} /> : null}

          <div className="title-small">Club profile</div>
          <div className="label-medium" style={labelStyle}>Name</div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Urban sketchers Cluj"
            style={inputStyle}
          />
          <div className="label-medium" style={labelStyle}>Description</div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this club about?"
            style={{ ...inputStyle, minHeight: 88, resize: 'vertical' }}
          />

          <div className="label-medium" style={labelStyle}>Category</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
            {CLUB_CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                style={{
                  borderRadius: 999,
                  padding: '8px 12px',
                  background:
                    category === c ? 'var(--primary-container)' : 'var(--surface-container-high)',
                  color:
                    category === c ? 'var(--on-primary-container)' : 'var(--on-surface-variant)',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {c}
              </button>
            ))}
          </div>

          <div
            style={{
              ...inputStyle,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 16,
            }}
          >
            <span className="label-medium">City</span>
            <span className="body-medium" style={{ fontWeight: 600 }}>{ACTIVITIES_CITY}</span>
          </div>
          <div className="body-small" style={{ color: 'var(--on-surface-variant)', marginTop: 6 }}>
            Clubs are only created for Cluj-Napoca.
          </div>

          <div className="title-small" style={{ marginTop: 18 }}>Membership</div>
          <div className="body-small" style={{ color: 'var(--on-surface-variant)', marginBottom: 8 }}>
            Open clubs let anyone join instantly. Approval clubs require organizer review.
          </div>
          <div
            style={{
              display: 'flex',
              gap: 6,
              background: 'var(--surface-container-low)',
              borderRadius: 12,
              padding: 4,
            }}
          >
            {visibilityBtn('PUBLIC', 'Open join')}
            {visibilityBtn('APPROVAL_REQUIRED', 'Approval required')}
          </div>

          <div style={{ height: 22 }} />
          <AppButton
            label="Create club"
            onPress={onSubmit}
            loading={isSubmitting}
            disabled={!currentUser}
          />
        </div>
      </div>
    </div>
  );
};
