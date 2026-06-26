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
          ? 'Face match passed. You are now an organizer and can create events in Community.'
          : outcome === 'manualReview'
            ? 'Face match looks OK but image quality needs an admin decision. You cannot upload again until then.'
            : outcome === 'rejected'
              ? 'Verification was rejected. Contact support or wait for an admin to allow a new submission.'
              : 'Your documents were submitted.';
      setNotice(body);
      setTimeout(() => navigate(-1), 1600);
    }
  };

  const statusColor = (() => {
    switch (status) {
      case 'approved':
        return 'var(--primary)';
      case 'rejected':
        return 'var(--error)';
      case 'manualReview':
      case 'pending':
        return 'var(--tertiary, var(--primary))';
      case 'notSubmitted':
      default:
        return 'var(--on-surface-variant)';
    }
  })();

  return (
    <div className="app-shell">
      <StackHeader title="Become an organizer" />
      <LoadingOverlay isLoading={isLoading}>
        <div className="app-content" style={{ overflowY: 'auto' }}>
          <div style={{ padding: 16, maxWidth: 720, margin: '0 auto', width: '100%' }}>
            <div className="title-medium">
              Upload your ID card and a matching selfie. When InsightFace confirms your identity,
              you become an organizer immediately. If image quality is unclear, an admin will
              review your case.
            </div>
            <div className="body-medium" style={{ color: statusColor, marginTop: 8 }}>
              Status: {verificationStatusLabel(status)}
            </div>
            {uploadLocked && verificationBlockedReason ? (
              <div className="body-medium" style={{ color: 'var(--on-surface-variant)', marginTop: 8 }}>
                {verificationBlockedReason}
              </div>
            ) : null}

            <div style={{ height: 18 }} />
            <div style={{ opacity: uploadLocked ? 0.45 : 1 }}>
              <ImagePickCard
                title="ID card image"
                file={idCardImage}
                disabled={uploadLocked}
                onPicked={setIdCardImage}
              />
              <div style={{ height: 12 }} />
              <ImagePickCard
                title="Selfie image"
                file={selfieImage}
                disabled={uploadLocked}
                onPicked={setSelfieImage}
              />
            </div>

            <div style={{ height: 12 }} />
            {errorMessage ? <ErrorMessage message={errorMessage} /> : null}
            {notice ? (
              <div
                className="body-medium"
                style={{
                  padding: 12,
                  borderRadius: 12,
                  background: 'color-mix(in srgb, var(--primary-container) 55%, transparent)',
                  color: 'var(--on-primary-container)',
                }}
              >
                {notice}
              </div>
            ) : null}

            {verificationReason || verificationScore != null ? (
              <div
                style={{
                  padding: 14,
                  borderRadius: 14,
                  border: '1px solid var(--outline-variant)',
                  background: 'color-mix(in srgb, var(--surface-container-highest) 40%, transparent)',
                  marginTop: 12,
                }}
              >
                <div className="title-small">Analysis details</div>
                <div style={{ height: 8 }} />
                {verificationScore != null ? (
                  <div className="body-medium">Score: {verificationScore.toFixed(3)}</div>
                ) : null}
                {verificationReason ? (
                  <div className="body-medium">Reason: {verificationReason}</div>
                ) : null}
              </div>
            ) : null}

            <div style={{ height: 16 }} />
            <AppButton
              label="Refresh analysis data"
              variant="outlined"
              iconName="refresh"
              disabled={isLoading}
              onPress={() => refreshVerificationStatus()}
            />
            <div style={{ height: 10 }} />
            <AppButton
              label="Submit identity verification"
              iconName="verified-user"
              disabled={uploadLocked || !idCardImage || !selfieImage || isLoading}
              onPress={submit}
            />
            <div style={{ height: 24 }} />
          </div>
        </div>
      </LoadingOverlay>
    </div>
  );
};

type ImagePickCardProps = {
  title: string;
  file: File | null;
  disabled?: boolean;
  onPicked: (file: File) => void;
};

const ImagePickCard: React.FC<ImagePickCardProps> = ({
  title,
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

  const openPicker = () => {
    if (disabled) return;
    inputRef.current?.click();
  };

  return (
    <div
      style={{
        padding: 14,
        borderRadius: 14,
        border: '1px solid var(--outline-variant)',
        background: disabled
          ? 'color-mix(in srgb, var(--surface-container-highest) 27%, transparent)'
          : 'transparent',
      }}
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
      {previewUrl ? (
        <img
          src={previewUrl}
          alt={title}
          style={{
            width: '100%',
            height: 180,
            borderRadius: 10,
            marginBottom: 10,
            objectFit: 'cover',
          }}
        />
      ) : null}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <span
          className="body-medium"
          style={{
            flex: 1,
            color: disabled ? 'var(--outline)' : 'var(--on-surface)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {file == null ? `${title} (not selected)` : file.name}
        </span>
        <button
          type="button"
          onClick={openPicker}
          disabled={disabled}
          style={{ padding: 8, display: 'flex' }}
        >
          <Icon
            name="photo-camera"
            size={22}
            color={disabled ? 'var(--outline)' : 'var(--on-surface-variant)'}
          />
        </button>
        <button
          type="button"
          onClick={openPicker}
          disabled={disabled}
          style={{ padding: '8px 12px' }}
        >
          <span
            className="label-large"
            style={{ color: disabled ? 'var(--outline)' : 'var(--primary)' }}
          >
            Choose file
          </span>
        </button>
      </div>
    </div>
  );
};
