import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BottomSheet } from '@shared/components/BottomSheet';
import { Icon } from '@shared/components/Icon';
import { StorageService } from '@shared/storage/storageService';
import { fullName } from '@shared/types/user';
import { roleDisplay } from '@shared/types/role';
import { verificationStatusLabel } from '@shared/types/verification';
import { useAuthStore } from '@features/auth/store/authStore';

const verificationTone = (status: string) => {
  if (status === 'approved') {
    return {
      icon: 'check-circle',
      color: 'var(--primary)',
      bg: 'color-mix(in srgb, var(--primary-container) 40%, transparent)',
    };
  }
  if (status === 'rejected') {
    return {
      icon: 'cancel',
      color: 'var(--error)',
      bg: 'color-mix(in srgb, var(--error-container) 40%, transparent)',
    };
  }
  return {
    icon: 'pending-actions',
    color: 'var(--tertiary, var(--primary))',
    bg: 'var(--surface-container-high)',
  };
};

const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const max = 512;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (ctx == null) {
        URL.revokeObjectURL(url);
        reject(new Error('Canvas unavailable'));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not load image'));
    };
    img.src = url;
  });

export const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const {
    currentUser,
    logout,
    verificationReason,
    canAccessGuideFlow,
    guideFlowBlockedReason,
    refreshVerificationStatus,
  } = useAuthStore();
  const setAuthState = useAuthStore.setState;

  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const [photoSheet, setPhotoSheet] = useState(false);
  const [logoutSheet, setLogoutSheet] = useState(false);

  useEffect(() => {
    refreshVerificationStatus().catch(() => {});
  }, [refreshVerificationStatus]);

  if (!currentUser) return null;

  const isGuide = currentUser.role === 'guide' || currentUser.role === 'admin';
  const verificationStatus = currentUser.verificationStatus ?? 'notSubmitted';
  const guideLocked = !canAccessGuideFlow;
  const guideSubtitle = (() => {
    if (guideFlowBlockedReason) return guideFlowBlockedReason;
    if (isGuide) return 'Poți publica tururi tematice din tab-ul Tururi.';
    if (verificationStatus === 'approved' && currentUser.isVerified) {
      return 'Identitate verificată.';
    }
    if (verificationStatus === 'notSubmitted') {
      return verificationReason ?? 'Încarcă buletinul și un selfie pentru verificare.';
    }
    return verificationStatusLabel(verificationStatus);
  })();

  const initials =
    `${currentUser.firstName[0] ?? ''}${currentUser.lastName[0] ?? ''}`.toUpperCase();

  const updateProfilePhoto = (uri: string | null) => {
    if (uri) {
      StorageService.saveUserProfilePhotoUri(uri);
    } else {
      StorageService.clearUserProfilePhotoUri();
    }
    setAuthState({
      currentUser: {
        ...currentUser,
        profilePhotoUri: uri,
      },
    });
  };

  const onPhotoSelected = async (file: File) => {
    try {
      const dataUrl = await fileToDataUrl(file);
      updateProfilePhoto(dataUrl);
    } catch {}
  };

  const vTone = verificationTone(currentUser.verificationStatus);

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPhotoSelected(f);
          e.target.value = '';
        }}
      />

      <div className="profile-hero">
        <button type="button" className="avatar-ring" onClick={() => setPhotoSheet(true)}>
          <div className="avatar-inner">
            {currentUser.profilePhotoUri ? (
              <img
                src={currentUser.profilePhotoUri}
                alt="Profil"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <span className="headline-small" style={{ color: 'var(--on-primary-container)' }}>
                {initials}
              </span>
            )}
          </div>
          <span className="avatar-edit">
            <Icon name="photo-camera" size={15} color="var(--on-primary)" />
          </span>
        </button>

        <div className="headline-small" style={{ marginTop: 16 }}>{fullName(currentUser)}</div>
        <div className="body-medium" style={{ color: 'var(--on-surface-variant)', marginTop: 4 }}>
          {currentUser.email}
        </div>

        <div
          style={{
            display: 'flex',
            gap: 8,
            marginTop: 14,
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          <span className="profile-chip">
            <Icon
              name={
                currentUser.role === 'admin'
                  ? 'admin-panel-settings'
                  : isGuide
                  ? 'tour'
                  : 'person'
              }
              size={15}
              color="var(--primary)"
            />
            {roleDisplay(currentUser.role)}
          </span>
          <span className="profile-chip" style={{ background: vTone.bg, color: vTone.color }}>
            <Icon name={vTone.icon} size={15} color={vTone.color} />
            {verificationStatusLabel(currentUser.verificationStatus)}
          </span>
        </div>
      </div>

      <div style={{ padding: '18px 16px 28px', maxWidth: 720, margin: '0 auto', width: '100%' }}>
        {/* Guide journey — the card that ties verification to publishing tours. */}
        <button
          type="button"
          className={`guide-cta rise-in${isGuide ? ' done' : ''}`}
          disabled={guideLocked}
          onClick={() => navigate('/become-guide')}
        >
          <span className="gc-icon">
            <Icon name={isGuide ? 'verified' : 'verified-user'} size={24} color="#ffffff" />
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span className="title-medium" style={{ display: 'block' }}>
              {isGuide ? 'Ești ghid verificat' : 'Devino ghid'}
            </span>
            <span
              className="body-small"
              style={{ color: 'var(--on-surface-variant)', display: 'block', marginTop: 3 }}
            >
              {guideSubtitle}
            </span>
          </span>
          {!isGuide ? (
            <Icon
              name={guideLocked ? vTone.icon : 'arrow-forward'}
              size={22}
              color={guideLocked ? 'var(--outline)' : 'var(--primary)'}
            />
          ) : null}
        </button>

        <div
          className="label-medium"
          style={{
            color: 'var(--on-surface-variant)',
            letterSpacing: 0.8,
            margin: '22px 6px 10px',
          }}
        >
          CONT
        </div>
        <div className="profile-section">
          <ProfileTile
            icon="photo-camera"
            title="Poză de profil"
            subtitle={
              currentUser.profilePhotoUri
                ? 'Apasă pentru a schimba sau șterge poza'
                : 'Adaugă o poză de profil'
            }
            onPress={() => setPhotoSheet(true)}
          />
        </div>

        <button
          type="button"
          onClick={() => setLogoutSheet(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '14px 0',
            width: '100%',
            border: '1.5px solid color-mix(in srgb, var(--error) 45%, transparent)',
            borderRadius: 16,
            marginTop: 26,
          }}
        >
          <Icon name="logout" size={20} color="var(--error)" />
          <span className="label-large" style={{ color: 'var(--error)', marginLeft: 8 }}>
            Deconectare
          </span>
        </button>
      </div>

      <BottomSheet open={photoSheet} onClose={() => setPhotoSheet(false)}>
        <div style={{ padding: '8px 20px 28px' }}>
          <div className="title-large">Poză de profil</div>
          <div className="body-medium" style={{ color: 'var(--on-surface-variant)', marginTop: 4 }}>
            Alege o acțiune
          </div>
          <div style={{ height: 16 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <SheetAction
              icon="photo-library"
              label="Alege o imagine"
              onPress={() => {
                setPhotoSheet(false);
                photoInputRef.current?.click();
              }}
            />
            {currentUser.profilePhotoUri ? (
              <SheetAction
                icon="delete-outline"
                label="Șterge poza"
                destructive
                onPress={() => {
                  setPhotoSheet(false);
                  updateProfilePhoto(null);
                }}
              />
            ) : null}
          </div>
        </div>
      </BottomSheet>

      <BottomSheet open={logoutSheet} onClose={() => setLogoutSheet(false)}>
        <div style={{ padding: '8px 20px 28px' }}>
          <div className="title-large">Te deconectezi?</div>
          <div className="body-medium" style={{ color: 'var(--on-surface-variant)', marginTop: 4 }}>
            Va trebui să te autentifici din nou pentru a-ți accesa contul.
          </div>
          <div style={{ height: 16 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <SheetAction
              icon="logout"
              label="Deconectare"
              destructive
              onPress={async () => {
                setLogoutSheet(false);
                await logout();
              }}
            />
            <SheetAction icon="close" label="Renunță" onPress={() => setLogoutSheet(false)} />
          </div>
        </div>
      </BottomSheet>
    </div>
  );
};

type SheetActionProps = {
  icon: string;
  label: string;
  destructive?: boolean;
  onPress: () => void;
};

const SheetAction: React.FC<SheetActionProps> = ({ icon, label, destructive = false, onPress }) => (
  <button
    type="button"
    onClick={onPress}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      borderRadius: 14,
      border: '1px solid color-mix(in srgb, var(--outline-variant) 33%, transparent)',
      background: 'var(--surface-container-low)',
      padding: 14,
      textAlign: 'left',
    }}
  >
    <Icon name={icon} size={22} color={destructive ? 'var(--error)' : 'var(--primary)'} />
    <span className="title-small" style={{ color: destructive ? 'var(--error)' : 'var(--on-surface)' }}>
      {label}
    </span>
  </button>
);

type TileProps = {
  icon: string;
  title: string;
  subtitle: string;
  rightIcon?: string;
  rightColor?: string;
  disabled?: boolean;
  onPress: () => void;
};

const ProfileTile: React.FC<TileProps> = ({
  icon,
  title,
  subtitle,
  rightIcon,
  rightColor,
  disabled = false,
  onPress,
}) => (
  <button
    type="button"
    onClick={disabled ? undefined : onPress}
    disabled={disabled}
    style={{
      display: 'flex',
      alignItems: 'center',
      padding: '14px 16px',
      width: '100%',
      textAlign: 'left',
      opacity: disabled ? 0.45 : 1,
    }}
  >
    <div
      style={{
        width: 40,
        height: 40,
        borderRadius: 12,
        background: 'color-mix(in srgb, var(--primary-container) 45%, transparent)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <Icon name={icon} size={22} color={disabled ? 'var(--outline)' : 'var(--primary)'} />
    </div>
    <div style={{ flex: 1, marginLeft: 12, minWidth: 0 }}>
      <div className="title-small" style={{ color: disabled ? 'var(--outline)' : 'var(--on-surface)' }}>
        {title}
      </div>
      <div className="body-small" style={{ color: 'var(--on-surface-variant)', marginTop: 2 }}>
        {subtitle}
      </div>
    </div>
    <Icon name={rightIcon ?? 'chevron-right'} size={22} color={rightColor ?? 'var(--outline)'} />
  </button>
);
