import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { planetsAPI } from '../api/planets';
import { extractError } from '../api/client';
import GlassCard from '../components/GlassCard';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';

const STATUS_STYLES = {
  approved: { label: 'Approved', cls: 'text-success border-success/40 bg-success/10' },
  pending: { label: 'Pending Review', cls: 'text-highlight border-highlight/40 bg-highlight/10' },
  rejected: { label: 'Rejected', cls: 'text-danger border-danger/40 bg-danger/10' },
};

export default function HistoryPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [planets, setPlanets] = useState([]);
  const [errorState, setErrorState] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);

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

  if (loading) {
    return <div className="site-container py-16"><LoadingSpinner message="Retrieving your submission history..." /></div>;
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
    <div className="site-container section-padding flex flex-col" style={{ gap: '48px' }}>
      <div className="page-header">
        <span className="page-eyebrow text-accent">Navigator Logbook</span>
        <h1 className="font-mono">My Submissions</h1>
        <p>
          Track the candidates you have charted and their moderation status. Approved
          candidates appear in the public rankings.
        </p>
      </div>

      {planets.length === 0 ? (
        <EmptyState
          title="No Submissions Yet"
          description="You haven't charted any exoplanet candidates. Submit one to see it tracked here."
          actionLabel="Add a Candidate"
          onAction={() => navigate('/add-planet')}
        />
      ) : (
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {planets.map((p) => {
            const status = STATUS_STYLES[p.status] || STATUS_STYLES.pending;
            const prob = p.habitability_probability != null
              ? (p.habitability_probability * 100).toFixed(1)
              : '—';
            return (
              <GlassCard key={p.id} hoverable={true} className="flex items-center gap-5 py-6 px-8">
                <div className="flex-grow min-w-0">
                  <h4 className="font-bold text-sm font-mono text-text-primary truncate mb-2">
                    {p.planet_name}
                  </h4>
                  <span className={`font-mono text-[10px] tracking-wider uppercase px-2 py-0.5 rounded border ${status.cls}`}>
                    {status.label}
                  </span>
                </div>
                <div className="text-right shrink-0 pl-4">
                  <span className="font-bold font-mono text-sm text-primary">{prob}{prob !== '—' ? '%' : ''}</span>
                  <div className="text-[9px] font-mono uppercase text-text-muted mt-1">Habitability</div>
                </div>
              </GlassCard>
            );
          })}
        </section>
      )}
    </div>
  );
}
