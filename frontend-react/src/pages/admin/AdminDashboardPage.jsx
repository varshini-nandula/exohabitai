import { useState, useEffect } from "react";
import { adminAPI } from "../../api/admin";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import LoadingSpinner from "../../components/LoadingSpinner";
import ErrorState from "../../components/ErrorState";
import Badge from "../../components/ui/Badge";
import GlassCard from "../../components/GlassCard";

/* ------------------------------------------------------------------ */
/* Animated counter                                                      */
/* ------------------------------------------------------------------ */
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
      else { setDisplay(parseFloat((inc * step).toFixed(decimals))); }
    }, 20);
    return () => clearInterval(id);
  }, [value, decimals]);
  return typeof display === "number"
    ? display.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    : display;
}

/* ------------------------------------------------------------------ */
/* KPI Stat Card                                                         */
/* ------------------------------------------------------------------ */
function StatCard({ label, value, subtext, icon, accentClass, bgClass, borderClass, highlight, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: "easeOut" }}
    >
      <GlassCard
        padding="lg"
        variant="raised"
        hoverable
        className={`flex flex-col gap-4 h-full ${highlight ? "border-amber-400/30 bg-amber-500/5" : ""}`}
      >
        {/* Icon + label row */}
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${bgClass} border ${borderClass}`}>
            {icon}
          </div>
          <p className="text-lg font-semibold text-text-primary leading-snug pt-0.5">{label}</p>
        </div>

        {/* Value */}
        <div>
          <p className={`text-4xl font-black font-mono tracking-tight ${accentClass}`}>
            <AnimatedNumber value={value} />
          </p>
          <p className="text-xs text-text-muted mt-1.5 leading-relaxed">{subtext}</p>
        </div>
      </GlassCard>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Main page                                                             */
/* ------------------------------------------------------------------ */
export default function AdminDashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const res = await adminAPI.getDashboard();
      if (res.data?.status === "success") setStats(res.data.data);
      else setError(res.data?.message || "Failed to load dashboard.");
    } catch (e) {
      console.error(e);
      setError("Error loading dashboard.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <LoadingSpinner message="Loading telemetry..." />
    </div>
  );
  if (error) return <ErrorState message={error} onRetry={fetchData} />;
  if (!stats) return <ErrorState message="No data available." onRetry={fetchData} />;

  const { system_status, stats: s, current_model, recent_submissions } = stats;
  const allOk = system_status.backend_online && system_status.db_connected && system_status.model_loaded;

  return (
    <div className="flex flex-col gap-10 sm:gap-12">

      {/* ════════════════════════════════════════════════════════════
          1. PAGE HEADER
      ════════════════════════════════════════════════════════════ */}
      <div className="flex items-start justify-between gap-4 flex-wrap pb-8 border-b border-white/8">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-text-primary tracking-tight">
              Admin Operations Dashboard
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-success/10 text-success border border-success/25 flex-shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              Live
            </span>
          </div>
          <p className="text-text-secondary text-sm mt-2 max-w-2xl leading-relaxed">
            Real-time platform metrics, ML pipeline status, submission moderation and operational controls.
          </p>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="btn-secondary flex items-center gap-2 px-4 py-2.5 text-sm font-semibold flex-shrink-0 cursor-pointer disabled:opacity-50"
        >
          <svg className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {refreshing ? "Refreshing..." : "Refresh Data"}
        </button>
      </div>

      {/* ════════════════════════════════════════════════════════════
          2. KPI CARDS
      ════════════════════════════════════════════════════════════ */}
      <section>
        <div className="pb-5 border-b border-white/10 mb-7">
          <h2 className="text-xl font-bold text-text-primary">Platform Overview</h2>
          <p className="text-sm text-text-muted mt-1">Key metrics across the observatory platform</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          <StatCard
            delay={0.05}
            label="Total Indexed Planets"
            value={s.total_planets}
            subtext="NASA Exoplanet Archive + verified"
            accentClass="text-accent"
            bgClass="bg-accent/10"
            borderClass="border-accent/20"
            icon={
              <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <circle cx="12" cy="12" r="8" strokeWidth={1.5}/>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.5 12h19M4 7.5c3 1.5 5 4.5 5 4.5M20 7.5c-3 1.5-5 4.5-5 4.5"/>
              </svg>
            }
          />
          <StatCard
            delay={0.1}
            label="Pending Moderation"
            value={s.pending_submissions}
            subtext={s.pending_submissions > 0 ? "Requires admin action" : "Queue fully cleared"}
            accentClass={s.pending_submissions > 0 ? "text-warning" : "text-text-primary"}
            bgClass="bg-warning/10"
            borderClass="border-warning/20"
            highlight={s.pending_submissions > 0}
            icon={
              <svg className="w-5 h-5 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            }
          />
          <StatCard
            delay={0.15}
            label="User Submissions"
            value={s.user_generated}
            subtext="Candidate exoplanets proposed"
            accentClass="text-highlight"
            bgClass="bg-highlight/10"
            borderClass="border-highlight/20"
            icon={
              <svg className="w-5 h-5 text-highlight" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
            }
          />
          <StatCard
            delay={0.2}
            label="Registered Accounts"
            value={s.total_users}
            subtext="Observatory members and researchers"
            accentClass="text-primary"
            bgClass="bg-primary/10"
            borderClass="border-primary/20"
            icon={
              <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
            }
          />
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════
          3. SYSTEM STATUS + PRODUCTION MODEL
      ════════════════════════════════════════════════════════════ */}
      <section>
        <div className="pb-5 border-b border-white/10 mb-7">
          <h2 className="text-xl font-bold text-text-primary">System Status</h2>
          <p className="text-sm text-text-muted mt-1">Live infrastructure health and active ML engine details</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* System Health — 3 cols */}
          <motion.div
            className="lg:col-span-3"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.45 }}
          >
            <GlassCard padding="lg" variant="raised" hoverable={false} className="h-full flex flex-col gap-6">
              {/* Header */}
              <div className="flex items-center justify-between gap-4 pb-5 border-b border-white/8">
                <div>
                  <h3 className="text-base font-semibold text-text-primary">Infrastructure Telemetry</h3>
                  <p className="text-xs text-text-muted mt-0.5">Live availability of core backend nodes</p>
                </div>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border flex-shrink-0 ${allOk ? "bg-success/10 text-success border-success/20" : "bg-danger/10 text-danger border-danger/20"}`}>
                  <span className={`w-2 h-2 rounded-full ${allOk ? "bg-success animate-pulse" : "bg-danger"}`} />
                  {allOk ? "All Systems Nominal" : "Degraded"}
                </span>
              </div>

              {/* Service rows */}
              <div className="flex flex-col gap-1 flex-1">
                {[
                  { name: "API Application Server", desc: "Flask REST Core Service", ok: system_status.backend_online, label: system_status.backend_online ? "Operational" : "Offline" },
                  { name: "Database Engine", desc: "PostgreSQL Relational DB", ok: system_status.db_connected, label: system_status.db_connected ? "Connected" : "Unreachable" },
                  { name: "Inference Engine", desc: "Scikit-Learn ML Pipeline", ok: system_status.model_loaded, label: system_status.model_loaded ? "Model Loaded" : "Not Loaded" },
                ].map((node, i) => (
                  <div key={node.name} className={`flex items-center justify-between py-4 gap-4 ${i < 2 ? "border-b border-white/5" : ""}`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${node.ok ? "bg-success shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-danger"}`} />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-text-primary">{node.name}</p>
                        <p className="text-xs text-text-muted mt-0.5">{node.desc}</p>
                      </div>
                    </div>
                    <span className={`text-xs font-semibold px-3 py-1.5 rounded-lg border flex-shrink-0 ${node.ok ? "bg-success/8 text-success border-success/15" : "bg-danger/8 text-danger border-danger/15"}`}>
                      {node.label}
                    </span>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="pt-4 border-t border-white/8 flex flex-wrap items-center justify-between gap-3 text-xs text-text-muted">
                <span>
                  Model version:{" "}
                  <code className="font-mono text-accent bg-accent/10 px-1.5 py-0.5 rounded">{system_status.model_version || "v1.0"}</code>
                </span>
                <span className={system_status.retraining_in_progress ? "text-warning font-semibold" : ""}>
                  {system_status.retraining_in_progress ? "Retraining in progress..." : "Worker idle"}
                </span>
              </div>
            </GlassCard>
          </motion.div>

          {/* Production Model — 2 cols */}
          <motion.div
            className="lg:col-span-2"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.32, duration: 0.45 }}
          >
            <GlassCard padding="lg" variant="raised" hoverable={false} className="h-full flex flex-col gap-6">
              {/* Header */}
              <div className="pb-5 border-b border-white/8">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-base font-semibold text-text-primary">Production Model</h3>
                  <Badge variant="highlight">Active</Badge>
                </div>
                <p className="text-xs text-text-muted mt-1">Active exoplanet habitability classifier</p>
              </div>

              {current_model ? (
                <div className="flex flex-col gap-5 flex-1">
                  <div>
                    <p className="text-xs text-text-muted mb-1.5">Algorithm</p>
                    <p className="text-sm font-semibold text-text-primary font-mono">{current_model.algorithm || "Random Forest Classifier"}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/8 text-center">
                      <p className="text-xs text-text-muted mb-2">Accuracy</p>
                      <p className="text-2xl font-black font-mono text-text-primary">{(current_model.accuracy * 100).toFixed(1)}%</p>
                    </div>
                    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/8 text-center">
                      <p className="text-xs text-text-muted mb-2">F1 Score</p>
                      <p className="text-2xl font-black font-mono text-text-primary">{(current_model.f1_score * 100).toFixed(1)}%</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-0 mt-auto">
                    <div className="flex justify-between py-2.5 border-b border-white/5 text-xs">
                      <span className="text-text-muted">Training samples</span>
                      <span className="font-mono font-semibold text-text-primary">{current_model.training_samples?.toLocaleString() || "5,569"}</span>
                    </div>
                    <div className="flex justify-between py-2.5 text-xs">
                      <span className="text-text-muted">Last updated</span>
                      <span className="font-medium text-text-primary">{new Date(current_model.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-sm text-text-muted text-center">No production model currently loaded.</p>
                </div>
              )}

              <Link
                to="/admin/models"
                className="flex items-center justify-between pt-4 border-t border-white/8 text-sm font-semibold text-primary hover:text-accent transition-colors group"
              >
                <span>View Models & Benchmarks</span>
                <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </GlassCard>
          </motion.div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════
          4. ADMIN SHORTCUTS
      ════════════════════════════════════════════════════════════ */}
      <section>
        <div className="pb-5 border-b border-white/10 mb-7">
          <h2 className="text-xl font-bold text-text-primary">Admin Shortcuts</h2>
          <p className="text-sm text-text-muted mt-1">Quick access to key administrative workflows</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          {[
            {
              to: "/admin/moderation",
              title: "Submission Moderation",
              desc: s.pending_submissions > 0 ? `${s.pending_submissions} pending reviews` : "Review candidate exoplanets",
              accent: "text-warning",
              bg: "bg-warning/10",
              border: "border-warning/20",
              icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
            },
            {
              to: "/admin/training",
              title: "Retraining Pipeline",
              desc: "Trigger or schedule ML model jobs",
              accent: "text-accent",
              bg: "bg-accent/10",
              border: "border-accent/20",
              icon: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15",
            },
            {
              to: "/admin/users",
              title: "User Management",
              desc: `${s.total_users} registered accounts`,
              accent: "text-highlight",
              bg: "bg-highlight/10",
              border: "border-highlight/20",
              icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
            },
            {
              to: "/admin/logs",
              title: "Audit Logs",
              desc: "Security and operational history",
              accent: "text-primary",
              bg: "bg-primary/10",
              border: "border-primary/20",
              icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
            },
          ].map((action, i) => (
            <motion.div
              key={action.title}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.06, duration: 0.4 }}
            >
              <Link
                to={action.to}
                className="group flex items-center gap-5 p-7 rounded-2xl bg-white/[0.03] border border-white/8 hover:bg-white/[0.07] hover:border-white/15 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20 transition-all duration-200 h-full min-h-[90px]"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border ${action.bg} ${action.border} group-hover:scale-105 transition-transform`}>
                  <svg className={`w-5 h-5 ${action.accent}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={action.icon} />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-text-primary">{action.title}</p>
                  <p className="text-xs text-text-muted mt-0.5 truncate">{action.desc}</p>
                </div>
                <svg className="w-4 h-4 text-text-muted group-hover:text-text-primary group-hover:translate-x-0.5 transition-all flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════
          5. RECENT SUBMISSIONS
      ════════════════════════════════════════════════════════════ */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <div className="pb-5 border-b border-white/10 mb-7">
            <h2 className="text-xl font-bold text-text-primary">Recent Submissions</h2>
            <p className="text-sm text-text-muted mt-1">Latest candidate exoplanets proposed by observatory members</p>
          </div>
          <Link to="/admin/moderation" className="text-sm font-semibold text-primary hover:text-accent transition-colors flex items-center gap-1.5">
            View All
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        <GlassCard padding="none" variant="raised" hoverable={false}>
          {recent_submissions.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center gap-5">
              <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                <svg className="w-6 h-6 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-base font-semibold text-text-primary">No Submissions Yet</p>
                <p className="text-sm text-text-muted mt-1 max-w-sm">
                  Candidate exoplanets proposed by observatory members will appear here for review.
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/8 bg-white/[0.02]">
                    <th className="py-4 px-6 text-left text-xs font-semibold text-text-muted">Planet</th>
                    <th className="py-4 px-6 text-left text-xs font-semibold text-text-muted">Submitter</th>
                    <th className="py-4 px-6 text-right text-xs font-semibold text-text-muted">Habitability</th>
                    <th className="py-4 px-6 text-center text-xs font-semibold text-text-muted">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {recent_submissions.map((p) => (
                    <tr key={p.id} className="hover:bg-white/[0.025] transition-colors">
                      <td className="py-4 px-6 text-sm font-semibold text-text-primary">{p.planet_name}</td>
                      <td className="py-4 px-6 text-sm text-text-secondary">{p.submitter || "Anonymous"}</td>
                      <td className="py-4 px-6 text-right text-sm font-mono font-bold text-accent">
                        {p.habitability_probability != null ? `${(p.habitability_probability * 100).toFixed(1)}%` : "N/A"}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <Badge variant={p.status === "approved" ? "success" : p.status === "rejected" ? "danger" : "warning"}>
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
      </section>

    </div>
  );
}
