import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../services/api';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  const validate = (): boolean => {
    const errors: { email?: string; password?: string } = {};
    if (!email.trim()) {
      errors.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Please enter a valid email address';
    }

    if (!password) {
      errors.password = 'Password is required';
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
      await login(email.trim(), password);
      // Navigate to intended destination or root dashboard
      const destination = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';
      navigate(destination, { replace: true });
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setErrorMessage(err.detail || 'Invalid email or password');
      } else if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('An unexpected error occurred during sign in. Please try again.');
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

        <h1 className="auth-title">Welcome back</h1>
        <p className="auth-subtitle">Sign in to continue to your assessment workspace.</p>

        {errorMessage && (
          <div className="auth-alert-error" role="alert" style={{ marginBottom: 16 }}>
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{errorMessage}</span>
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          {/* Email Field */}
          <div className="auth-field">
            <label className="auth-label" htmlFor="email-input">
              Email Address
            </label>
            <div className="auth-input-wrapper">
              <input
                id="email-input"
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
            <label className="auth-label" htmlFor="password-input">
              Password
            </label>
            <div className="auth-input-wrapper">
              <input
                id="password-input"
                type={showPassword ? 'text' : 'password'}
                className={`auth-input ${fieldErrors.password ? 'has-error' : ''}`}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
                }}
                disabled={isSubmitting}
                autoComplete="current-password"
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

          {/* Remember me option */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, marginTop: 2 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: 'var(--color-text)' }}>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                style={{ accentColor: 'var(--color-primary)' }}
              />
              <span>Remember this session</span>
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="auth-btn-primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={18} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
                <span>Signing in...</span>
              </>
            ) : (
              <span>Sign In</span>
            )}
          </button>
        </form>

        <div className="auth-footer">
          Don't have an account?
          <Link to="/signup" className="auth-link">
            Sign up
          </Link>
        </div>
      </div>
    </div>
  );
}
