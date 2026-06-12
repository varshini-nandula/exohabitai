import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import GlassCard from '../components/GlassCard';

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
    // 1. Username constraints: 3-80 chars, alphanumeric + _ or -
    const usernameRegex = /^[a-zA-Z0-9_-]{3,80}$/;
    if (!usernameRegex.test(username.trim())) {
      return 'Username must be between 3 and 80 characters and can only contain letters, numbers, underscores (_), or hyphens (-).';
    }

    // 2. Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return 'Please enter a valid astrophysical contact email.';
    }

    // 3. Password length >= 8
    if (password.length < 8) {
      return 'Security cipher must contain at least 8 characters.';
    }

    // 4. Match check
    if (password !== confirmPassword) {
      return 'Confirm cipher does not match. Please verify passwords.';
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
      console.error('Registration action error:', err);
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
        className="w-full max-w-md border-primary/20 relative overflow-hidden p-10"
      >
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-accent/10 rounded-full blur-2xl pointer-events-none" />

        <div className="text-center mb-10">
          <span className="font-mono text-[10px] tracking-[0.25em] text-accent uppercase font-bold">
            OBSERVATORY REGISTRY
          </span>
          <h2 className="text-2xl font-bold font-mono text-text-primary tracking-tight mt-3">
            Navigator Registration
          </h2>
          <p className="text-xs text-text-secondary mt-3" style={{ lineHeight: '1.7' }}>
            Sign up to save customized planetary systems and predictions.
          </p>
        </div>

        {activeError && (
          <div className="mb-8 text-xs text-danger font-mono bg-danger/10 border border-danger/25 p-4 rounded-lg leading-relaxed">
            <div className="font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <span>⚠️</span> Registration Alert
            </div>
            {activeError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="flex flex-col">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. AstroExplorer_99"
              required
              disabled={isSubmitting}
              autoComplete="username"
            />
          </div>

          <div className="flex flex-col">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. navigator@deepspace.org"
              required
              disabled={isSubmitting}
              autoComplete="email"
            />
          </div>

          <div className="flex flex-col">
            <label htmlFor="password">Security Cipher (Password)</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 8 characters"
              required
              disabled={isSubmitting}
              autoComplete="new-password"
            />
          </div>

          <div className="flex flex-col">
            <label htmlFor="confirmPassword">Confirm Security Cipher</label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter cipher"
              required
              disabled={isSubmitting}
              autoComplete="new-password"
            />
          </div>

          <button
            type="submit"
            className="btn-primary mt-4 w-full shadow-[0_0_20px_rgba(94,234,212,0.2)]"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Encrypting & Submitting...
              </span>
            ) : (
              'Create Navigator Cipher'
            )}
          </button>
        </form>

        <div className="text-center mt-8 pt-8 border-t border-white/5 text-xs text-text-secondary">
          Already a registered navigator?{' '}
          <Link
            to={`/login${location.search}`}
            className="text-primary hover:text-primary-light underline font-mono ml-1 font-semibold"
          >
            Login Credentials
          </Link>
        </div>
      </GlassCard>
    </div>
  );
}
