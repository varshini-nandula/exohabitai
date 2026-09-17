import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { authAPI } from '../api/auth';
import { planetsAPI } from '../api/planets';
import { predictionAPI } from '../api/prediction';
import { extractError } from '../api/client';
import GlassCard from '../components/GlassCard';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Tooltip from '../components/Tooltip';

const STATUS_MAP = {
  approved: { label: 'Approved', variant: 'success' },
  pending: { label: 'Pending Review', variant: 'warning' },
  rejected: { label: 'Rejected', variant: 'danger' },
};

const EARTH_DEFAULTS = {
  planet_name: '',
  P_RADIUS: 1.0,
  P_MASS: 1.0,
  P_DENSITY: 5.51,
  P_TEMP_SURF: 288,
  P_PERIOD: 365.25,
  P_SEMI_MAJOR_AXIS: 1.0,
  S_TEMPERATURE: 5778,
  S_LUMINOSITY: 1.0,
  S_METALLICITY: 0.0,
};

const FIELD_DESCRIPTIONS = {
  P_RADIUS: "Relative to Earth's radius (Earth = 1.0)",
  P_MASS: "Relative to Earth's mass (Earth = 1.0)",
  P_DENSITY: "Average density in g/cm³ (Earth ≈ 5.51)",
  P_TEMP_SURF: "Surface temperature in Kelvin (Earth ≈ 288 K)",
  P_PERIOD: "Orbital period in Earth days (Earth = 365.25)",
  P_SEMI_MAJOR_AXIS: "Distance from host star in AU (Earth = 1.0)",
  S_TEMPERATURE: "Host star surface temperature in Kelvin (Sun ≈ 5778 K)",
  S_LUMINOSITY: "Star luminosity relative to the Sun (Sun = 1.0)",
  S_METALLICITY: "Metal content in [Fe/H] log-ratio (Sun = 0.0)",
};

const FIELD_HUMAN_NAMES = {
  planet_name: 'Planet Name',
  P_RADIUS: 'Planet Radius',
  P_MASS: 'Planet Mass',
  P_DENSITY: 'Planet Density',
  P_TEMP_SURF: 'Surface Temperature',
  P_PERIOD: 'Orbital Period',
  P_SEMI_MAJOR_AXIS: 'Semi-Major Axis',
  S_TEMPERATURE: 'Star Temperature',
  S_LUMINOSITY: 'Star Luminosity',
  S_METALLICITY: 'Star Metallicity',
};

export default function UserDashboardPage() {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [planets, setPlanets] = useState([]);
  const [errorState, setErrorState] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedPlanet, setSelectedPlanet] = useState(null);

  // Edit Profile Modal State
  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);
  const [profileFormData, setProfileFormData] = useState({ username: '', email: '' });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState(null);
  const [profileSuccess, setProfileSuccess] = useState(false);

  // Quick Predict Modal State
  const [isPredictModalOpen, setIsPredictModalOpen] = useState(false);
  const [formData, setFormData] = useState({ ...EARTH_DEFAULTS });
  const [predictLoading, setPredictLoading] = useState(false);
  const [predictError, setPredictError] = useState(null);
  const [predictResult, setPredictResult] = useState(null);

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.slice(0, 2).toUpperCase();
  };

  const formatDate = (isoString) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return isoString;
    }
  };

  // Fetch real user predictions/submissions
  useEffect(() => {
    let active = true;
    setLoading(true);
    setErrorState(null);

    const fetchSubmissions = async () => {
      try {
        const res = await planetsAPI.getMySubmissions();
        if (!active) return;
        if (res.data?.status === 'success') {
          setPlanets(res.data.data?.planets || []);
        } else {
          setErrorState({
            variant: 'generic',
            message: res.data?.message || 'Could not retrieve user dashboard data.',
          });
        }
        setLoading(false);
      } catch (err) {
        if (!active) return;
        setErrorState({
          variant: !err.response ? 'offline' : 'generic',
          message: extractError(err),
        });
        setLoading(false);
      }
    };

    fetchSubmissions();
    return () => { active = false; };
  }, [reloadToken]);

  // Derived Real Statistics
  const totalPredictions = planets.length;
  const habitableCount = planets.filter((p) => p.habitability === 1).length;
  const pendingCount = planets.filter((p) => p.status === 'pending').length;
  const approvedCount = planets.filter((p) => p.status === 'approved').length;

  const filteredPlanets = statusFilter === 'all'
    ? planets
    : planets.filter((p) => p.status === statusFilter);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  // Edit Profile Handlers
  const handleOpenEditProfile = () => {
    setProfileFormData({
      username: user?.username || '',
      email: user?.email || '',
    });
    setProfileError(null);
    setProfileSuccess(false);
    setIsEditProfileModalOpen(true);
  };

  const handleCloseEditProfile = () => {
    setIsEditProfileModalOpen(false);
    setProfileError(null);
    setProfileSuccess(false);
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setProfileLoading(true);
    setProfileError(null);
    setProfileSuccess(false);

    const trimmedUsername = profileFormData.username.trim();
    const trimmedEmail = profileFormData.email.trim();

    if (!trimmedUsername) {
      setProfileError('Username is required.');
      setProfileLoading(false);
      return;
    }
    if (!trimmedEmail) {
      setProfileError('Email address is required.');
      setProfileLoading(false);
      return;
    }

    try {
      const res = await authAPI.updateProfile({
        username: trimmedUsername,
        email: trimmedEmail,
      });

      if (res.data?.status === 'success') {
        const updatedUser = res.data.data?.user;
        if (updatedUser && updateUser) {
          updateUser(updatedUser);
        }
        setProfileSuccess(true);
        setTimeout(() => {
          setIsEditProfileModalOpen(false);
          setProfileSuccess(false);
        }, 1200);
      } else {
        setProfileError(res.data?.message || 'Failed to update profile.');
      }
    } catch (err) {
      setProfileError(extractError(err));
    } finally {
      setProfileLoading(false);
    }
  };

  // Quick Predict Handlers
  const handleInputChange = (field, val) => {
    if (field === 'planet_name') {
      setFormData((prev) => ({ ...prev, [field]: val }));
      return;
    }
    const numVal = val === '' ? '' : parseFloat(val);
    setFormData((prev) => ({ ...prev, [field]: numVal }));
  };

  const handleResetForm = () => {
    setFormData({ ...EARTH_DEFAULTS });
    setPredictResult(null);
    setPredictError(null);
  };

  const handleOpenPredictModal = () => {
    handleResetForm();
    setIsPredictModalOpen(true);
  };

  const handleClosePredictModal = () => {
    setIsPredictModalOpen(false);
    handleResetForm();
  };

  const handlePredictSubmit = async (e) => {
    e.preventDefault();
    setPredictLoading(true);
    setPredictError(null);
    setPredictResult(null);

    if (!formData.planet_name.trim()) {
      setPredictError({ variant: 'validation', message: 'Planet name is required.' });
      setPredictLoading(false);
      return;
    }

    for (const key of Object.keys(formData)) {
      if (key !== 'planet_name' && (formData[key] === '' || isNaN(formData[key]))) {
        const fieldName = FIELD_HUMAN_NAMES[key] || key;
        setPredictError({
          variant: 'validation',
          message: `"${fieldName}" has an invalid value. Please enter a valid number.`,
        });
        setPredictLoading(false);
        return;
      }
    }

    try {
      const res = await predictionAPI.predictAndStore(formData);
      const data = res.data?.data;
      if (res.data?.status === 'success' && data?.stored) {
        setPredictResult(data);
        // Refresh dashboard data so the new prediction immediately appears
        setReloadToken((t) => t + 1);
      } else if (data && data.stored === false) {
        setPredictError({
          variant: 'generic',
          message: data.storage_message || 'This planet could not be saved.',
        });
      } else {
        setPredictError({
          variant: 'generic',
          message: res.data?.message || 'Submission was rejected.',
        });
      }
    } catch (err) {
      console.error('Submit failed:', err);
      const extracted = extractError(err);
      let errorVariant = 'generic';
      if (err.response?.status === 429) errorVariant = 'rate-limit';
      else if (!err.response) errorVariant = 'offline';
      else if (err.response?.status === 400) errorVariant = 'validation';
      setPredictError({ variant: errorVariant, message: extracted });
    } finally {
      setPredictLoading(false);
    }
  };

  return (
    <div className="site-container section-padding flex flex-col gap-10 max-w-7xl">
      {/* 1. Dashboard Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-white/5">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-accent">
              Astronomer Dashboard
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-text-primary tracking-tight">
            Welcome back, <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">{user?.username || 'Astronomer'}</span>
          </h1>
          <p className="text-sm sm:text-base text-text-secondary mt-1.5 max-w-2xl leading-relaxed">
            Manage your exoplanet predictions, track verification statuses, and submit new candidates.
          </p>
        </div>

        {/* Header Actions: Predict New Planet and Sign Out */}
        <div className="flex items-center gap-3.5 shrink-0 flex-wrap sm:flex-nowrap">
          <Button
            onClick={handleOpenPredictModal}
            className="shadow-[0_0_20px_rgba(79,140,255,0.25)] flex items-center gap-2 py-3 px-6 text-xs sm:text-sm font-semibold"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Predict New Planet
          </Button>

          <button
            onClick={handleLogout}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              padding: '12px 24px',
              borderRadius: '9999px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              color: '#EF4444',
              fontWeight: 600,
              fontSize: '0.875rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: '0 0 16px rgba(239, 68, 68, 0.18)',
              boxSizing: 'border-box',
            }}
            className="hover:bg-danger/25 hover:border-danger/50 hover:shadow-[0_0_22px_rgba(239,68,68,0.35)] hover:-translate-y-0.5"
            aria-label="Sign out of your account"
          >
            <svg className="w-4 h-4 text-danger shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex justify-center items-center">
          <LoadingSpinner message="Loading your dashboard data..." />
        </div>
      ) : errorState ? (
        <div className="py-12">
          <ErrorState
            variant={errorState.variant}
            message={errorState.message}
            onRetry={() => setReloadToken((t) => t + 1)}
          />
        </div>
      ) : (
        <>
          {/* 2. Top Section: Account Overview & Live Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch">
            {/* Account Card (4 Cols on desktop) */}
            <div className="lg:col-span-4 flex">
              <GlassCard
                glow={true}
                hoverable={false}
                variant="raised"
                padding="lg"
                className="w-full flex flex-col justify-between gap-6"
              >
                {/* 1. User Profile Cosmic Header */}
                <div className="flex items-center gap-4 pb-6 border-b border-white/10">
                  <div className="relative shrink-0">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center text-space-900 font-extrabold text-xl tracking-wider shadow-lg">
                      {getInitials(user?.username)}
                    </div>
                    <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                      <span className="relative inline-flex rounded-full h-4 w-4 bg-success border-2 border-space-900" />
                    </span>
                  </div>

                  <div className="min-w-0 flex-grow">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-bold text-text-primary truncate">
                        {user?.username || 'Astronomer'}
                      </h3>
                      {user?.role === 'admin' && (
                        <span className="px-3 py-1 text-[11px] font-bold rounded-full bg-accent/20 text-accent border border-accent/35 uppercase tracking-wider shrink-0">
                          Admin
                        </span>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-text-muted truncate mt-0.5">
                      {user?.email || 'No email provided'}
                    </p>
                  </div>
                </div>

                {/* 2. Telemetry / Discovery Rate Section (Translucent glass sub-card matching design system) */}
                <div
                  style={{
                    padding: '24px 24px',
                    borderRadius: '18px',
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    width: '100%',
                    boxSizing: 'border-box',
                  }}
                  className="shadow-inner"
                >
                  {/* Top row: Label + Percentage */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span className="text-xs font-bold uppercase tracking-wider text-accent flex items-center gap-2">
                      <svg className="w-4 h-4 text-accent shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Discovery Rate
                    </span>
                    <span className="text-sm font-mono font-bold text-text-primary">
                      {totalPredictions > 0 ? ((habitableCount / totalPredictions) * 100).toFixed(0) : 0}%
                    </span>
                  </div>

                  {/* Progress Bar Track */}
                  <div
                    style={{
                      width: '100%',
                      height: '12px',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      borderRadius: '9999px',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      overflow: 'hidden',
                      padding: '2px',
                      boxSizing: 'border-box',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <div
                      className="bg-gradient-to-r from-primary to-accent transition-all duration-500 shadow-[0_0_14px_rgba(94,234,212,0.45)]"
                      style={{
                        height: '100%',
                        borderRadius: '9999px',
                        width: `${totalPredictions > 0 ? Math.min(100, Math.max(5, (habitableCount / totalPredictions) * 100)) : 0}%`,
                      }}
                    />
                  </div>

                  {/* Habitable / Evaluated counts row */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }} className="text-xs text-text-muted">
                    <span>Habitable: <strong className="text-text-primary font-mono ml-1">{habitableCount}</strong></span>
                    <span>Evaluated: <strong className="text-text-primary font-mono ml-1">{totalPredictions}</strong></span>
                  </div>
                </div>

                {/* 3. Open Account Specification Rows */}
                <div className="flex flex-col gap-4 text-xs">
                  {/* Role */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-text-muted uppercase font-bold tracking-wider">Role</span>
                    <span className="inline-flex items-center justify-center px-4 py-1.5 rounded-full text-xs font-semibold bg-accent/15 border border-accent/30 text-accent capitalize tracking-wide shadow-sm min-w-[64px]">
                      {user?.role || 'User'}
                    </span>
                  </div>

                  {/* Status */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-text-muted uppercase font-bold tracking-wider">Status</span>
                    <span className="inline-flex items-center justify-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold bg-success/15 border border-success/30 text-success tracking-wide shadow-sm min-w-[76px]">
                      <span className="h-2 w-2 rounded-full bg-success animate-pulse shrink-0" aria-hidden="true" />
                      Active
                    </span>
                  </div>

                  {/* User ID */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-text-muted uppercase font-bold tracking-wider">User ID</span>
                    <span className="text-xs font-mono font-medium text-text-secondary">
                      #{user?.id ? user.id.toString().slice(0, 8) : '00000000'}
                    </span>
                  </div>
                </div>

                {/* 4. Edit Profile Details Action Box */}
                <div>
                  <button
                    onClick={handleOpenEditProfile}
                    className="w-full flex items-center justify-center gap-2.5 py-3.5 px-5 rounded-xl text-xs font-bold uppercase tracking-wider text-primary bg-primary/10 hover:bg-primary/20 border border-primary/30 hover:border-primary/50 transition-all cursor-pointer shadow-sm hover:shadow-[0_0_20px_rgba(79,140,255,0.25)] group"
                  >
                    {/* Pencil Edit Icon */}
                    <svg className="w-4 h-4 text-primary shrink-0 transition-transform group-hover:rotate-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    Edit Profile Details
                  </button>
                </div>
              </GlassCard>
            </div>

            {/* Quick Stats Grid (8 Cols on desktop) */}
            <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Stat 1: Total Predictions */}
              <GlassCard padding="lg" hoverable={false} className="flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase font-bold tracking-wider text-text-muted">Total Predictions</span>
                  <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="text-3xl font-extrabold font-mono text-text-primary">
                    {totalPredictions}
                  </div>
                  <p className="text-xs text-text-secondary mt-1">
                    Exoplanet candidates evaluated
                  </p>
                </div>
              </GlassCard>

              {/* Stat 2: Habitable Candidates */}
              <GlassCard padding="lg" hoverable={false} className="flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase font-bold tracking-wider text-text-muted">Potentially Habitable</span>
                  <div className="w-8 h-8 rounded-lg bg-success/10 border border-success/20 flex items-center justify-center text-success">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="text-3xl font-extrabold font-mono text-success">
                    {habitableCount}
                  </div>
                  <p className="text-xs text-text-secondary mt-1">
                    Classified as habitability index 1
                  </p>
                </div>
              </GlassCard>

              {/* Stat 3: Pending Moderation */}
              <GlassCard padding="lg" hoverable={false} className="flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase font-bold tracking-wider text-text-muted">Pending Review</span>
                  <div className="w-8 h-8 rounded-lg bg-warning/10 border border-warning/20 flex items-center justify-center text-warning">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="text-3xl font-extrabold font-mono text-warning">
                    {pendingCount}
                  </div>
                  <p className="text-xs text-text-secondary mt-1">
                    Awaiting admin verification
                  </p>
                </div>
              </GlassCard>

              {/* Stat 4: Approved / Ranked */}
              <GlassCard padding="lg" hoverable={false} className="flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase font-bold tracking-wider text-text-muted">Approved Planets</span>
                  <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="text-3xl font-extrabold font-mono text-accent">
                    {approvedCount}
                  </div>
                  <p className="text-xs text-text-secondary mt-1">
                    Active in public rankings
                  </p>
                </div>
              </GlassCard>
            </div>
          </div>

          {/* 3. Prediction History Section */}
          <div className="flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
              <div>
                <h2 className="text-2xl font-bold text-text-primary tracking-tight">
                  My Predictions & Submissions
                </h2>
                <p className="text-sm text-text-secondary mt-1">
                  History of exoplanet candidate habitability assessments and moderation records.
                </p>
              </div>

              {/* Status Filters */}
              {planets.length > 0 && (
                <div
                  className="flex flex-wrap items-center self-start sm:self-auto shadow-lg"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 8px',
                    borderRadius: '9999px',
                    backgroundColor: 'rgba(15, 23, 42, 0.75)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    backdropFilter: 'blur(12px)',
                  }}
                >
                  {[
                    { id: 'all', label: 'All', count: planets.length },
                    { id: 'pending', label: 'Pending', count: planets.filter((p) => p.status === 'pending').length },
                    { id: 'approved', label: 'Approved', count: planets.filter((p) => p.status === 'approved').length },
                    { id: 'rejected', label: 'Rejected', count: planets.filter((p) => p.status === 'rejected').length },
                  ].map((filter) => {
                    const isActive = statusFilter === filter.id;
                    return (
                      <button
                        key={filter.id}
                        onClick={() => setStatusFilter(filter.id)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '8px 18px',
                          borderRadius: '9999px',
                          fontSize: '0.875rem',
                          fontWeight: isActive ? 700 : 500,
                          color: isActive ? '#0A0E1A' : '#94A3B8',
                          backgroundColor: isActive ? '#4F8CFF' : 'transparent',
                          boxShadow: isActive ? '0 2px 12px rgba(79, 140, 255, 0.35)' : 'none',
                          border: isActive ? '1px solid #4F8CFF' : '1px solid transparent',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          whiteSpace: 'nowrap',
                        }}
                        className={!isActive ? 'hover:text-white hover:bg-white/[0.08]' : ''}
                      >
                        <span>{filter.label}</span>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '9999px',
                            backgroundColor: isActive ? 'rgba(10, 14, 26, 0.25)' : 'rgba(255, 255, 255, 0.1)',
                            color: isActive ? '#0A0E1A' : '#94A3B8',
                          }}
                        >
                          {filter.count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Content Display */}
            {planets.length === 0 ? (
              <GlassCard padding="lg" className="text-center py-16 flex flex-col items-center">
                <EmptyState
                  title="No predictions yet"
                  description="Run your first exoplanet habitability prediction to see it tracked here."
                  actionLabel="Predict an Exoplanet"
                  onAction={handleOpenPredictModal}
                />
              </GlassCard>
            ) : filteredPlanets.length === 0 ? (
              <GlassCard padding="lg" className="text-center py-12 flex flex-col items-center">
                <EmptyState
                  title="No Matching Records"
                  description={`No submissions found with status "${statusFilter}".`}
                  actionLabel="Show All Predictions"
                  onAction={() => setStatusFilter('all')}
                />
              </GlassCard>
            ) : (
              <div className="rounded-2xl bg-space-900/60 border border-white/10 overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="data-table w-full">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/[0.02]">
                        <th className="py-3.5 px-4 text-left text-xs font-bold uppercase tracking-wider text-text-muted">
                          Planet Candidate
                        </th>
                        <th className="py-3.5 px-4 text-left text-xs font-bold uppercase tracking-wider text-text-muted">
                          Recorded Date
                        </th>
                        <th className="py-3.5 px-4 text-left text-xs font-bold uppercase tracking-wider text-text-muted">
                          Review Status
                        </th>
                        <th className="py-3.5 px-4 text-right text-xs font-bold uppercase tracking-wider text-text-muted">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredPlanets.map((p) => {
                        const status = STATUS_MAP[p.status] || STATUS_MAP.pending;

                        return (
                          <tr
                            key={p.id}
                            onClick={() => setSelectedPlanet(p)}
                            className="hover:bg-white/[0.02] transition-colors cursor-pointer group"
                          >
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/20 flex items-center justify-center font-bold text-primary text-xs uppercase shrink-0 group-hover:scale-105 transition-transform">
                                  🪐
                                </div>
                                <div>
                                  <div className="font-bold text-text-primary text-sm group-hover:text-primary transition-colors">
                                    {p.planet_name}
                                  </div>
                                  <div className="text-[11px] font-mono text-text-muted">
                                    ID #{p.id}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-4 text-text-secondary text-sm">
                              {formatDate(p.created_at)}
                            </td>
                            <td className="py-4 px-4">
                              <Badge variant={status.variant}>
                                {status.label}
                              </Badge>
                            </td>
                            <td className="py-4 px-4 text-right">
                              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary group-hover:text-accent transition-colors">
                                <span>View Details</span>
                                <svg className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Dynamic Candidate Assessment Modal ("This box") */}
          <Modal
            isOpen={!!selectedPlanet}
            onClose={() => setSelectedPlanet(null)}
            title="Exoplanet Assessment Record"
            description="Complete candidate assessment telemetry, habitability rating, and verification state."
            size="md"
          >
            {selectedPlanet && (
              <div className="flex flex-col gap-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-3 pb-3 border-b border-white/5">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-xl sm:text-2xl font-extrabold text-text-primary tracking-tight">
                      {selectedPlanet.planet_name}
                    </h3>
                    <span className="text-xs text-text-muted mt-1 block">
                      Recorded: {formatDate(selectedPlanet.created_at)}
                    </span>
                  </div>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '8px 22px',
                      minHeight: '34px',
                      borderRadius: '9999px',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      lineHeight: 1.2,
                      whiteSpace: 'nowrap',
                      boxSizing: 'border-box',
                      backgroundColor:
                        selectedPlanet.status === 'approved'
                          ? 'rgba(34, 197, 94, 0.18)'
                          : selectedPlanet.status === 'rejected'
                          ? 'rgba(239, 68, 68, 0.18)'
                          : 'rgba(245, 158, 11, 0.18)',
                      color:
                        selectedPlanet.status === 'approved'
                          ? '#22C55E'
                          : selectedPlanet.status === 'rejected'
                          ? '#EF4444'
                          : '#F59E0B',
                      border:
                        selectedPlanet.status === 'approved'
                          ? '1.5px solid rgba(34, 197, 94, 0.45)'
                          : selectedPlanet.status === 'rejected'
                          ? '1.5px solid rgba(239, 68, 68, 0.45)'
                          : '1.5px solid rgba(245, 158, 11, 0.45)',
                    }}
                  >
                    {STATUS_MAP[selectedPlanet.status]?.label || selectedPlanet.status}
                  </span>
                </div>

                {/* Habitability Score Banner */}
                <div
                  style={{
                    padding: '16px 20px',
                    borderRadius: '14px',
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    boxSizing: 'border-box',
                  }}
                >
                  <div>
                    <span
                      style={{
                        display: 'block',
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        color: '#94A3B8',
                        marginBottom: '4px',
                      }}
                    >
                      Habitability Score
                    </span>
                    <span
                      style={{
                        fontFamily: 'monospace',
                        fontSize: '1.65rem',
                        fontWeight: 800,
                        color: '#4F8CFF',
                        lineHeight: 1,
                      }}
                    >
                      {selectedPlanet.habitability_probability != null
                        ? `${(selectedPlanet.habitability_probability * 100).toFixed(1)}%`
                        : '—'}
                    </span>
                  </div>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '8px 22px',
                      minHeight: '34px',
                      borderRadius: '9999px',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      lineHeight: 1.2,
                      whiteSpace: 'nowrap',
                      boxSizing: 'border-box',
                      flexShrink: 0,
                      backgroundColor: selectedPlanet.habitability === 1 ? 'rgba(34, 197, 94, 0.18)' : 'rgba(255, 255, 255, 0.08)',
                      color: selectedPlanet.habitability === 1 ? '#22C55E' : '#94A3B8',
                      border: selectedPlanet.habitability === 1 ? '1.5px solid rgba(34, 197, 94, 0.45)' : '1.5px solid rgba(255, 255, 255, 0.2)',
                    }}
                  >
                    {selectedPlanet.habitability === 1 ? 'Habitable' : 'Non-Habitable'}
                  </span>
                </div>

                {/* Rejection Reason (if rejected) with clear breathing room */}
                {selectedPlanet.status === 'rejected' && selectedPlanet.rejection_reason && (
                  <div
                    style={{
                      padding: '16px 18px',
                      borderRadius: '14px',
                      backgroundColor: 'rgba(239, 68, 68, 0.12)',
                      border: '1.5px solid rgba(239, 68, 68, 0.35)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                      boxSizing: 'border-box',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '6px 18px',
                          minHeight: '28px',
                          borderRadius: '9999px',
                          backgroundColor: 'rgba(239, 68, 68, 0.25)',
                          border: '1.5px solid rgba(239, 68, 68, 0.55)',
                          color: '#EF4444',
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          lineHeight: 1.2,
                          whiteSpace: 'nowrap',
                          boxSizing: 'border-box',
                        }}
                      >
                        <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Rejection Reason</span>
                      </span>
                    </div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: '0.8125rem',
                        lineHeight: '1.55',
                        color: '#CBD5E1',
                        paddingLeft: '2px',
                      }}
                    >
                      {selectedPlanet.rejection_reason}
                    </p>
                  </div>
                )}

                {/* Submitted Parameters */}
                {selectedPlanet.features && Object.keys(selectedPlanet.features).length > 0 && (
                  <div className="flex flex-col gap-2 pt-1">
                    <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-text-muted px-0.5">
                      <span className="flex items-center gap-1.5 text-accent font-bold">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        Submitted Parameters
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 p-3.5 rounded-xl bg-white/[0.02] border border-white/5 text-xs">
                      <div className="flex items-center justify-between py-1 border-b border-white/[0.03]">
                        <span className="text-text-muted text-[11px]">Radius</span>
                        <span className="font-mono font-medium text-text-primary text-[11.5px]">{selectedPlanet.features.P_RADIUS ?? '—'} <span className="text-text-muted text-[10px]">R⊕</span></span>
                      </div>
                      <div className="flex items-center justify-between py-1 border-b border-white/[0.03]">
                        <span className="text-text-muted text-[11px]">Mass</span>
                        <span className="font-mono font-medium text-text-primary text-[11.5px]">{selectedPlanet.features.P_MASS ?? '—'} <span className="text-text-muted text-[10px]">M⊕</span></span>
                      </div>
                      <div className="flex items-center justify-between py-1 border-b border-white/[0.03]">
                        <span className="text-text-muted text-[11px]">Density</span>
                        <span className="font-mono font-medium text-text-primary text-[11.5px]">{selectedPlanet.features.P_DENSITY ?? '—'} <span className="text-text-muted text-[10px]">g/cm³</span></span>
                      </div>
                      <div className="flex items-center justify-between py-1 border-b border-white/[0.03]">
                        <span className="text-text-muted text-[11px]">Surf Temp</span>
                        <span className="font-mono font-medium text-text-primary text-[11.5px]">{selectedPlanet.features.P_TEMP_SURF ?? '—'} <span className="text-text-muted text-[10px]">K</span></span>
                      </div>
                      <div className="flex items-center justify-between py-1 border-b border-white/[0.03]">
                        <span className="text-text-muted text-[11px]">Period</span>
                        <span className="font-mono font-medium text-text-primary text-[11.5px]">{selectedPlanet.features.P_PERIOD ?? '—'} <span className="text-text-muted text-[10px]">d</span></span>
                      </div>
                      <div className="flex items-center justify-between py-1 border-b border-white/[0.03]">
                        <span className="text-text-muted text-[11px]">Semi-Major</span>
                        <span className="font-mono font-medium text-text-primary text-[11.5px]">{selectedPlanet.features.P_SEMI_MAJOR_AXIS ?? '—'} <span className="text-text-muted text-[10px]">AU</span></span>
                      </div>
                      <div className="flex items-center justify-between py-1">
                        <span className="text-text-muted text-[11px]">Star Temp</span>
                        <span className="font-mono font-medium text-text-primary text-[11.5px]">{selectedPlanet.features.S_TEMPERATURE ?? '—'} <span className="text-text-muted text-[10px]">K</span></span>
                      </div>
                      <div className="flex items-center justify-between py-1">
                        <span className="text-text-muted text-[11px]">Star Lum</span>
                        <span className="font-mono font-medium text-text-primary text-[11.5px]">{selectedPlanet.features.S_LUMINOSITY ?? '—'} <span className="text-text-muted text-[10px]">L☉</span></span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Candidate Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-white/5 text-xs text-text-muted">
                  <span className="text-text-muted">Candidate Submission</span>
                  <span className="font-mono text-text-secondary">ID #{selectedPlanet.id}</span>
                </div>
              </div>
            )}
          </Modal>
        </>
      )}

      {/* 4. Edit Profile Details Modal */}
      <Modal
        isOpen={isEditProfileModalOpen}
        onClose={handleCloseEditProfile}
        title="Edit Profile Details"
        description="Update your astronomer account information. Changes will instantly update your dashboard."
        size="md"
      >
        <form onSubmit={handleProfileSubmit} className="flex flex-col gap-8">
          {profileError && (
            <div className="p-4 rounded-xl bg-danger/10 border border-danger/25 text-danger text-xs leading-relaxed flex items-start gap-2.5">
              <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{profileError}</span>
            </div>
          )}

          {profileSuccess && (
            <div className="p-4 rounded-xl bg-success/10 border border-success/25 text-success text-xs font-semibold flex items-center gap-2.5">
              <span className="text-base font-bold">✓</span> Profile updated successfully!
            </div>
          )}

          <div className="form-group">
            <label htmlFor="edit_username" className="font-semibold">
              Astronomer Username <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              id="edit_username"
              value={profileFormData.username}
              onChange={(e) => setProfileFormData((prev) => ({ ...prev, username: e.target.value }))}
              placeholder="e.g. astronomer"
              required
              disabled={profileLoading || profileSuccess}
            />
          </div>

          <div className="form-group">
            <label htmlFor="edit_email" className="font-semibold">
              Email Address <span className="text-danger">*</span>
            </label>
            <input
              type="email"
              id="edit_email"
              value={profileFormData.email}
              onChange={(e) => setProfileFormData((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="e.g. astronomer@exohabitai.com"
              required
              disabled={profileLoading || profileSuccess}
            />
          </div>

          {/* Inner Card Details with generous spacing and matching surface-inset / card styling */}
          <div className="p-5 sm:p-6 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col divide-y divide-white/10 text-xs text-text-muted">
            <div className="flex items-center justify-between pb-3.5">
              <span className="text-xs text-text-muted uppercase font-bold tracking-wider">Account Role</span>
              <span className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-lg bg-accent/15 border border-accent/30 text-accent capitalize">
                {user?.role || 'User'}
              </span>
            </div>
            <div className="flex items-center justify-between py-3.5">
              <span className="text-xs text-text-muted uppercase font-bold tracking-wider">User ID</span>
              <span className="text-xs font-mono font-medium text-text-secondary">#{user?.id}</span>
            </div>
            <p className="text-xs text-text-muted leading-relaxed pt-3.5">
              * Sensitive credentials such as authentication passwords and administrative roles remain protected.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-6 border-t border-white/5">
            <button
              type="button"
              onClick={handleCloseEditProfile}
              disabled={profileLoading}
              className="btn-secondary text-sm py-2.5 px-5 border-white/10"
            >
              Cancel
            </button>
            <Button type="submit" loading={profileLoading} disabled={profileSuccess} className="shadow-[0_0_20px_rgba(79,140,255,0.25)] text-sm py-2.5 px-6 font-semibold">
              {profileLoading ? 'Saving...' : 'Save Profile'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* 5. Integrated Add / Predict Planet Modal */}
      <Modal
        isOpen={isPredictModalOpen}
        onClose={handleClosePredictModal}
        title={predictResult ? 'Prediction Result' : 'Predict & Submit Planet'}
        description={
          predictResult
            ? 'Candidate exoplanet evaluation completed.'
            : 'Enter exoplanetary, orbital, and stellar parameters to run machine learning habitability inference.'
        }
        size="lg"
      >
        {predictResult ? (
          <div className="flex flex-col items-center text-center gap-6 py-4">
            <div className="w-16 h-16 rounded-full bg-success/15 border border-success/30 flex items-center justify-center text-success text-2xl font-bold">
              ✓
            </div>

            <div>
              <h3 className="text-xl font-bold text-text-primary">
                {formData.planet_name}
              </h3>
              <p className="text-sm text-text-secondary mt-1">
                Candidate planet evaluated and recorded in your account.
              </p>

              <div className="mt-6 p-5 rounded-2xl bg-white/[0.04] border border-white/10 flex flex-col items-center gap-2 max-w-sm mx-auto">
                <span className="text-xs uppercase font-bold tracking-wider text-text-muted">
                  Predicted Habitability
                </span>
                <span className="font-mono text-4xl font-extrabold text-primary">
                  {(predictResult.habitability_probability * 100).toFixed(1)}%
                </span>
                <span
                  className={`text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-full border mt-1 ${predictResult.habitability === 1
                      ? 'text-success border-success/40 bg-success/10'
                      : 'text-text-secondary border-white/10 bg-white/5'
                    }`}
                >
                  {predictResult.habitability === 1 ? 'Potentially Habitable' : 'Non-Habitable'}
                </span>
              </div>

              <p className="text-xs text-text-muted mt-5 max-w-sm mx-auto leading-relaxed">
                This planet is currently <strong className="text-warning">pending moderation</strong>. Once reviewed by an administrator, it will be visible in public rankings.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full mt-4">
              <Button onClick={handleResetForm} className="flex-1">
                Predict Another Planet
              </Button>
              <Button variant="secondary" onClick={handleClosePredictModal} className="flex-1">
                View in Dashboard
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handlePredictSubmit} className="flex flex-col gap-8">
            {predictError && (
              <div role="alert" aria-live="polite">
                <ErrorState
                  variant={predictError.variant}
                  message={predictError.message}
                />
              </div>
            )}

            {/* Planet Name */}
            <div className="flex flex-col">
              <label htmlFor="modal_planet_name">
                Planet Name <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                id="modal_planet_name"
                value={formData.planet_name}
                onChange={(e) => handleInputChange('planet_name', e.target.value)}
                placeholder="e.g. Proxima Centauri b"
                required
                disabled={predictLoading}
              />
            </div>

            {/* 3 Parameter Columns */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Planetary Properties */}
              <div className="flex flex-col gap-5">
                <span className="form-section-label text-primary">
                  Planetary Body
                </span>
                {[
                  { id: 'P_RADIUS', label: 'Radius (Earth = 1)', step: '0.01', min: '0.01', max: '100.0' },
                  { id: 'P_MASS', label: 'Mass (Earth = 1)', step: '0.01', min: '0.01', max: '10000.0' },
                  { id: 'P_DENSITY', label: 'Density (g/cm³)', step: '0.01', min: '0.01', max: '50.0' },
                  { id: 'P_TEMP_SURF', label: 'Surface Temp (K)', step: '1', min: '1', max: '5000' },
                ].map((f) => (
                  <div key={f.id} className="flex flex-col">
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor={`modal_${f.id}`} className="m-0">
                        {f.label}
                      </label>
                      <Tooltip content={FIELD_DESCRIPTIONS[f.id]} />
                    </div>
                    <input
                      type="number"
                      id={`modal_${f.id}`}
                      step={f.step}
                      min={f.min}
                      max={f.max}
                      value={formData[f.id]}
                      onChange={(e) => handleInputChange(f.id, e.target.value)}
                      required
                      disabled={predictLoading}
                    />
                  </div>
                ))}
              </div>

              {/* Orbital Properties */}
              <div className="flex flex-col gap-5">
                <span className="form-section-label text-accent">
                  Orbital Mechanics
                </span>
                {[
                  { id: 'P_PERIOD', label: 'Period (days)', step: '0.01', min: '0.01', max: '100000.0' },
                  { id: 'P_SEMI_MAJOR_AXIS', label: 'Semi-Major Axis (AU)', step: '0.001', min: '0.001', max: '500.0' },
                ].map((f) => (
                  <div key={f.id} className="flex flex-col">
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor={`modal_${f.id}`} className="m-0">
                        {f.label}
                      </label>
                      <Tooltip content={FIELD_DESCRIPTIONS[f.id]} />
                    </div>
                    <input
                      type="number"
                      id={`modal_${f.id}`}
                      step={f.step}
                      min={f.min}
                      max={f.max}
                      value={formData[f.id]}
                      onChange={(e) => handleInputChange(f.id, e.target.value)}
                      required
                      disabled={predictLoading}
                    />
                  </div>
                ))}
              </div>

              {/* Stellar Properties */}
              <div className="flex flex-col gap-5">
                <span className="form-section-label text-highlight">
                  Host Star
                </span>
                {[
                  { id: 'S_TEMPERATURE', label: 'Star Temp (K)', step: '1', min: '500', max: '50000' },
                  { id: 'S_LUMINOSITY', label: 'Luminosity (Sun = 1)', step: '0.00001', min: '0.00001', max: '1000000.0' },
                  { id: 'S_METALLICITY', label: 'Metallicity [Fe/H]', step: '0.01', min: '-10.0', max: '10.0' },
                ].map((f) => (
                  <div key={f.id} className="flex flex-col">
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor={`modal_${f.id}`} className="m-0">
                        {f.label}
                      </label>
                      <Tooltip content={FIELD_DESCRIPTIONS[f.id]} />
                    </div>
                    <input
                      type="number"
                      id={`modal_${f.id}`}
                      step={f.step}
                      min={f.min}
                      max={f.max}
                      value={formData[f.id]}
                      onChange={(e) => handleInputChange(f.id, e.target.value)}
                      required
                      disabled={predictLoading}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3.5 pt-6 border-t border-white/5 mt-4">
              <button
                type="button"
                onClick={handleClosePredictModal}
                disabled={predictLoading}
                className="btn-secondary text-sm py-2.5 px-5 border-white/10"
              >
                Cancel
              </button>
              <Button type="submit" loading={predictLoading} className="shadow-[0_0_15px_rgba(79,140,255,0.2)] text-sm py-2.5 px-6">
                {predictLoading ? 'Calculating Habitability...' : 'Submit & Predict'}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
