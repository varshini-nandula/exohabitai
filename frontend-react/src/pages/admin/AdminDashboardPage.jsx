import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { adminAPI } from '../../api/admin';
import GlassCard from '../../components/GlassCard';
import StatCard from '../../components/StatCard';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorState from '../../components/ErrorState';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const res = await adminAPI.getDashboard();
      if (res.data?.status === 'success') {
        setStats(res.data.data);
      } else {
        setError(res.data?.message || 'Failed to retrieve dashboard metrics.');
      }
    } catch (err) {
      console.error(err);
      setError('An error occurred while fetching system health metrics. Please verify admin authorization.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading) return <LoadingSpinner message="Querying admin control plane stats..." />;
  if (error) return <ErrorState message={error} onRetry={fetchDashboardData} />;
  if (!stats) return <ErrorState message="No dashboard metadata received." onRetry={fetchDashboardData} />;

  const { system_status, stats: countStats, current_model, last_retraining, recent_submissions } = stats;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent font-mono">
          SYSTEM OVERVIEW
        </h1>
        <p className="text-text-secondary font-mono text-sm mt-1">
          Real-time telemetry, model version registry, and moderation control panel.
        </p>
      </div>

      {/* Grid: System Status & Model Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* System Status Card */}
        <GlassCard className="lg:col-span-2 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
              <h3 className="font-bold font-mono text-sm tracking-wider uppercase text-text-muted">
                System Telemetry
              </h3>
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent"></span>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 my-4">
              {/* Telemetry row 1 */}
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${system_status.backend_online ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'}`}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-text-secondary font-mono uppercase">API Host</span>
                  <span className="text-sm font-semibold font-mono">ONLINE</span>
                </div>
              </div>

              {/* Telemetry row 2 */}
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${system_status.db_connected ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'}`}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-text-secondary font-mono uppercase">Database</span>
                  <span className="text-sm font-semibold font-mono">CONNECTED</span>
                </div>
              </div>

              {/* Telemetry row 3 */}
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${system_status.model_loaded ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'}`}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-text-secondary font-mono uppercase">Predictor</span>
                  <span className="text-sm font-semibold font-mono">ACTIVE MODEL</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 pt-4 border-t border-white/5 text-xs text-text-secondary font-mono">
            <div>
              <span className="text-text-muted mr-2">Core Version:</span>
              <span className="text-text-primary font-semibold">{system_status.model_version}</span>
            </div>
            <div>
              <span className="text-text-muted mr-2">Retraining Job:</span>
              <span className={`font-semibold ${system_status.retraining_in_progress ? 'text-warning animate-pulse' : 'text-text-primary'}`}>
                {system_status.retraining_in_progress ? 'IN PROGRESS...' : 'IDLE'}
              </span>
            </div>
          </div>
        </GlassCard>

        {/* Model Snapshot Card */}
        <GlassCard className="p-6 flex flex-col justify-between">
          <div>
            <h3 className="font-bold font-mono text-sm tracking-wider uppercase text-text-muted border-b border-white/5 pb-4 mb-4">
              Active Model Version
            </h3>
            {current_model ? (
              <div className="space-y-3 font-mono">
                <div className="flex justify-between">
                  <span className="text-xs text-text-secondary">Identifier:</span>
                  <span className="text-sm font-bold text-accent">{current_model.version}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-text-secondary">F1 Metric:</span>
                  <span className="text-sm font-semibold text-text-primary">{(current_model.f1_score * 100).toFixed(2)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-text-secondary">Accuracy:</span>
                  <span className="text-sm font-semibold text-text-primary">{(current_model.accuracy * 100).toFixed(2)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-text-secondary">Updated:</span>
                  <span className="text-xs text-text-primary">{new Date(current_model.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ) : (
              <div className="text-sm text-text-secondary py-4 font-mono">
                No version seeded in model registry.
              </div>
            )}
          </div>
          <Link
            to="/admin/models"
            className="text-xs font-semibold font-mono text-primary hover:text-primary-light inline-flex items-center gap-1 mt-6"
          >
            Manage Model Lifecycle &rarr;
          </Link>
        </GlassCard>
      </div>

      {/* Grid: Stat Counts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="TOTAL USERS" value={countStats.total_users} description="Registered platform accounts" />
        <StatCard title="TOTAL PLANETS" value={countStats.total_planets} description="Database prediction entries" />
        <StatCard
          title="PENDING QUEUE"
          value={countStats.pending_submissions}
          description="Awaiting admin approval"
          highlight={countStats.pending_submissions > 0}
        />
        <StatCard title="USER GENERATED" value={countStats.user_generated} description="Submitted by platform users" />
      </div>

      {/* Grid: Recent Submissions & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Submissions Feed */}
        <GlassCard className="lg:col-span-2 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold font-mono text-sm tracking-wider uppercase text-text-muted">
              Recent Submissions Feed
            </h3>
            <Link to="/admin/moderation" className="text-xs text-primary hover:text-primary-light font-mono font-semibold">
              Manage Queue &rarr;
            </Link>
          </div>

          {recent_submissions.length === 0 ? (
            <div className="text-center py-8 text-text-secondary font-mono text-sm">
              No user planet submissions found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm font-mono">
                <thead>
                  <tr className="border-b border-white/5 text-text-muted text-xs">
                    <th className="pb-3 font-semibold">Planet Name</th>
                    <th className="pb-3 font-semibold">Submitter</th>
                    <th className="pb-3 font-semibold">Probability</th>
                    <th className="pb-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {recent_submissions.map((p) => (
                    <tr key={p.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 font-semibold text-text-primary">{p.planet_name}</td>
                      <td className="py-3 text-text-secondary">{p.submitter || 'anonymous'}</td>
                      <td className="py-3 text-text-primary">
                        {p.habitability_probability !== null
                          ? `${(p.habitability_probability * 100).toFixed(2)}%`
                          : 'N/A'}
                      </td>
                      <td className="py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            p.status === 'approved'
                              ? 'bg-success/15 text-success'
                              : p.status === 'rejected'
                              ? 'bg-danger/15 text-danger'
                              : 'bg-warning/15 text-warning'
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>

        {/* Quick Actions Panel */}
        <GlassCard className="p-6">
          <h3 className="font-bold font-mono text-sm tracking-wider uppercase text-text-muted border-b border-white/5 pb-4 mb-6">
            Quick Actions Control
          </h3>

          <div className="space-y-4 flex flex-col">
            <button
              onClick={() => navigate('/admin/moderation')}
              className="btn-primary w-full justify-center text-sm font-mono py-3 font-semibold"
            >
              Review Pending Queue
            </button>

            <button
              onClick={() => navigate('/admin/models?tab=retraining')}
              className="btn-secondary w-full justify-center text-sm font-mono py-3 font-semibold"
            >
              Configure ML Retraining
            </button>

            <button
              onClick={() => navigate('/admin/models?tab=logs')}
              className="btn-secondary w-full justify-center text-sm font-mono py-3 font-semibold text-text-secondary hover:text-text-primary"
            >
              View Audit Trails
            </button>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
