import React, { useState } from 'react';
import { User as UserIcon, Shield, CheckCircle2, AlertCircle, Loader2, KeyRound, Calendar, Mail } from 'lucide-react';
import Sidebar from '../components/layout/Sidebar';
import ContentHeader from '../components/layout/ContentHeader';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../services/api';

export default function Profile() {
  const { user, updateProfile, changePassword } = useAuth();

  // Profile form state
  const [isEditingName, setIsEditingName] = useState(false);
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSuccess(null);
    setProfileError(null);

    const trimmed = fullName.trim();
    if (trimmed.length < 2) {
      setProfileError('Full name must be at least 2 characters long');
      return;
    }

    setIsUpdatingProfile(true);
    try {
      await updateProfile(trimmed);
      setProfileSuccess('Profile name updated successfully.');
      setIsEditingName(false);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setProfileError(err.detail || 'Failed to update profile');
      } else if (err instanceof Error) {
        setProfileError(err.message);
      } else {
        setProfileError('An unexpected error occurred.');
      }
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordSuccess(null);
    setPasswordError(null);

    if (!currentPassword) {
      setPasswordError('Current password is required');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long');
      return;
    }

    if (!/[0-9]|[^A-Za-z0-9]/.test(newPassword)) {
      setPasswordError('New password must contain at least one number or special character');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      setPasswordSuccess('Password has been updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setPasswordError(err.detail || 'Failed to change password');
      } else if (err instanceof Error) {
        setPasswordError(err.message);
      } else {
        setPasswordError('Failed to change password.');
      }
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const formattedJoinDate = user?.created_at
    ? new Date(user.created_at).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'Recently';

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="app-main">
        <ContentHeader title="Account Settings" showSearch={false} />

        <div className="page-content" style={{ maxWidth: 880, margin: '0 auto', padding: '32px 24px' }}>
          <div style={{ marginBottom: 24 }}>
            <h1 className="page-title" style={{ textAlign: 'left', fontSize: 24, fontWeight: 700 }}>
              Account Profile
            </h1>
            <p className="page-subtitle" style={{ textAlign: 'left', color: 'var(--color-text-secondary)', fontSize: 14 }}>
              Manage your personal evaluator details and security credentials.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Card 1: Personal Details */}
            <div className="profile-card">
              <div className="profile-card-header">
                <div>
                  <h2 className="profile-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <UserIcon size={18} color="var(--color-primary)" />
                    Personal Information
                  </h2>
                  <p className="profile-card-desc">Your basic profile details visible across the grading system.</p>
                </div>
              </div>

              {profileSuccess && (
                <div className="auth-alert-success" role="alert">
                  <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
                  <span>{profileSuccess}</span>
                </div>
              )}

              {profileError && (
                <div className="auth-alert-error" role="alert">
                  <AlertCircle size={16} style={{ flexShrink: 0 }} />
                  <span>{profileError}</span>
                </div>
              )}

              <div className="profile-info-grid">
                {/* Full Name */}
                <div style={{ borderBottom: '1px solid var(--color-border-light)', paddingBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                      Full Name
                    </label>
                    {!isEditingName && (
                      <button
                        type="button"
                        onClick={() => {
                          setFullName(user?.full_name || '');
                          setIsEditingName(true);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--color-primary)',
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Edit
                      </button>
                    )}
                  </div>

                  {isEditingName ? (
                    <form onSubmit={handleSaveName} style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                      <input
                        type="text"
                        className="auth-input"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Enter full name"
                        disabled={isUpdatingProfile}
                        required
                        style={{ maxWidth: 360 }}
                      />
                      <button
                        type="submit"
                        className="auth-btn-primary"
                        disabled={isUpdatingProfile}
                        style={{ width: 'auto', padding: '0 16px', margin: 0, height: 42 }}
                      >
                        {isUpdatingProfile ? (
                          <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                        ) : (
                          'Save'
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditingName(false)}
                        disabled={isUpdatingProfile}
                        style={{
                          background: 'var(--color-bg)',
                          border: '1px solid var(--color-border)',
                          borderRadius: 'var(--radius)',
                          padding: '0 14px',
                          fontSize: 13,
                          fontWeight: 500,
                          color: 'var(--color-text)',
                          cursor: 'pointer',
                        }}
                      >
                        Cancel
                      </button>
                    </form>
                  ) : (
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)', marginTop: 4 }}>
                      {user?.full_name || '—'}
                    </div>
                  )}
                </div>

                {/* Email Address */}
                <div style={{ borderBottom: '1px solid var(--color-border-light)', paddingBottom: 16 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                    Email Address
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <Mail size={16} color="var(--color-text-muted)" />
                    <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--color-text)' }}>
                      {user?.email}
                    </span>
                    <span className="profile-badge">
                      Primary Email
                    </span>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'block', marginTop: 4 }}>
                    Email address is tied to your account credentials and cannot be modified.
                  </span>
                </div>

                {/* Member Since */}
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                    Member Since
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <Calendar size={16} color="var(--color-text-muted)" />
                    <span style={{ fontSize: 14, color: 'var(--color-text)' }}>
                      {formattedJoinDate}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2: Password and Security */}
            <div className="profile-card">
              <div className="profile-card-header">
                <div>
                  <h2 className="profile-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Shield size={18} color="var(--color-primary)" />
                    Security & Password
                  </h2>
                  <p className="profile-card-desc">Update your password to keep your evaluator account secure.</p>
                </div>
              </div>

              {passwordSuccess && (
                <div className="auth-alert-success" role="alert">
                  <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
                  <span>{passwordSuccess}</span>
                </div>
              )}

              {passwordError && (
                <div className="auth-alert-error" role="alert">
                  <AlertCircle size={16} style={{ flexShrink: 0 }} />
                  <span>{passwordError}</span>
                </div>
              )}

              <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="auth-field" style={{ maxWidth: 420 }}>
                  <label className="auth-label" htmlFor="current-pwd">
                    Current Password
                  </label>
                  <input
                    id="current-pwd"
                    type="password"
                    className="auth-input"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    disabled={isUpdatingPassword}
                    required
                  />
                </div>

                <div className="auth-field" style={{ maxWidth: 420 }}>
                  <label className="auth-label" htmlFor="new-pwd">
                    New Password
                  </label>
                  <input
                    id="new-pwd"
                    type="password"
                    className="auth-input"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    disabled={isUpdatingPassword}
                    required
                  />
                </div>

                <div className="auth-field" style={{ maxWidth: 420 }}>
                  <label className="auth-label" htmlFor="confirm-new-pwd">
                    Confirm New Password
                  </label>
                  <input
                    id="confirm-new-pwd"
                    type="password"
                    className="auth-input"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    disabled={isUpdatingPassword}
                    required
                  />
                </div>

                <div style={{ marginTop: 8 }}>
                  <button
                    type="submit"
                    className="auth-btn-primary"
                    disabled={isUpdatingPassword}
                    style={{ width: 'auto', padding: '0 20px', height: 40 }}
                  >
                    {isUpdatingPassword ? (
                      <>
                        <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                        <span>Updating Password...</span>
                      </>
                    ) : (
                      <>
                        <KeyRound size={16} />
                        <span>Update Password</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
