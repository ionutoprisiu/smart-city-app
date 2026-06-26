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
    canAccessOrganizerFlow,
    organizerFlowBlockedReason,
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

  const isOrganizer = currentUser.role === 'organizer' || currentUser.role === 'admin';
  const verificationStatus = currentUser.verificationStatus ?? 'notSubmitted';
  const organizerLocked = !canAccessOrganizerFlow;
  const organizerSubtitle = (() => {
    if (organizerFlowBlockedReason) return organizerFlowBlockedReason;
    if (isOrganizer) return 'You are an organizer. You can create events and groups in Community.';
    if (verificationStatus === 'approved' && currentUser.isVerified) {
      return 'Identity verified.';
    }
    if (verificationStatus === 'notSubmitted') {
      return verificationReason ?? 'Upload your ID and a selfie to apply.';
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
      <div style={{ padding: '12px 16px 24px', maxWidth: 720, margin: '0 auto', width: '100%' }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: 24,
            border: '1px solid color-mix(in srgb, var(--outline-variant) 35%, transparent)',
            borderRadius: 24,
            background: 'color-mix(in srgb, var(--surface-container-highest) 55%, transparent)',
          }}
        >
          <button
            type="button"
            onClick={() => setPhotoSheet(true)}
            style={{
              width: 96,
              height: 96,
              padding: 3,
              border: '2px solid color-mix(in srgb, var(--primary) 35%, transparent)',
              borderRadius: 48,
              position: 'relative',
            }}
          >
            {currentUser.profilePhotoUri ? (
              <img
                src={currentUser.profilePhotoUri}
                alt="Profile"
                style={{ width: '100%', height: '100%', borderRadius: 44, objectFit: 'cover' }}
              />
            ) : (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: 44,
                  background: 'var(--primary-container)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span className="headline-small" style={{ color: 'var(--on-primary-container)' }}>
                  {initials}
                </span>
              </div>
            )}
            <span
              style={{
                position: 'absolute',
                right: -2,
                bottom: -2,
                width: 28,
                height: 28,
                borderRadius: 14,
                background: 'var(--primary)',
                border: '2px solid #FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="photo-camera" size={14} color="var(--on-primary)" />
            </span>
          </button>

          <div className="title-large" style={{ marginTop: 12 }}>{fullName(currentUser)}</div>
          <div className="body-medium" style={{ color: 'var(--on-surface-variant)', marginTop: 6 }}>
            {currentUser.email}
          </div>

          <div
            style={{
              display: 'flex',
              gap: 8,
              marginTop: 12,
              flexWrap: 'wrap',
              justifyContent: 'center',
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '6px 12px',
                borderRadius: 16,
                border: '1px solid var(--outline-variant)',
              }}
            >
              <Icon
                name={currentUser.role === 'admin' ? 'admin-panel-settings' : 'person'}
                size={16}
                color="var(--primary)"
              />
              <span className="label-medium" style={{ marginLeft: 6 }}>
                {roleDisplay(currentUser.role)}
              </span>
            </span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '6px 12px',
                borderRadius: 16,
                background: vTone.bg,
              }}
            >
              <Icon name={vTone.icon} size={16} color={vTone.color} />
              <span className="label-medium" style={{ marginLeft: 6, color: vTone.color }}>
                {verificationStatusLabel(currentUser.verificationStatus)}
              </span>
            </span>
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <div
            className="label-medium"
            style={{
              color: 'var(--on-surface-variant)',
              letterSpacing: 0.8,
              marginLeft: 6,
              marginBottom: 10,
            }}
          >
            ACCOUNT
          </div>
          <div
            style={{
              borderRadius: 24,
              overflow: 'hidden',
              background: 'color-mix(in srgb, var(--surface-container-highest) 55%, transparent)',
            }}
          >
            <ProfileTile
              icon="photo-camera"
              title="Profile photo"
              subtitle={
                currentUser.profilePhotoUri
                  ? 'Click to update or remove photo'
                  : 'Add a profile photo'
              }
              onPress={() => setPhotoSheet(true)}
            />
            <div
              style={{
                height: 1,
                marginLeft: 56,
                background: 'color-mix(in srgb, var(--outline) 12%, transparent)',
              }}
            />
            <ProfileTile
              icon="verified-user"
              title="Become an organizer"
              subtitle={organizerSubtitle}
              rightIcon={organizerLocked ? vTone.icon : 'chevron-right'}
              rightColor={organizerLocked ? 'var(--outline)' : vTone.color}
              disabled={organizerLocked}
              onPress={() => navigate('/become-organizer')}
            />
          </div>
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
            marginTop: 28,
          }}
        >
          <Icon name="logout" size={20} color="var(--error)" />
          <span className="label-large" style={{ color: 'var(--error)', marginLeft: 8 }}>
            Sign out
          </span>
        </button>
      </div>

      <BottomSheet open={photoSheet} onClose={() => setPhotoSheet(false)}>
        <div style={{ padding: '8px 20px 28px' }}>
          <div className="title-large">Profile photo</div>
          <div className="body-medium" style={{ color: 'var(--on-surface-variant)', marginTop: 4 }}>
            Choose an action
          </div>
          <div style={{ height: 16 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <SheetAction
              icon="photo-library"
              label="Choose image"
              onPress={() => {
                setPhotoSheet(false);
                photoInputRef.current?.click();
              }}
            />
            {currentUser.profilePhotoUri ? (
              <SheetAction
                icon="delete-outline"
                label="Remove photo"
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
          <div className="title-large">Sign out?</div>
          <div className="body-medium" style={{ color: 'var(--on-surface-variant)', marginTop: 4 }}>
            You'll need to sign in again to access your profile.
          </div>
          <div style={{ height: 16 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <SheetAction
              icon="logout"
              label="Sign out"
              destructive
              onPress={async () => {
                setLogoutSheet(false);
                await logout();
              }}
            />
            <SheetAction icon="close" label="Cancel" onPress={() => setLogoutSheet(false)} />
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
