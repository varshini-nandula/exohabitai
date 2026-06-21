import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import GlassCard from '../components/GlassCard';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login, isAuthenticated, error: authError, clearError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Find redirect query param or default to home
  const queryParams = new URLSearchParams(location.search);
  const redirectPath = queryParams.get('redirect') || '/';

  useEffect(() => {
    // If user is already authenticated, redirect immediately
    if (isAuthenticated) {
      navigate(redirectPath, { replace: true });
    }
  }, [isAuthenticated, navigate, redirectPath]);

  useEffect(() => {
    // Clear errors when navigating away or on mount
    clearError?.();
    return () => clearError?.();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    setIsSubmitting(true);

    if (!username.trim() || !password.trim()) {
      setLocalError('Please complete all authorization fields.');
      setIsSubmitting(false);
      return;
    }

    try {
      await login(username.trim(), password);
    } catch (err) {
      // Auth context sets authError, so we just log and show that
      console.error('Login action error:', err);
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
        className="w-full max-w-md border-primary/20 relative overflow-hidden p-12"
      >
        {/* Glow orb */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/10 rounded-full blur-2xl pointer-events-none" />

        <div className="text-center mb-12">
          <span className="font-mono text-[10px] tracking-[0.25em] text-primary uppercase font-bold">
            OBSERVATORY SECURITY
          </span>
          <h2 className="text-2xl font-bold font-mono text-text-primary tracking-tight mt-3">
            Navigator Login
          </h2>
          <p className="text-xs text-text-secondary mt-3" style={{ lineHeight: '1.7' }}>
            Authenticate to sync candidates and access database sectors.
          </p>
        </div>

        {activeError && (
          <div className="mb-10 text-xs text-danger font-mono bg-danger/10 border border-danger/25 p-5 rounded-lg leading-relaxed">
            <div className="font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <span>⚠️</span> Authorization Error
            </div>
            {activeError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-7">
          <div className="flex flex-col">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. Kepler_Voyager"
              required
              disabled={isSubmitting}
              autoComplete="username"
            />
          </div>

          <div className="flex flex-col">
            <label htmlFor="password">Security Cipher (Password)</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              required
              disabled={isSubmitting}
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            className="btn-primary mt-6 w-full"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Decrypting...
              </span>
            ) : (
              'Authenticate Link'
            )}
          </button>
        </form>

        <div className="text-center mt-10 pt-10 border-t border-white/5 text-xs text-text-secondary">
          Not yet a registered navigator?{' '}
          <Link
            to={`/register${location.search}`}
            className="text-accent hover:text-accent-light underline font-mono ml-1 font-semibold"
          >
            Register Vessel
          </Link>
        </div>
      </GlassCard>
    </div>
  );
}
