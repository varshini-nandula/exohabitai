import { useState, useEffect } from 'react';
import { adminAPI } from '../../api/admin';
import GlassCard from '../../components/GlassCard';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorState from '../../components/ErrorState';
import Badge from '../../components/ui/Badge';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

// ---------------------------------------------------------------------------
// Animated stat number (counts up on mount)
// ---------------------------------------------------------------------------
function AnimatedNumber({ value, decimals = 0 }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const num = parseFloat(value);
    if (isNaN(num)) { setDisplay(value); return; }
    let step = 0;
    const total = 40;
    const inc = num / total;
    const id = setInterval(() => {
      step++;
      if (step >= total) { setDisplay(num); clearInterval(id); }
      else setDisplay(parseFloat((inc * step).toFixed(decimals)));
    }, 18);
    return () => clearInterval(id);
  }, [value, decimals]);
  return typeof display === 'number'
    ? display.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    : display;
}

// ---------------------------------------------------------------------------
// Small reusable pieces
// ---------------------------------------------------------------------------
function StatusDot({ ok }) {
  return (
    <span className={`inline-flex h-2 w-2 rounded-full ${ok ? 'bg-success' : 'bg-danger'}`} />
  );
}

function QuickActionCard({ to, icon, label, description, color = 'primary' }) {
  const colorMap = {
    primary: { bg: 'bg-primary/10', border: 'border-primary/20', text: 'text-primary', hoverBg: 'hover:bg-primary/15', hoverBorder: 'hover:border-primary/30' },
    accent: { bg: 'bg-accent/10', border: 'border-accent/20', text: 'text-accent', hoverBg: 'hover:bg-accent/15', hoverBorder: 'hover:border-accent/30' },
    highlight: { bg: 'bg-highlight/10', border: 'border-highlight/20', text: 'text-highlight', hoverBg: 'hover:bg-highlight/15', hoverBorder: 'hover:border-highlight/30' },
    warning: { bg: 'bg-warning/10', border: 'border-warning/20', text: 'text-warning', hoverBg: 'hover:bg-warning/15', hoverBorder: 'hover:border-warning/30' },
  };
  const c = colorMap[color] || colorMap.primary;
  return (
    <Link
      to={to}
      className={`group flex items-center gap-4 p-4 rounded-xl border transition-all duration-200 ${c.border} ${c.hoverBorder} ${c.hoverBg} bg-transparent`}
    >
      <div className={`w-10 h-10 rounded-lg ${c.bg} ${c.text} flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110`}>
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={icon} />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <span className={`text-sm font-semibold ${c.text} block`}>{label}</span>
        <span className="text-xs text-text-muted block mt-0.5">{description}</span>
      </div>
      <svg className="w-4 h-4 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Main Dashboard
// ---------------------------------------------------------------------------

const fadeIn = {
  hidden: { opacity: 0, y: 16 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.08, type: 'spring', stiffness: 80, damping: 18 },
  }),
};

export default function AdminDashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await adminAPI.getDashboard();
      if (res.data?.status === 'success') {
        setStats(res.data.data);
      } else {
        setError(res.data?.message || 'Failed to load dashboard.');
      }
    } catch (err) {
      console.error(err);
      setError('Error loading dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDashboardData(); }, []);

  if (loading) return <div className="flex items-center justify-center py-20"><LoadingSpinner message="Loading dashboard..." /></div>;
  if (error) return <ErrorState message={error} onRetry={fetchDashboardData} />;
  if (!stats) return <ErrorState message="No dashboard data available." onRetry={fetchDashboardData} />;

  const { system_status, stats: countStats, current_model, recent_submissions } = stats;

  const allHealthy = system_status.backend_online && system_status.db_connected && system_status.model_loaded;

  return (
    <motion.div
      className="space-y-8"
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
    >
      {/* ── Header ─────────────────────────────────────────────── */}
      <motion.div variants={fadeIn} custom={0}>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary">Dashboard</h1>
        <p className="text-text-secondary text-sm mt-1">System overview, metrics, and recent activity.</p>
      </motion.div>

      {/* ── KPI Stats Row ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Users', value: countStats.total_users, icon: '👤', color: 'text-primary' },
          { label: 'Total Planets', value: countStats.total_planets, icon: '🪐', color: 'text-accent' },
          { label: 'Pending Review', value: countStats.pending_submissions, icon: '⏳', color: 'text-warning', highlight: countStats.pending_submissions > 0 },
          { label: 'User Submitted', value: countStats.user_generated, icon: '📝', color: 'text-highlight' },
        ].map((stat, i) => (
          <motion.div key={stat.label} variants={fadeIn} custom={i + 1}>
            <GlassCard
              hoverable
              padding="none"
              className={`p-5 relative overflow-hidden ${stat.highlight ? 'border-warning/30' : ''}`}
            >
              {/* Subtle gradient accent at top */}
              <div className={`absolute top-0 left-0 right-0 h-0.5 ${
                stat.highlight ? 'bg-gradient-to-r from-warning/60 to-warning/0' :
                i === 0 ? 'bg-gradient-to-r from-primary/40 to-primary/0' :
                i === 1 ? 'bg-gradient-to-r from-accent/40 to-accent/0' :
                i === 3 ? 'bg-gradient-to-r from-highlight/40 to-highlight/0' :
                'bg-transparent'
              }`} />

              <div className="flex items-start justify-between mb-3">
                <span className="text-[11px] uppercase tracking-wider font-semibold text-text-muted">
                  {stat.label}
                </span>
                <span className="text-lg leading-none">{stat.icon}</span>
              </div>

              <div className={`text-3xl font-bold font-mono tracking-tight ${stat.color}`}>
                <AnimatedNumber value={stat.value} />
              </div>

              {stat.highlight && (
                <span className="inline-flex items-center gap-1 mt-2 text-[10px] font-semibold text-warning">
                  <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse" />
                  Needs attention
                </span>
              )}
            </GlassCard>
          </motion.div>
        ))}
      </div>

      {/* ── System Health + Active Model Row ────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* System Health — spans 3 cols */}
        <motion.div variants={fadeIn} custom={5} className="lg:col-span-3">
          <GlassCard hoverable={false} padding="none" className="p-6 h-full">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-sm text-text-primary">System Health</h3>
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
                allHealthy
                  ? 'bg-success/10 text-success border border-success/20'
                  : 'bg-danger/10 text-danger border border-danger/20'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${allHealthy ? 'bg-success animate-pulse' : 'bg-danger'}`} />
                {allHealthy ? 'All Systems Online' : 'Issues Detected'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'API Server', ok: system_status.backend_online },
                { label: 'Database', ok: system_status.db_connected },
                { label: 'ML Model', ok: system_status.model_loaded },
              ].map((s) => (
                <div
                  key={s.label}
                  className={`flex items-center gap-3 p-3.5 rounded-xl border transition-colors ${
                    s.ok
                      ? 'bg-success/5 border-success/15'
                      : 'bg-danger/5 border-danger/15'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    s.ok ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'
                  }`}>
                    <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                        d={s.ok ? 'M5 13l4 4L19 7' : 'M6 18L18 6M6 6l12 12'} />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs text-text-muted block">{s.label}</span>
                    <span className={`text-sm font-semibold ${s.ok ? 'text-success' : 'text-danger'}`}>
                      {s.ok ? 'Online' : 'Offline'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Model version + training footer */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-5 pt-4 border-t border-white/5 text-xs text-text-secondary">
              <div className="flex items-center gap-2">
                <span className="text-text-muted">Model Version</span>
                <span className="font-mono font-semibold text-text-primary">{system_status.model_version}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-text-muted">Training</span>
                <span className={`font-semibold ${system_status.retraining_in_progress ? 'text-warning animate-pulse' : 'text-text-primary'}`}>
                  {system_status.retraining_in_progress ? 'In Progress...' : 'Idle'}
                </span>
              </div>
            </div>
          </GlassCard>
        </motion.div>

        {/* Active Model — spans 2 cols */}
        <motion.div variants={fadeIn} custom={6} className="lg:col-span-2">
          <GlassCard hoverable={false} padding="none" className="p-6 h-full flex flex-col justify-between border-t-2 border-t-accent/30">
            <div>
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-semibold text-sm text-text-primary">Active Model</h3>
                <span className="text-[10px] font-semibold text-accent bg-accent/10 border border-accent/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Production
                </span>
              </div>

              {current_model ? (
                <div className="space-y-3.5">
                  {[
                    { label: 'Version', value: current_model.version, color: 'text-accent font-mono' },
                    { label: 'F1 Score', value: `${(current_model.f1_score * 100).toFixed(1)}%` },
                    { label: 'Accuracy', value: `${(current_model.accuracy * 100).toFixed(1)}%` },
                    { label: 'Updated', value: new Date(current_model.created_at).toLocaleDateString() },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center justify-between">
                      <span className="text-xs text-text-muted">{row.label}</span>
                      <span className={`text-sm font-semibold ${row.color || 'text-text-primary'}`}>{row.value}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-text-muted py-6 text-center">No model loaded.</div>
              )}
            </div>

            <Link
              to="/admin/models"
              className="mt-5 pt-4 border-t border-white/5 text-xs font-semibold text-primary hover:text-primary-light inline-flex items-center gap-1.5 transition-colors"
            >
              View All Models
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </Link>
          </GlassCard>
        </motion.div>
      </div>

      {/* ── Quick Actions + Recent Submissions Row ─────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Quick Actions — spans 2 cols */}
        <motion.div variants={fadeIn} custom={7} className="lg:col-span-2">
          <GlassCard hoverable={false} padding="none" className="p-6 h-full">
            <h3 className="font-semibold text-sm text-text-primary mb-4">Quick Actions</h3>
            <div className="space-y-2.5">
              <QuickActionCard
                to="/admin/moderation"
                icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                label="Review Submissions"
                description={countStats.pending_submissions > 0 ? `${countStats.pending_submissions} pending` : 'All caught up'}
                color={countStats.pending_submissions > 0 ? 'warning' : 'primary'}
              />
              <QuickActionCard
                to="/admin/training"
                icon="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                label="Configure Training"
                description="Start or schedule retraining"
                color="accent"
              />
              <QuickActionCard
                to="/admin/users"
                icon="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                label="Manage Users"
                description={`${countStats.total_users} registered`}
                color="highlight"
              />
              <QuickActionCard
                to="/admin/logs"
                icon="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                label="View Audit Logs"
                description="Activity & retraining history"
                color="primary"
              />
            </div>
          </GlassCard>
        </motion.div>

        {/* Recent Submissions — spans 3 cols */}
        <motion.div variants={fadeIn} custom={8} className="lg:col-span-3">
          <GlassCard hoverable={false} padding="none" className="p-6 h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm text-text-primary">Recent Submissions</h3>
              <Link to="/admin/moderation" className="text-xs text-primary hover:text-primary-light font-semibold transition-colors">
                View All →
              </Link>
            </div>

            {recent_submissions.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-10">
                <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                </div>
                <p className="text-sm text-text-muted font-medium">No recent submissions</p>
                <p className="text-xs text-text-muted mt-1">New planet submissions will appear here.</p>
              </div>
            ) : (
              <div className="overflow-x-auto flex-1">
                <table className="data-table w-full">
                  <thead>
                    <tr>
                      <th className="text-left">Planet</th>
                      <th className="text-left">Submitter</th>
                      <th className="text-right">Score</th>
                      <th className="text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent_submissions.map((p) => (
                      <tr key={p.id}>
                        <td className="primary-cell font-medium">{p.planet_name}</td>
                        <td className="text-text-secondary">{p.submitter || 'anonymous'}</td>
                        <td className="text-right font-mono text-sm">
                          {p.habitability_probability != null
                            ? `${(p.habitability_probability * 100).toFixed(1)}%`
                            : '—'}
                        </td>
                        <td className="text-center">
                          <Badge variant={
                            p.status === 'approved' ? 'success' :
                            p.status === 'rejected' ? 'danger' : 'warning'
                          }>
                            {p.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </GlassCard>
        </motion.div>
      </div>
    </motion.div>
  );
}
