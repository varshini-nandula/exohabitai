import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { planetsAPI } from '../api/planets';
import { extractError } from '../api/client';
import GlassCard from '../components/GlassCard';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import Badge from '../components/ui/Badge';
import PageHeader from '../components/ui/PageHeader';

const STATUS_MAP = {
  approved: { label: 'Approved', variant: 'success' },
  pending: { label: 'Pending', variant: 'warning' },
  rejected: { label: 'Rejected', variant: 'danger' },
};

export default function HistoryPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [planets, setPlanets] = useState([]);
  const [errorState, setErrorState] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [statusFilter, setStatusFilter] = useState('all');

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
            message: res.data?.message || 'Could not retrieve submission history.',
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

  const filteredPlanets = statusFilter === 'all'
    ? planets
    : planets.filter(p => p.status === statusFilter);

  if (loading) {
    return <div className="site-container py-16"><LoadingSpinner message="Loading your predictions..." /></div>;
  }

  if (errorState) {
    return (
      <div className="site-container py-16">
        <ErrorState
          variant={errorState.variant}
          message={errorState.message}
          onRetry={() => setReloadToken((t) => t + 1)}
        />
      </div>
    );
  }

  return (
    <div className="site-container section-padding flex flex-col" style={{ gap: '40px' }}>
      <PageHeader
        eyebrow="Your Account"
        eyebrowColor="text-accent"
        title="My Predictions"
        description="Track your saved habitability predictions and submitted exoplanets. Approved planets appear in the public rankings."
      />

      {planets.length > 0 && (
        <div className="flex justify-center gap-2">
          {['all', 'pending', 'approved', 'rejected'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg capitalize transition-all ${
                statusFilter === s
                  ? 'bg-primary/10 text-primary'
                  : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {planets.length === 0 ? (
        <EmptyState
          title="No Predictions Saved Yet"
          description="You haven't saved any exoplanet predictions yet. Run a prediction to see it tracked here."
          actionLabel="Predict a Planet"
          onAction={() => navigate('/predict')}
        />
      ) : filteredPlanets.length === 0 ? (
        <EmptyState
          title="No Matches"
          description={`No submissions with status "${statusFilter}".`}
          actionLabel="Show All"
          onAction={() => setStatusFilter('all')}
        />
      ) : (
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto w-full">
          {filteredPlanets.map((p) => {
            const status = STATUS_MAP[p.status] || STATUS_MAP.pending;
            const prob = p.habitability_probability != null
              ? (p.habitability_probability * 100).toFixed(1)
              : '—';
            return (
              <GlassCard key={p.id} hoverable={true} padding="md" className="flex items-center gap-4">
                <div className="flex-grow min-w-0">
                  <h4 className="font-bold text-sm text-text-primary truncate mb-2">
                    {p.planet_name}
                  </h4>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </div>
                <div className="text-right shrink-0 pl-4">
                  <span className="font-bold font-mono text-sm text-primary">{prob}{prob !== '—' ? '%' : ''}</span>
                  <div className="text-xs text-text-muted mt-1">Habitability</div>
                </div>
              </GlassCard>
            );
          })}
        </section>
      )}
    </div>
  );
}
