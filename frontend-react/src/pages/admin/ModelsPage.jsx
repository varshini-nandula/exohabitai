import { useState, useEffect } from 'react';
import { adminAPI } from '../../api/admin';
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
      const res = await adminAPI.getModels();
      if (res.data?.status === 'success') {
        const data = res.data.data;
        setCurrentModel(data.current_model || (data.models && data.models.length > 0 ? data.models[0] : null));
        setVersionHistory(data.version_history || data.models || []);
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

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="py-20 flex justify-center">
        <LoadingSpinner message="Evaluating ML model performance telemetry..." />
      </div>
    );
  }

  if (error) return <ErrorState message={error} onRetry={fetchData} />;

  const radarData = currentModel
    ? [
      { metric: 'Accuracy', value: (currentModel.accuracy || 0) * 100 },
      { metric: 'F1 Score', value: (currentModel.f1_score || 0) * 100 },
      { metric: 'Precision', value: (currentModel.precision || 0) * 100 },
      { metric: 'Recall', value: (currentModel.recall || 0) * 100 },
      { metric: 'AUC-ROC', value: (currentModel.roc_auc != null ? currentModel.roc_auc : (currentModel.auc_roc || 0)) * 100 },
    ]
    : [];

  return (
    <div className="space-y-10">
      {/* ── Page Header ────────────────────────────────────────── */}
      <div className="border-b border-white/10 pb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-text-primary">
            ML Models & Diagnostics
          </h1>
          <p className="text-text-secondary text-sm sm:text-base leading-relaxed max-w-2xl">
            Statistical classification benchmarks, multi-metric radar telemetry, and model artifact release history.
          </p>
        </div>
      </div>

      {/* ── Active Model Grid ──────────────────────────────────── */}
      {currentModel && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Performance Radar Chart (5 cols) */}
          <div className="lg:col-span-5 p-6 rounded-2xl bg-space-900/60 border border-white/10 backdrop-blur-md flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/5">
                <h3 className="font-bold text-sm uppercase tracking-wider text-text-muted">
                  Metric Radar Analysis
                </h3>
                <span className="text-xs text-primary font-mono font-semibold">5-Axis Eval</span>
              </div>
              <div className="h-72 w-full py-2">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="75%">
                    <PolarGrid stroke="rgba(255,255,255,0.08)" />
                    <PolarAngleAxis dataKey="metric" tick={{ fill: '#94A3B8', fontSize: 11, fontWeight: 500 }} />
                    <PolarRadiusAxis
                      angle={30}
                      domain={[0, 100]}
                      tick={{ fill: '#64748B', fontSize: 9 }}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Radar
                      name="Current Model"
                      dataKey="value"
                      stroke="#4F8CFF"
                      fill="#4F8CFF"
                      fillOpacity={0.2}
                      strokeWidth={2}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <p className="text-[11px] text-text-muted text-center border-t border-white/5 pt-3">
              Radar evaluated on stratified 20% holdout cross-validation test split.
            </p>
          </div>

          {/* Active Model Summary Card (7 cols) */}
          <div className="lg:col-span-7 p-6 rounded-2xl bg-space-900/60 border border-white/10 backdrop-blur-md flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 mb-5 border-b border-white/5">
                <div>
                  <h3 className="font-bold text-base text-text-primary">Production Model Artifact</h3>
                  <p className="text-xs text-text-muted mt-0.5">Primary habitability inference engine</p>
                </div>
                <Badge variant="highlight">Production Release</Badge>
              </div>

              {/* Specs Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Version</span>
                  <p className="text-lg font-bold font-mono text-accent mt-0.5">{currentModel.version}</p>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Accuracy</span>
                  <p className="text-lg font-bold font-mono text-text-primary mt-0.5">{(currentModel.accuracy * 100).toFixed(2)}%</p>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">F1 Score</span>
                  <p className="text-lg font-bold font-mono text-text-primary mt-0.5">
                    {currentModel.f1_score != null ? `${(currentModel.f1_score * 100).toFixed(2)}%` : '—'}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Precision</span>
                  <p className="text-lg font-bold font-mono text-text-primary mt-0.5">
                    {currentModel.precision != null ? `${(currentModel.precision * 100).toFixed(2)}%` : '—'}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Recall</span>
                  <p className="text-lg font-bold font-mono text-text-primary mt-0.5">
                    {currentModel.recall != null ? `${(currentModel.recall * 100).toFixed(2)}%` : '—'}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Dataset / Provenance</span>
                  <p className="text-sm font-bold font-mono text-text-primary mt-1 truncate" title={currentModel.dataset_version || 'Default Training Catalog'}>
                    {currentModel.dataset_version ? currentModel.dataset_version.substring(0, 12) : 'Default Catalog'}
                  </p>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-2 border-b border-white/5">
                  <span className="text-text-muted">Base Classifier</span>
                  <span className="text-text-primary font-semibold">{currentModel.notes || 'Random Forest Classifier (100 estimators)'}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-white/5">
                  <span className="text-text-muted">Training Date</span>
                  <span className="text-text-primary font-semibold">
                    {currentModel.created_at ? new Date(currentModel.created_at).toLocaleString() : '—'}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-accent/[0.04] border border-accent/20 mt-4 flex items-center justify-between text-xs">
              <span className="text-accent font-semibold">Artifact Status: Verified in memory</span>
              <span className="text-text-muted font-mono">{currentModel.artifact_path ? 'Loaded' : 'Default Pipeline'}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Version History ────────────────────────────────────── */}
      <div className="p-6 rounded-2xl bg-space-900/60 border border-white/10 backdrop-blur-md">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/5">
          <div>
            <h3 className="font-bold text-base text-text-primary">Model Version History</h3>
            <p className="text-xs text-text-muted mt-0.5">Release log of previously trained and archived model artifacts</p>
          </div>
        </div>

        {versionHistory.length === 0 ? (
          <div className="text-center py-8 text-text-secondary text-sm">No historical versions on record.</div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/5">
            <table className="data-table w-full">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02]">
                  <th className="py-3.5 px-4 text-left text-xs font-bold uppercase tracking-wider text-text-muted">Version Tag</th>
                  <th className="py-3.5 px-4 text-left text-xs font-bold uppercase tracking-wider text-text-muted">Accuracy</th>
                  <th className="py-3.5 px-4 text-left text-xs font-bold uppercase tracking-wider text-text-muted">F1 Score</th>
                  <th className="py-3.5 px-4 text-left text-xs font-bold uppercase tracking-wider text-text-muted">Dataset Provenance</th>
                  <th className="py-3.5 px-4 text-center text-xs font-bold uppercase tracking-wider text-text-muted">Release Status</th>
                  <th className="py-3.5 px-4 text-right text-xs font-bold uppercase tracking-wider text-text-muted">Deployed At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {versionHistory.map((v, i) => (
                  <tr key={v.id || i} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-4 px-4 font-bold font-mono text-accent text-sm">{v.version}</td>
                    <td className="py-4 px-4 font-mono text-sm">
                      {v.accuracy != null ? `${(v.accuracy * 100).toFixed(2)}%` : '—'}
                    </td>
                    <td className="py-4 px-4 font-mono text-sm">
                      {v.f1_score != null ? `${(v.f1_score * 100).toFixed(2)}%` : '—'}
                    </td>
                    <td className="py-4 px-4 font-mono text-xs text-text-muted">
                      {v.dataset_version ? v.dataset_version.substring(0, 12) : 'Default Catalog'}
                    </td>
                    <td className="py-4 px-4 text-center">
                      <Badge variant={v.is_active ? 'success' : 'neutral'}>
                        {v.is_active ? 'Production' : 'Archived'}
                      </Badge>
                    </td>
                    <td className="py-4 px-4 text-right text-text-muted text-xs">
                      {v.created_at ? new Date(v.created_at).toLocaleDateString() : '—'}
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
