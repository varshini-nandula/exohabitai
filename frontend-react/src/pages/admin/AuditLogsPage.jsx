import { useState, useEffect } from 'react';
import { adminAPI } from '../../api/admin';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorState from '../../components/ErrorState';
import Badge from '../../components/ui/Badge';

export default function AuditLogsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [logs, setLogs] = useState([]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await adminAPI.getRetrainingLogs(50);
      if (res.data?.status === 'success') {
        setLogs(res.data.data.logs || []);
      } else {
        setError(res.data?.message || 'Failed to load audit logs.');
      }
    } catch (err) {
      console.error(err);
      setError('Error fetching audit logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  if (loading) {
    return (
      <div className="py-20 flex justify-center">
        <LoadingSpinner message="Querying system telemetry audit log records..." />
      </div>
    );
  }

  if (error) return <ErrorState message={error} onRetry={fetchLogs} />;

  return (
    <div className="space-y-10">
      {/* ── Page Header ────────────────────────────────────────── */}
      <div className="border-b border-white/10 pb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-text-primary">
            System & Audit Logs
          </h1>
          <p className="text-text-secondary text-sm sm:text-base leading-relaxed max-w-2xl">
            Activity audit records for retraining executions, moderation decisions, and operational events.
          </p>
        </div>

        <button
          onClick={fetchLogs}
          className="self-start sm:self-auto flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-[#0f224a] hover:bg-[#183674] text-[#38bdf8] hover:text-white border border-[#38bdf8]/50 hover:border-[#38bdf8] text-xs font-semibold shadow-md shadow-[#38bdf8]/15 hover:shadow-[#38bdf8]/30 transition-all duration-200 active:scale-95 cursor-pointer"
        >
          <svg className="w-4 h-4 text-[#38bdf8] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span className="font-semibold tracking-wide">Refresh Logs</span>
        </button>
      </div>

      {/* ── Table Content ──────────────────────────────────────── */}
      <div className="p-6 rounded-2xl bg-space-900/60 border border-white/10 backdrop-blur-md">
        <div className="pb-4 mb-4 border-b border-white/5 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base text-text-primary">Audit Event Journal</h3>
            <p className="text-xs text-text-muted mt-0.5">Showing last 50 operational journal events</p>
          </div>
          <span className="text-xs font-mono text-text-muted">{logs.length} events logged</span>
        </div>

        {logs.length === 0 ? (
          <div className="p-12 text-center text-text-secondary text-sm">
            No system audit logs found on record.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/5">
            <table className="data-table w-full">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02]">
                  <th className="py-3.5 px-4 text-left text-xs font-bold uppercase tracking-wider text-text-muted">Timestamp</th>
                  <th className="py-3.5 px-4 text-left text-xs font-bold uppercase tracking-wider text-text-muted">Action / Event</th>
                  <th className="py-3.5 px-4 text-center text-xs font-bold uppercase tracking-wider text-text-muted">Status</th>
                  <th className="py-3.5 px-4 text-left text-xs font-bold uppercase tracking-wider text-text-muted">Triggered By</th>
                  <th className="py-3.5 px-4 text-left text-xs font-bold uppercase tracking-wider text-text-muted">Details & Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {logs.map((log, i) => (
                  <tr key={log.id || i} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-4 px-4 text-text-muted text-xs font-mono whitespace-nowrap">
                      {log.timestamp || log.created_at ? new Date(log.timestamp || log.created_at).toLocaleString() : '—'}
                    </td>
                    <td className="py-4 px-4 font-bold text-text-primary text-sm font-mono">
                      {log.action || log.event_type || (log.model_version ? `Model Retrain (${log.model_version})` : 'Model Retraining')}
                    </td>
                    <td className="py-4 px-4 text-center">
                      <Badge
                        variant={
                          log.status === 'success'
                            ? 'success'
                            : log.status === 'failed'
                              ? 'danger'
                              : 'neutral'
                        }
                      >
                        {log.status || 'INFO'}
                      </Badge>
                    </td>
                    <td className="py-4 px-4 text-text-secondary text-sm">
                      {log.requested_by || log.triggered_by || log.user || 'system'}
                    </td>
                    <td className="py-4 px-4 text-text-muted text-xs max-w-md">
                      {log.reason || log.details || log.notes || (
                        log.accuracy != null
                          ? `Acc: ${(log.accuracy * 100).toFixed(1)}% | F1: ${(log.f1_score * 100).toFixed(1)}% | Dataset: ${log.dataset_size || 'N/A'}`
                          : '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
