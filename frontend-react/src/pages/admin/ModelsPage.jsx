import { useState, useEffect } from 'react';
import { adminAPI } from '../../api/admin';
import GlassCard from '../../components/GlassCard';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorState from '../../components/ErrorState';
import Badge from '../../components/ui/Badge';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
} from 'recharts';

export default function ModelsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentModel, setCurrentModel] = useState(null);
  const [versionHistory, setVersionHistory] = useState([]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await adminAPI.getModelInfo();
      if (res.data?.status === 'success') {
        setCurrentModel(res.data.data.current_model);
        setVersionHistory(res.data.data.version_history || []);
      } else {
        setError(res.data?.message || 'Failed to load model data.');
      }
    } catch (err) {
      console.error(err);
      setError('Error loading model data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  if (loading) return <LoadingSpinner message="Loading model data..." />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;

  const radarData = currentModel ? [
    { metric: 'Accuracy', value: (currentModel.accuracy || 0) * 100 },
    { metric: 'F1 Score', value: (currentModel.f1_score || 0) * 100 },
    { metric: 'Precision', value: (currentModel.precision || 0) * 100 },
    { metric: 'Recall', value: (currentModel.recall || 0) * 100 },
    { metric: 'AUC-ROC', value: (currentModel.auc_roc || 0) * 100 },
  ] : [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary">ML Models</h1>
        <p className="text-text-secondary text-sm mt-1">Current model performance and version history.</p>
      </div>

      {/* Current Model Details */}
      {currentModel && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Radar Chart */}
          <GlassCard padding="md">
            <h3 className="font-semibold text-sm uppercase tracking-wider text-text-muted mb-4">Model Performance</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="75%">
                  <PolarGrid stroke="rgba(255,255,255,0.08)" />
                  <PolarAngleAxis dataKey="metric" tick={{ fill: '#94A3B8', fontSize: 12 }} />
                  <PolarRadiusAxis
                    angle={30}
                    domain={[0, 100]}
                    tick={{ fill: '#64748B', fontSize: 10 }}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Radar
                    name="Current Model"
                    dataKey="value"
                    stroke="#4F8CFF"
                    fill="#4F8CFF"
                    fillOpacity={0.15}
                    strokeWidth={2}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>

          {/* Model Info */}
          <GlassCard padding="md">
            <h3 className="font-semibold text-sm uppercase tracking-wider text-text-muted mb-4">Active Model</h3>
            <div className="space-y-4 text-sm">
              <div className="flex justify-between border-b border-white/5 pb-3">
                <span className="text-text-secondary">Version</span>
                <span className="font-bold text-accent">{currentModel.version}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-3">
                <span className="text-text-secondary">Algorithm</span>
                <span className="font-semibold">{currentModel.algorithm || 'Random Forest'}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-3">
                <span className="text-text-secondary">Training Samples</span>
                <span className="font-semibold">{currentModel.training_samples?.toLocaleString() || '—'}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-3">
                <span className="text-text-secondary">Accuracy</span>
                <span className="font-semibold">{(currentModel.accuracy * 100).toFixed(2)}%</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-3">
                <span className="text-text-secondary">F1 Score</span>
                <span className="font-semibold">{(currentModel.f1_score * 100).toFixed(2)}%</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-3">
                <span className="text-text-secondary">Precision</span>
                <span className="font-semibold">{((currentModel.precision || 0) * 100).toFixed(2)}%</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-3">
                <span className="text-text-secondary">Recall</span>
                <span className="font-semibold">{((currentModel.recall || 0) * 100).toFixed(2)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Created</span>
                <span className="text-text-primary">{currentModel.created_at ? new Date(currentModel.created_at).toLocaleDateString() : '—'}</span>
              </div>
            </div>
          </GlassCard>
        </div>
      )}

      {/* Version History */}
      <GlassCard padding="sm" className="overflow-hidden">
        <div className="p-4 pb-0">
          <h3 className="font-semibold text-sm uppercase tracking-wider text-text-muted mb-4">Version History</h3>
        </div>
        {versionHistory.length === 0 ? (
          <div className="text-center py-8 text-text-secondary text-sm">No version history available.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Version</th>
                  <th>Accuracy</th>
                  <th>F1 Score</th>
                  <th>Samples</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {versionHistory.map((v, i) => (
                  <tr key={v.id || i}>
                    <td className="primary-cell font-mono">{v.version}</td>
                    <td>{v.accuracy != null ? `${(v.accuracy * 100).toFixed(2)}%` : '—'}</td>
                    <td>{v.f1_score != null ? `${(v.f1_score * 100).toFixed(2)}%` : '—'}</td>
                    <td>{v.training_samples?.toLocaleString() || '—'}</td>
                    <td>
                      <Badge variant={v.is_active ? 'success' : 'neutral'}>
                        {v.is_active ? 'Active' : 'Archived'}
                      </Badge>
                    </td>
                    <td className="text-text-muted text-xs">{v.created_at ? new Date(v.created_at).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
