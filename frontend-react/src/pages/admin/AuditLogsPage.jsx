import { useState, useEffect } from 'react';
import { adminAPI } from '../../api/admin';
import GlassCard from '../../components/GlassCard';
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
        setLogs(res.data.data.logs);
      } else {
        setError(res.data?.message || 'Failed to load logs.');
      }
    } catch (err) {
      console.error(err);
      setError('Error fetching audit logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLogs(); }, []);

  if (loading) return <LoadingSpinner message="Loading audit logs..." />;
  if (error) return <ErrorState message={error} onRetry={fetchLogs} />;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary">Audit Logs</h1>
        <p className="text-text-secondary text-sm mt-1">Training and system event log history.</p>
      </div>

      {logs.length === 0 ? (
        <GlassCard padding="md" className="text-center text-text-secondary text-sm">
          No audit logs found.
        </GlassCard>
      ) : (
        <GlassCard padding="sm" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Action</th>
                  <th>Status</th>
                  <th>Triggered By</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, i) => (
                  <tr key={log.id || i}>
                    <td className="text-text-muted text-xs whitespace-nowrap">
                      {log.created_at ? new Date(log.created_at).toLocaleString() : '—'}
                    </td>
                    <td className="primary-cell">{log.action || log.event_type || '—'}</td>
                    <td>
                      <Badge variant={log.status === 'success' ? 'success' : log.status === 'failed' ? 'danger' : 'neutral'}>
                        {log.status || '—'}
                      </Badge>
                    </td>
                    <td className="text-text-secondary">{log.triggered_by || log.user || '—'}</td>
                    <td className="text-text-muted text-xs max-w-xs truncate">{log.details || log.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
