import { useState, useEffect } from 'react';
import { adminAPI } from '../../api/admin';
import GlassCard from '../../components/GlassCard';
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
        setReadyDatasets((resDS.data.data.datasets || []).filter(d => d.status === 'ready'));
      }
      const resStatus = await adminAPI.getRetrainingStatus();
      if (resStatus.data?.status === 'success') {
        setRetrainStatus(resStatus.data.data);
        if (resStatus.data.data.is_running) setPollingActive(true);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load training configuration.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // Polling
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
              showToast(`Training completed: ${status.last_result}`, status.last_result === 'success' ? 'success' : 'warning');
            }
          }
        } catch (err) { console.error(err); }
      }, 5000);
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
        setRetrainReason(''); setSelectedDatasetId('');
        setPollingActive(true);
        showToast('Training job started.', 'info');
        fetchData();
      } else {
        showToast(res.data?.message || 'Failed to start training.', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Error starting training.', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !retrainStatus) return <LoadingSpinner message="Loading training status..." />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary">Model Training</h1>
        <p className="text-text-secondary text-sm mt-1">Configure and trigger model retraining jobs.</p>
      </div>

      {/* Status */}
      {retrainStatus && (
        <GlassCard padding="md">
          <h3 className="font-semibold text-sm uppercase tracking-wider text-text-muted mb-4">Current Status</h3>
          <div className="flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-sm text-text-secondary">Status:</span>
              {retrainStatus.is_running ? (
                <Badge variant="warning" dot>Training in Progress</Badge>
              ) : (
                <Badge variant="success" dot>Idle</Badge>
              )}
            </div>
            {retrainStatus.last_result && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-text-secondary">Last Result:</span>
                <Badge variant={retrainStatus.last_result === 'success' ? 'success' : 'danger'}>
                  {retrainStatus.last_result}
                </Badge>
              </div>
            )}
            {retrainStatus.last_completed_at && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-text-secondary">Last Completed:</span>
                <span className="text-sm text-text-primary">{new Date(retrainStatus.last_completed_at).toLocaleString()}</span>
              </div>
            )}
          </div>
        </GlassCard>
      )}

      {/* Trigger Form */}
      <GlassCard padding="md">
        <h3 className="font-semibold text-sm uppercase tracking-wider text-text-muted mb-4">Start New Training</h3>
        <form onSubmit={handleStartRetraining} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col">
              <label htmlFor="training-dataset">Dataset (optional)</label>
              <select id="training-dataset" value={selectedDatasetId} onChange={(e) => setSelectedDatasetId(e.target.value)}>
                <option value="">Use default dataset</option>
                {readyDatasets.map(ds => (
                  <option key={ds.id} value={ds.id}>{ds.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col">
              <label htmlFor="training-reason">Reason (optional)</label>
              <input type="text" id="training-reason" value={retrainReason} onChange={(e) => setRetrainReason(e.target.value)} placeholder="e.g. New data added" />
            </div>
          </div>
          <Button type="submit" loading={loading || retrainStatus?.is_running} disabled={retrainStatus?.is_running} className="self-start">
            {retrainStatus?.is_running ? 'Training in Progress...' : 'Start Training'}
          </Button>
        </form>
      </GlassCard>
    </div>
  );
}
