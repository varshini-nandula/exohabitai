import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import GlassCard from '../components/GlassCard';
import Button from '../components/ui/Button';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login, isAuthenticated, error: authError, clearError } = useAuth();
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    setIsSubmitting(true);

    if (!username.trim() || !password.trim()) {
      setLocalError('Please enter your username and password.');
      setIsSubmitting(false);
      return;
    }

    try {
      await login(username.trim(), password);
    } catch (err) {
      console.error('Login error:', err);
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
        {/* Glow orb */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/10 rounded-full blur-2xl pointer-events-none" />

        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-text-primary tracking-tight">
            Sign In
          </h2>
          <p className="text-sm text-text-secondary mt-2" style={{ lineHeight: '1.7' }}>
            Sign in to save predictions and manage your saved exoplanets.
          </p>
        </div>

        {activeError && (
          <div
            id="login-error-alert"
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
              placeholder="Enter your username"
              required
              disabled={isSubmitting}
              autoComplete="username"
              aria-invalid={!!activeError}
              aria-describedby={activeError ? 'login-error-alert' : undefined}
            />
          </div>

          <div className="flex flex-col">
            <label htmlFor="password">Password</label>
            <div className="relative flex items-center">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                disabled={isSubmitting}
                autoComplete="current-password"
                aria-invalid={!!activeError}
                aria-describedby={activeError ? 'login-error-alert' : undefined}
                className="w-full pr-11"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                className="absolute right-3 p-1 text-text-muted hover:text-text-primary transition-colors focus:outline-none cursor-pointer"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  // Eye slash icon (hide)
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                  </svg>
                ) : (
                  // Eye icon (show)
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            loading={isSubmitting}
            className="mt-4 w-full"
          >
            {isSubmitting ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>

        <div className="text-center mt-8 pt-8 border-t border-white/5 text-sm text-text-secondary">
          Don't have an account?{' '}
          <Link
            to={`/register${location.search}`}
            className="text-primary hover:text-primary-light font-medium ml-1"
          >
            Create one
          </Link>
        </div>
      </GlassCard>
    </div>
  );
}
