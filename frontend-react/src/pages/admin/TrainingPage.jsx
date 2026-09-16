import { useState, useEffect } from 'react';
import { adminAPI } from '../../api/admin';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorState from '../../components/ErrorState';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { useToast } from '../../context/ToastContext';

export default function TrainingPage() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [readyDatasets, setReadyDatasets] = useState([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState('');
  const [retrainReason, setRetrainReason] = useState('');
  const [retrainStatus, setRetrainStatus] = useState(null);
  const [pollingActive, setPollingActive] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const resDS = await adminAPI.getDatasets();
      if (resDS.data?.status === 'success') {
        setReadyDatasets((resDS.data.data.datasets || []).filter((d) => d.status === 'ready'));
      }
      const resStatus = await adminAPI.getRetrainingStatus();
      if (resStatus.data?.status === 'success') {
        setRetrainStatus(resStatus.data.data);
        if (resStatus.data.data.is_running) setPollingActive(true);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load training configuration telemetry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Polling during training run
  useEffect(() => {
    let poller;
    if (pollingActive) {
      poller = setInterval(async () => {
        try {
          const res = await adminAPI.getRetrainingStatus();
          if (res.data?.status === 'success') {
            const status = res.data.data;
            setRetrainStatus(status);
            if (!status.is_running) {
              setPollingActive(false);
              clearInterval(poller);
              showToast(
                `Model training job finished: ${status.last_result}`,
                status.last_result === 'success' ? 'success' : 'warning'
              );
            }
          }
        } catch (err) {
          console.error(err);
        }
      }, 4000);
    }
    return () => clearInterval(poller);
  }, [pollingActive, showToast]);

  const handleStartRetraining = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const dsId = selectedDatasetId ? parseInt(selectedDatasetId) : null;
      const res = await adminAPI.startRetraining(dsId, retrainReason);
      if (res.data?.status === 'accepted') {
        setRetrainReason('');
        setSelectedDatasetId('');
        setPollingActive(true);
        showToast('Model retraining job dispatched to background worker.', 'info');
        fetchData();
      } else {
        showToast(res.data?.message || 'Failed to start retraining job.', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Error triggering retraining job.', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !retrainStatus) {
    return (
      <div className="py-20 flex justify-center">
        <LoadingSpinner message="Checking ML training worker state..." />
      </div>
    );
  }

  if (error) return <ErrorState message={error} onRetry={fetchData} />;

  return (
    <div className="space-y-10">
      {/* ── Page Header ────────────────────────────────────────── */}
      <div className="border-b border-white/10 pb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-text-primary">
            Model Retraining Pipeline
          </h1>
          <p className="text-text-secondary text-sm sm:text-base leading-relaxed max-w-2xl">
            Trigger asynchronous machine learning training runs on verified exoplanet catalogs.
          </p>
        </div>
      </div>

      {/* ── Worker Status Card ─────────────────────────────────── */}
      {retrainStatus && (
        <div className="p-6 rounded-2xl bg-space-900/60 border border-white/10 backdrop-blur-md">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/5">
            <div>
              <h3 className="font-bold text-base text-text-primary">Training Worker Engine</h3>
              <p className="text-xs text-text-muted mt-0.5">Background scikit-learn training process telemetry</p>
            </div>
            <Badge
              variant={retrainStatus.is_running ? 'warning' : 'success'}
              dot
            >
              {retrainStatus.is_running ? 'Training in Progress' : 'Worker Standby'}
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
              <span className="text-xs font-bold uppercase tracking-wider text-text-muted">Current State</span>
              <p className="text-base font-bold text-text-primary mt-1">
                {retrainStatus.is_running ? (
                  <span className="text-warning flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-warning animate-pulse" />
                    Executing Job...
                  </span>
                ) : (
                  <span className="text-success">Idle / Ready</span>
                )}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
              <span className="text-xs font-bold uppercase tracking-wider text-text-muted">Last Job Outcome</span>
              <div className="mt-1">
                {retrainStatus.last_result ? (
                  <Badge variant={retrainStatus.last_result === 'success' ? 'success' : 'danger'}>
                    {retrainStatus.last_result.toUpperCase()}
                  </Badge>
                ) : (
                  <span className="text-text-muted text-sm">—</span>
                )}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
              <span className="text-xs font-bold uppercase tracking-wider text-text-muted">Last Completed</span>
              <p className="text-sm font-semibold text-text-primary mt-1">
                {retrainStatus.last_completed || retrainStatus.last_completed_at
                  ? new Date(retrainStatus.last_completed || retrainStatus.last_completed_at).toLocaleString()
                  : 'No prior runs'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Retraining Configuration Form ──────────────────────── */}
      <div className="p-6 rounded-2xl bg-space-900/60 border border-white/10 backdrop-blur-md">
        <div className="pb-4 mb-5 border-b border-white/5">
          <h3 className="font-bold text-base text-text-primary">Dispatch New Training Job</h3>
          <p className="text-xs text-text-muted mt-0.5">Select an ingested training dataset and trigger model retraining</p>
        </div>

        <form onSubmit={handleStartRetraining} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label htmlFor="training-dataset" className="text-xs font-bold uppercase tracking-wider text-text-muted">
                Training Dataset Selection
              </label>
              <select
                id="training-dataset"
                value={selectedDatasetId}
                onChange={(e) => setSelectedDatasetId(e.target.value)}
                className="w-full text-sm py-3 px-4 rounded-xl bg-space-900/80 border border-white/10 focus:border-primary/50 text-text-primary"
              >
                <option value="">Default Baseline Dataset (5,569 rows)</option>
                {readyDatasets.map((ds) => (
                  <option key={ds.id} value={ds.id}>
                    {ds.name} ({ds.row_count || 'N/A'} rows)
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="training-reason" className="text-xs font-bold uppercase tracking-wider text-text-muted">
                Trigger Reason / Changelog Note
              </label>
              <input
                type="text"
                id="training-reason"
                value={retrainReason}
                onChange={(e) => setRetrainReason(e.target.value)}
                placeholder="e.g. Ingested Kepler DR25 validated exoplanets"
                className="w-full text-sm py-3 px-4 rounded-xl bg-space-900/80 border border-white/10 focus:border-primary/50 text-text-primary placeholder:text-text-muted"
              />
            </div>
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              loading={loading || retrainStatus?.is_running}
              disabled={retrainStatus?.is_running}
              className="px-6 py-3"
            >
              {retrainStatus?.is_running ? 'Training in Progress...' : 'Start Model Retraining'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
