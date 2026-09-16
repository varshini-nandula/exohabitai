import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import GlassCard from '../components/GlassCard';
import Button from '../components/ui/Button';

export default function RegisterPage() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, isAuthenticated, error: authError, clearError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const queryParams = new URLSearchParams(location.search);
  const redirectPath = queryParams.get('redirect') || '/';

  useEffect(() => {
    if (isAuthenticated) {
      navigate(redirectPath, { replace: true });
    }
  }, [isAuthenticated, navigate, redirectPath]);

  useEffect(() => {
    clearError?.();
    return () => clearError?.();
  }, []);

  const validateForm = () => {
    const usernameRegex = /^[a-zA-Z0-9_-]{3,80}$/;
    if (!usernameRegex.test(username.trim())) {
      return 'Username must be 3-80 characters and can only contain letters, numbers, underscores, or hyphens.';
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return 'Please enter a valid email address.';
    }
    if (password.length < 8) {
      return 'Password must be at least 8 characters.';
    }
    if (password !== confirmPassword) {
      return 'Passwords do not match.';
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    setIsSubmitting(true);

    const validationError = validateForm();
    if (validationError) {
      setLocalError(validationError);
      setIsSubmitting(false);
      return;
    }

    try {
      await register(username.trim(), email.trim(), password);
    } catch (err) {
      console.error('Registration error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeError = localError || authError;

  return (
    <div className="site-container flex-grow flex items-center justify-center py-12 md:py-20">
      <GlassCard
        glow={true}
        hoverable={false}
        animate={true}
        variant="raised"
        padding="lg"
        className="w-full max-w-md relative overflow-hidden"
      >
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-accent/10 rounded-full blur-2xl pointer-events-none" />

        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-text-primary tracking-tight">
            Create Account
          </h2>
          <p className="text-sm text-text-secondary mt-2" style={{ lineHeight: '1.7' }}>
            Sign up to save predictions and contribute planet data.
          </p>
        </div>

        {activeError && (
          <div
            id="register-error-alert"
            role="alert"
            aria-live="polite"
            className="mb-8 text-sm text-danger bg-danger/8 border border-danger/20 p-4 rounded-lg leading-relaxed flex items-start gap-2"
          >
            <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{activeError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Choose a username"
              required
              disabled={isSubmitting}
              autoComplete="username"
              aria-invalid={!!activeError}
              aria-describedby={activeError ? 'register-error-alert' : undefined}
            />
          </div>

          <div className="flex flex-col">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              disabled={isSubmitting}
              autoComplete="email"
              aria-invalid={!!activeError}
              aria-describedby={activeError ? 'register-error-alert' : undefined}
            />
          </div>

          <div className="flex flex-col">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 8 characters"
              required
              disabled={isSubmitting}
              autoComplete="new-password"
              aria-invalid={!!activeError}
              aria-describedby={activeError ? 'register-error-alert' : undefined}
            />
          </div>

          <div className="flex flex-col">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your password"
              required
              disabled={isSubmitting}
              autoComplete="new-password"
              aria-invalid={!!activeError}
              aria-describedby={activeError ? 'register-error-alert' : undefined}
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            loading={isSubmitting}
            className="mt-4 w-full"
          >
            {isSubmitting ? 'Creating account...' : 'Create Account'}
          </Button>
        </form>

        <div className="text-center mt-8 pt-8 border-t border-white/5 text-sm text-text-secondary">
          Already have an account?{' '}
          <Link
            to={`/login${location.search}`}
            className="text-primary hover:text-primary-light font-medium ml-1"
          >
            Sign In
          </Link>
        </div>
      </GlassCard>
    </div>
  );
}
