import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StackHeader } from '@app/StackHeader';
import { AppButton } from '@shared/components/AppButton';
import { ErrorMessage } from '@shared/components/ErrorMessage';
import { Icon } from '@shared/components/Icon';
import { LoadingOverlay } from '@shared/components/LoadingOverlay';
import {
  VerificationStatus,
  verificationStatusLabel,
} from '@shared/types/verification';
import { useAuthStore } from '@features/auth/store/authStore';

const STEPS = [
  { icon: 'badge', text: 'Încarcă buletinul' },
  { icon: 'photo-camera-front', text: 'Adaugă un selfie' },
  { icon: 'verified', text: 'Devii ghid instant' },
];

// Visual tone per verification status, for the status pill.
const statusTone = (status: VerificationStatus) => {
  switch (status) {
    case 'approved':
      return { icon: 'check-circle', color: 'var(--primary)', bg: 'color-mix(in srgb, var(--primary) 13%, transparent)' };
    case 'rejected':
      return { icon: 'cancel', color: 'var(--error)', bg: 'var(--error-container)' };
    case 'manualReview':
    case 'pending':
      return { icon: 'pending-actions', color: '#8a6d00', bg: 'color-mix(in srgb, #f5c518 22%, transparent)' };
    default:
      return { icon: 'badge', color: 'var(--on-surface-variant)', bg: 'var(--surface-container-high)' };
  }
};

export const VerificationPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    currentUser,
    isLoading,
    errorMessage,
    verificationScore,
    verificationReason,
    verificationCanSubmit,
    verificationBlockedReason,
    refreshVerificationStatus,
    submitVerification,
  } = useAuthStore();

  const [idCardImage, setIdCardImage] = useState<File | null>(null);
  const [selfieImage, setSelfieImage] = useState<File | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const status: VerificationStatus = currentUser?.verificationStatus ?? 'notSubmitted';
  const uploadLocked = !verificationCanSubmit;
  const tone = statusTone(status);

  useEffect(() => {
    refreshVerificationStatus();
  }, [refreshVerificationStatus]);

  const submit = async () => {
    if (uploadLocked || idCardImage == null || selfieImage == null) return;
    const ok = await submitVerification({ idCardImage, selfieImage });
    if (ok) {
      setIdCardImage(null);
      setSelfieImage(null);
      const { currentUser: updated } = useAuthStore.getState();
      const outcome = updated?.verificationStatus ?? 'notSubmitted';
      const body =
        outcome === 'approved'
          ? 'Fețele se potrivesc. Ești acum ghid și poți publica tururi.'
          : outcome === 'manualReview'
            ? 'Potrivirea pare bună, dar calitatea imaginii cere decizia unui administrator. Nu poți încărca din nou până atunci.'
            : outcome === 'rejected'
              ? 'Verificarea a fost respinsă. Așteaptă ca un administrator să permită o nouă încercare.'
              : 'Documentele au fost trimise.';
      setNotice(body);
      setTimeout(() => navigate(-1), 1800);
    }
  };

  const canSubmit = !uploadLocked && !!idCardImage && !!selfieImage && !isLoading;

  return (
    <div className="app-shell">
      <StackHeader title="Devino ghid" />
      <LoadingOverlay isLoading={isLoading}>
        <div className="app-content" style={{ overflowY: 'auto' }}>
          <div className="verify-hero">
            <div style={{ maxWidth: 720, margin: '0 auto' }}>
              <span className="vc-eyebrow">
                <Icon name="verified-user" size={14} /> VERIFICARE DE IDENTITATE
              </span>
              <div className="headline-small" style={{ marginTop: 8 }}>Devino ghid</div>
              <p className="body-medium" style={{ color: 'var(--on-surface-variant)', marginTop: 6, maxWidth: 520 }}>
                Confirmăm că ești o persoană reală comparând fața din buletin cu un selfie.
                Dacă se potrivesc, devii ghid pe loc și poți publica tururi.
              </p>
              <div className="verify-steps">
                {STEPS.map((s, i) => (
                  <div key={i} className="verify-step">
                    <span className="vs-num">{i + 1}</span>
                    <Icon name={s.icon} size={20} color="var(--primary-strong)" />
                    <span className="vs-text">{s.text}</span>
                  </div>
                ))}
              </div>
              <div className="status-pill" style={{ background: tone.bg, color: tone.color }}>
                <Icon name={tone.icon} size={15} color={tone.color} />
                {verificationStatusLabel(status)}
              </div>
            </div>
          </div>

          <div className="page" style={{ paddingTop: 18 }}>
            {uploadLocked && verificationBlockedReason ? (
              <div
                className="body-small"
                style={{
                  padding: '11px 14px',
                  borderRadius: 12,
                  background: 'var(--surface-container-high)',
                  color: 'var(--on-surface-variant)',
                  marginBottom: 14,
                  fontWeight: 600,
                }}
              >
                {verificationBlockedReason}
              </div>
            ) : null}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, opacity: uploadLocked ? 0.5 : 1 }}>
              <UploadZone
                icon="badge"
                title="Buletin de identitate"
                hint="Fotografiază sau încarcă poza buletinului"
                file={idCardImage}
                disabled={uploadLocked}
                onPicked={setIdCardImage}
              />
              <UploadZone
                icon="photo-camera-front"
                title="Selfie"
                hint="O poză clară cu fața ta, bine luminată"
                file={selfieImage}
                disabled={uploadLocked}
                onPicked={setSelfieImage}
              />
            </div>

            {errorMessage ? (
              <div style={{ marginTop: 12 }}>
                <ErrorMessage message={errorMessage} />
              </div>
            ) : null}

            {notice ? (
              <div
                className="body-medium rise-in"
                style={{
                  padding: 13,
                  borderRadius: 14,
                  marginTop: 12,
                  background: 'color-mix(in srgb, var(--primary-container) 55%, transparent)',
                  color: 'var(--on-primary-container)',
                  fontWeight: 600,
                }}
              >
                {notice}
              </div>
            ) : null}

            {verificationReason || verificationScore != null ? (
              <div className="verify-analysis">
                <div className="title-small" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="insights" size={16} color="var(--primary-strong)" />
                  Detalii analiză
                </div>
                {verificationScore != null ? (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span className="body-small" style={{ color: 'var(--on-surface-variant)' }}>
                        Scor de potrivire facială
                      </span>
                      <span className="label-medium">{verificationScore.toFixed(3)}</span>
                    </div>
                    <div className="va-bar">
                      <div
                        className="va-bar-fill"
                        style={{
                          width: `${Math.min(100, Math.max(0, verificationScore * 100))}%`,
                          background:
                            verificationScore >= 0.55 ? 'var(--primary)' : 'var(--error)',
                        }}
                      />
                    </div>
                    <div className="body-small" style={{ color: 'var(--on-surface-variant)', marginTop: 5 }}>
                      Prag de aprobare: 0.55
                    </div>
                  </div>
                ) : null}
                {verificationReason ? (
                  <div className="body-small" style={{ color: 'var(--on-surface-variant)', marginTop: 10 }}>
                    Motiv: {verificationReason}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div style={{ height: 18 }} />
            <AppButton
              label="Trimite spre verificare"
              iconName="verified-user"
              disabled={!canSubmit}
              onPress={submit}
            />
            <div style={{ height: 10 }} />
            <AppButton
              label="Reîmprospătează starea"
              variant="text"
              iconName="refresh"
              disabled={isLoading}
              onPress={() => refreshVerificationStatus()}
            />
            <div style={{ height: 24 }} />
          </div>
        </div>
      </LoadingOverlay>
    </div>
  );
};

type UploadZoneProps = {
  icon: string;
  title: string;
  hint: string;
  file: File | null;
  disabled?: boolean;
  onPicked: (file: File) => void;
};

const UploadZone: React.FC<UploadZoneProps> = ({
  icon,
  title,
  hint,
  file,
  disabled = false,
  onPicked,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (file == null) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const open = () => {
    if (!disabled) inputRef.current?.click();
  };

  const filled = file != null;

  return (
    <div
      className={`upload-zone${filled ? ' filled' : ''}${disabled ? ' locked' : ''}`}
      onClick={open}
      role="button"
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPicked(f);
          e.target.value = '';
        }}
      />
      {previewUrl ? <img src={previewUrl} alt={title} className="uz-preview" /> : null}

      {filled ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Icon name="check-circle" size={20} color="#1b7f4a" />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span className="title-small" style={{ display: 'block' }}>{title}</span>
            <span
              className="body-small"
              style={{
                color: 'var(--on-surface-variant)',
                display: 'block',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {file!.name}
            </span>
          </span>
          <span className="label-medium" style={{ color: 'var(--primary)' }}>Schimbă</span>
        </div>
      ) : (
        <>
          <span className="uz-icon">
            <Icon name={icon} size={24} color="var(--primary-strong)" />
          </span>
          <div className="title-small">{title}</div>
          <div className="body-small" style={{ color: 'var(--on-surface-variant)', marginTop: 3 }}>
            {hint}
          </div>
        </>
      )}
    </div>
  );
};
