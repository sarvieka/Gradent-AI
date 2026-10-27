import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, AlertCircle, CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../services/api';

export default function Signup() {
  const navigate = useNavigate();
  const { signup } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    fullName?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});

  // Password requirement checks
  const hasMinLength = password.length >= 8;
  const hasSpecialOrDigit = /[0-9]|[^A-Za-z0-9]/.test(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  const validate = (): boolean => {
    const errors: {
      fullName?: string;
      email?: string;
      password?: string;
      confirmPassword?: string;
    } = {};

    if (!fullName.trim()) {
      errors.fullName = 'Full name is required';
    } else if (fullName.trim().length < 2) {
      errors.fullName = 'Full name must be at least 2 characters';
    }

    if (!email.trim()) {
      errors.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Please enter a valid email address';
    }

    if (!password) {
      errors.password = 'Password is required';
    } else if (!hasMinLength) {
      errors.password = 'Password must be at least 8 characters';
    } else if (!hasSpecialOrDigit) {
      errors.password = 'Password must include at least one number or special character';
    }

    if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await signup(fullName.trim(), email.trim(), password);
      // Directly navigate to dashboard since session is established
      navigate('/', { replace: true });
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setErrorMessage(err.detail || 'Registration failed');
      } else if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('An unexpected error occurred during account creation.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        {/* Brand Header */}
        <div className="auth-brand">
          <div className="auth-brand-logo">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="auth-brand-text">
            <span className="auth-brand-name">Gradent AI</span>
            <span className="auth-brand-tag">Assessment System</span>
          </div>
        </div>

        <h1 className="auth-title">Create your account</h1>
        <p className="auth-subtitle">Set up your evaluator account to start grading student assessments.</p>

        {errorMessage && (
          <div className="auth-alert-error" role="alert" style={{ marginBottom: 16 }}>
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{errorMessage}</span>
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          {/* Full Name */}
          <div className="auth-field">
            <label className="auth-label" htmlFor="name-input">
              Full Name
            </label>
            <div className="auth-input-wrapper">
              <input
                id="name-input"
                type="text"
                className={`auth-input ${fieldErrors.fullName ? 'has-error' : ''}`}
                placeholder="Dr. Eleanor Vance"
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  if (fieldErrors.fullName) setFieldErrors((prev) => ({ ...prev, fullName: undefined }));
                }}
                disabled={isSubmitting}
                autoComplete="name"
                required
              />
            </div>
            {fieldErrors.fullName && <span className="auth-field-error">{fieldErrors.fullName}</span>}
          </div>

          {/* Email Field */}
          <div className="auth-field">
            <label className="auth-label" htmlFor="signup-email-input">
              Email Address
            </label>
            <div className="auth-input-wrapper">
              <input
                id="signup-email-input"
                type="email"
                className={`auth-input ${fieldErrors.email ? 'has-error' : ''}`}
                placeholder="evaluator@university.edu"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
                }}
                disabled={isSubmitting}
                autoComplete="email"
                required
              />
            </div>
            {fieldErrors.email && <span className="auth-field-error">{fieldErrors.email}</span>}
          </div>

          {/* Password Field */}
          <div className="auth-field">
            <label className="auth-label" htmlFor="signup-password-input">
              Password
            </label>
            <div className="auth-input-wrapper">
              <input
                id="signup-password-input"
                type={showPassword ? 'text' : 'password'}
                className={`auth-input ${fieldErrors.password ? 'has-error' : ''}`}
                placeholder="Create a strong password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
                }}
                disabled={isSubmitting}
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                className="auth-toggle-pwd"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {fieldErrors.password && <span className="auth-field-error">{fieldErrors.password}</span>}
          </div>

          {/* Confirm Password Field */}
          <div className="auth-field">
            <label className="auth-label" htmlFor="confirm-password-input">
              Confirm Password
            </label>
            <div className="auth-input-wrapper">
              <input
                id="confirm-password-input"
                type={showConfirmPassword ? 'text' : 'password'}
                className={`auth-input ${fieldErrors.confirmPassword ? 'has-error' : ''}`}
                placeholder="Repeat your password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (fieldErrors.confirmPassword) setFieldErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                }}
                disabled={isSubmitting}
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                className="auth-toggle-pwd"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                tabIndex={-1}
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {fieldErrors.confirmPassword && (
              <span className="auth-field-error">{fieldErrors.confirmPassword}</span>
            )}
          </div>

          {/* Password Requirements Checklist */}
          <div className="auth-checklist">
            <div className={`auth-checklist-item ${hasMinLength ? 'valid' : ''}`}>
              {hasMinLength ? <CheckCircle2 size={14} /> : <Circle size={14} />}
              <span>At least 8 characters long</span>
            </div>
            <div className={`auth-checklist-item ${hasSpecialOrDigit ? 'valid' : ''}`}>
              {hasSpecialOrDigit ? <CheckCircle2 size={14} /> : <Circle size={14} />}
              <span>At least one number or special character</span>
            </div>
            <div className={`auth-checklist-item ${passwordsMatch ? 'valid' : ''}`}>
              {passwordsMatch ? <CheckCircle2 size={14} /> : <Circle size={14} />}
              <span>Passwords match</span>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="auth-btn-primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                <span>Creating Account...</span>
              </>
            ) : (
              <span>Create Account</span>
            )}
          </button>
        </form>

        <div className="auth-footer">
          Already have an account?
          <Link to="/login" className="auth-link">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
