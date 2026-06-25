import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { adminAPI } from '../../api/admin';
import GlassCard from '../../components/GlassCard';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorState from '../../components/ErrorState';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip, Legend, Bar } from 'recharts';

export default function ModelsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'current';
  const [activeTab, setActiveTab] = useState(initialTab);

  // Shared states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Tab: Current Model
  const [activeModel, setActiveModel] = useState(null);

  // Tab: Version History
  const [models, setModels] = useState([]);
  const [compareModelA, setCompareModelA] = useState('');
  const [compareModelB, setCompareModelB] = useState('');

  // Tab: Datasets
  const [datasets, setDatasets] = useState([]);
  const [uploadName, setUploadName] = useState('');
  const [uploadNotes, setUploadNotes] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [expandedDatasetId, setExpandedDatasetId] = useState(null);

  // Tab: Retraining
  const [readyDatasets, setReadyDatasets] = useState([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState('');
  const [retrainReason, setRetrainReason] = useState('');
  const [retrainStatus, setRetrainStatus] = useState(null);
  const [pollingActive, setPollingActive] = useState(false);

  // Tab: Logs
  const [logs, setLogs] = useState([]);

  // URL query synchronizer
  useEffect(() => {
    setSearchParams({ tab: activeTab });
    setError(null);
    fetchTabData();
  }, [activeTab]);

  const fetchTabData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'current') {
        const res = await adminAPI.getActiveModel();
        if (res.data?.status === 'success') {
          setActiveModel(res.data.data.model);
        }
      } else if (activeTab === 'history') {
        const res = await adminAPI.getModels();
        if (res.data?.status === 'success') {
          setModels(res.data.data.models);
        }
      } else if (activeTab === 'datasets') {
        const res = await adminAPI.getDatasets();
        if (res.data?.status === 'success') {
          setDatasets(res.data.data.datasets || []);
        }
      } else if (activeTab === 'retraining') {
        const resDS = await adminAPI.getDatasets();
        if (resDS.data?.status === 'success') {
          const ready = (resDS.data.data.datasets || []).filter(d => d.status === 'ready');
          setReadyDatasets(ready);
        }
        const resStatus = await adminAPI.getRetrainingStatus();
        if (resStatus.data?.status === 'success') {
          setRetrainStatus(resStatus.data.data);
          if (resStatus.data.data.is_running) {
            setPollingActive(true);
          }
        }
      } else if (activeTab === 'logs') {
        const res = await adminAPI.getRetrainingLogs(50);
        if (res.data?.status === 'success') {
          setLogs(res.data.data.logs);
        }
      }
    } catch (err) {
      console.error(err);
      setError('Failed to fetch data for this section. Please confirm admin credentials.');
    } finally {
      setLoading(false);
    }
  };

  // Status Poller
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
              // alert to user
              alert(`Retraining completed with status: ${status.last_result}`);
            }
          }
        } catch (err) {
          console.error(err);
        }
      }, 5000);
    }
    return () => clearInterval(poller);
  }, [pollingActive]);

  // Dataset uploads
  const handleUploadDataset = async (e) => {
    e.preventDefault();
    if (!uploadFile) {
      alert('Select a CSV file first.');
      return;
    }

    const formData = new FormData();
    formData.append('file', uploadFile);
    formData.append('name', uploadName);
    formData.append('notes', uploadNotes);

    try {
      setLoading(true);
      const res = await adminAPI.uploadDataset(formData);
      if (res.data?.status === 'success') {
        setUploadName('');
        setUploadNotes('');
        setUploadFile(null);
        // Clear input element
        document.getElementById('dataset-file-input').value = '';
        fetchTabData();
      } else {
        alert(res.data?.message || 'Upload failed.');
      }
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Error uploading dataset.');
    } finally {
      setLoading(false);
    }
  };

  const handleValidateDataset = async (id) => {
    try {
      setLoading(true);
      const res = await adminAPI.validateDataset(id);
      if (res.data?.status === 'success') {
        fetchTabData();
      } else {
        alert(res.data?.message || 'Validation trigger failed.');
      }
    } catch (err) {
      console.error(err);
      alert('Error triggering validation engine.');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkDatasetReady = async (id) => {
    try {
      setLoading(true);
      const res = await adminAPI.markDatasetReady(id);
      if (res.data?.status === 'success') {
        fetchTabData();
      } else {
        alert(res.data?.message || 'Action failed.');
      }
    } catch (err) {
      console.error(err);
      alert('Error marking dataset as ready.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDataset = async (id) => {
    if (!confirm('Are you sure you want to delete this dataset? The CSV file will be permanently removed.')) {
      return;
    }
    try {
      setLoading(true);
      const res = await adminAPI.deleteDataset(id);
      if (res.data?.status === 'success') {
        fetchTabData();
        if (expandedDatasetId === id) setExpandedDatasetId(null);
      } else {
        alert(res.data?.message || 'Delete action failed.');
      }
    } catch (err) {
      console.error(err);
      alert('Error deleting dataset.');
    } finally {
      setLoading(false);
    }
  };

  // Trigger retraining
  const handleStartRetraining = async (e) => {
    e.preventDefault();
    if (!confirm('Are you sure you want to trigger retraining? This is a computationally intensive process.')) {
      return;
    }

    try {
      setLoading(true);
      const dsId = selectedDatasetId ? parseInt(selectedDatasetId) : null;
      const res = await adminAPI.startRetraining(dsId, retrainReason);
      if (res.data?.status === 'accepted') {
        setRetrainReason('');
        setSelectedDatasetId('');
        setPollingActive(true);
        fetchTabData();
      } else {
        alert(res.data?.message || 'Retraining start failed.');
      }
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Error triggering retraining.');
    } finally {
      setLoading(false);
    }
  };

  // Metrics formatter for Recharts
  const formatRadarData = (model) => {
    if (!model) return [];
    return [
      { subject: 'F1 Score', value: model.f1_score * 100 },
      { subject: 'Accuracy', value: model.accuracy * 100 },
      { subject: 'Precision', value: (model.precision || model.f1_score) * 100 },
      { subject: 'Recall', value: (model.recall || model.f1_score) * 100 },
      { subject: 'ROC AUC', value: (model.roc_auc || 0.5) * 100 },
      { subject: 'PR AUC', value: (model.pr_auc || 0.5) * 100 },
    ];
  };

  const getComparisonData = () => {
    const modelA = models.find(m => m.version === compareModelA);
    const modelB = models.find(m => m.version === compareModelB);
    if (!modelA || !modelB) return [];

    return [
      { name: 'F1 Score', [compareModelA]: modelA.f1_score, [compareModelB]: modelB.f1_score },
      { name: 'Accuracy', [compareModelA]: modelA.accuracy, [compareModelB]: modelB.accuracy },
      { name: 'ROC AUC', [compareModelA]: modelA.roc_auc || 0.5, [compareModelB]: modelB.roc_auc || 0.5 },
      { name: 'PR AUC', [compareModelA]: modelA.pr_auc || 0.5, [compareModelB]: modelB.pr_auc || 0.5 },
    ];
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent font-mono">
          MODEL REGISTRY & retraining
        </h1>
        <p className="text-text-secondary font-mono text-sm mt-1">
          Monitor performance metrics, manage semantic version histories, upload datasets, and trigger retraining.
        </p>
      </div>

      {/* Tabs Menu */}
      <div className="flex flex-wrap gap-2 border-b border-white/5 pb-px font-mono text-sm">
        {[
          { id: 'current', name: 'Current Model' },
          { id: 'history', name: 'Version History' },
          { id: 'datasets', name: 'Training Datasets' },
          { id: 'retraining', name: 'Retraining Control' },
          { id: 'logs', name: 'Audit Logs' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`pb-3 px-4 font-semibold border-b-2 uppercase transition-all ${
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            {tab.name}
          </button>
        ))}
      </div>

      {/* Error and Loading indicators */}
      {error && <ErrorState message={error} onRetry={fetchTabData} />}

      {/* Active Tab Panels */}

      {/* 1. CURRENT MODEL TAB */}
      {activeTab === 'current' && !error && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Metrics Radar Chart */}
          <GlassCard className="p-6">
            <h3 className="font-bold font-mono text-sm tracking-wider uppercase text-text-muted mb-6">
              Telemetry Performance Radar
            </h3>
            {activeModel ? (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="80%" data={formatRadarData(activeModel)}>
                    <PolarGrid stroke="rgba(255,255,255,0.08)" />
                    <PolarAngleAxis dataKey="subject" stroke="#94A3B8" fontSize={11} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#64748B" />
                    <Radar
                      name={activeModel.version}
                      dataKey="value"
                      stroke="#4F8CFF"
                      fill="#4F8CFF"
                      fillOpacity={0.25}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex items-center justify-center h-72 text-sm text-text-secondary font-mono">
                No active model telemetry available.
              </div>
            )}
          </GlassCard>

          {/* Model info details */}
          <GlassCard className="p-6 space-y-6">
            <h3 className="font-bold font-mono text-sm tracking-wider uppercase text-text-muted border-b border-white/5 pb-2">
              Model Metadata Specs
            </h3>

            {activeModel ? (
              <div className="space-y-4 font-mono text-sm">
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-text-secondary">Semantic Version:</span>
                  <span className="text-text-primary font-bold text-accent">{activeModel.version}</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-text-secondary">Artifact File Path:</span>
                  <span className="text-text-primary text-xs max-w-xs text-right break-all">{activeModel.artifact_path}</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-text-secondary">F1 Score (Performance Gate):</span>
                  <span className="text-text-primary font-semibold">{(activeModel.f1_score * 100).toFixed(2)}%</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-text-secondary">Accuracy Score:</span>
                  <span className="text-text-primary font-semibold">{(activeModel.accuracy * 100).toFixed(2)}%</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-text-secondary">Seeded/Triggered By:</span>
                  <span className="text-text-primary uppercase">{activeModel.created_by}</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-text-secondary">Genesis Date:</span>
                  <span className="text-text-primary">{new Date(activeModel.created_at).toLocaleString()}</span>
                </div>
                {activeModel.notes && (
                  <div className="pt-2">
                    <span className="text-text-secondary block mb-1">Release Notes:</span>
                    <p className="text-xs text-text-primary bg-white/5 p-3 rounded-lg border border-white/5">
                      {activeModel.notes}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-text-secondary py-4 font-mono text-center">
                No active model metrics available.
              </div>
            )}
          </GlassCard>
        </div>
      )}

      {/* 2. VERSION HISTORY TAB */}
      {activeTab === 'history' && !error && (
        <div className="space-y-8">
          {/* Comparison tool */}
          {models.length >= 2 && (
            <GlassCard className="p-6">
              <h3 className="font-bold font-mono text-sm tracking-wider uppercase text-text-muted border-b border-white/5 pb-2 mb-6">
                Metrics Comparison Visualizer
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                <div className="flex gap-4 font-mono text-sm">
                  <div className="flex flex-col gap-1.5 flex-grow">
                    <span className="text-text-secondary text-xs">Model A:</span>
                    <select
                      value={compareModelA}
                      onChange={(e) => setCompareModelA(e.target.value)}
                      className="bg-space-900 border border-white/10 text-text-primary rounded px-3 py-2 focus:outline-none"
                    >
                      <option value="">Select version...</option>
                      {models.map(m => (
                        <option key={m.version} value={m.version}>{m.version}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5 flex-grow">
                    <span className="text-text-secondary text-xs">Model B:</span>
                    <select
                      value={compareModelB}
                      onChange={(e) => setCompareModelB(e.target.value)}
                      className="bg-space-900 border border-white/10 text-text-primary rounded px-3 py-2 focus:outline-none"
                    >
                      <option value="">Select version...</option>
                      {models.map(m => (
                        <option key={m.version} value={m.version}>{m.version}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="md:col-span-2 h-64">
                  {compareModelA && compareModelB ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={getComparisonData()}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="name" stroke="#94A3B8" fontSize={11} />
                        <YAxis stroke="#94A3B8" fontSize={11} domain={[0, 1]} />
                        <RechartsTooltip contentStyle={{ backgroundColor: '#0B1026', borderColor: 'rgba(255,255,255,0.1)' }} />
                        <Legend />
                        <Bar dataKey={compareModelA} fill="#4F8CFF" />
                        <Bar dataKey={compareModelB} fill="#5EEAD4" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-xs text-text-secondary font-mono">
                      Select two model versions to trigger a side-by-side performance evaluation chart.
                    </div>
                  )}
                </div>
              </div>
            </GlassCard>
          )}

          {/* Version table */}
          <GlassCard className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm font-mono">
                <thead>
                  <tr className="border-b border-white/5 text-text-muted text-xs uppercase tracking-wider">
                    <th className="p-4 font-semibold">Version</th>
                    <th className="p-4 font-semibold">Status</th>
                    <th className="p-4 font-semibold">F1 Score</th>
                    <th className="p-4 font-semibold">Accuracy</th>
                    <th className="p-4 font-semibold">ROC-AUC</th>
                    <th className="p-4 font-semibold">Dataset Hash</th>
                    <th className="p-4 font-semibold">Created</th>
                    <th className="p-4 font-semibold">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {models.map((m) => (
                    <tr key={m.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-4 font-bold text-text-primary">{m.version}</td>
                      <td className="p-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            m.is_active
                              ? 'bg-success/15 text-success'
                              : m.notes?.toLowerCase().includes('rejected')
                              ? 'bg-danger/15 text-danger'
                              : 'bg-white/10 text-text-secondary'
                          }`}
                        >
                          {m.is_active ? 'Active' : m.notes?.toLowerCase().includes('rejected') ? 'Rejected' : 'Archived'}
                        </span>
                      </td>
                      <td className="p-4 text-text-primary font-semibold">{(m.f1_score * 100).toFixed(2)}%</td>
                      <td className="p-4 text-text-secondary">{(m.accuracy * 100).toFixed(2)}%</td>
                      <td className="p-4 text-text-secondary">{(m.roc_auc || 0).toFixed(4)}</td>
                      <td className="p-4 text-text-muted text-xs truncate max-w-[120px]" title={m.dataset_version}>
                        {m.dataset_version || 'baseline'}
                      </td>
                      <td className="p-4 text-text-muted text-xs">{new Date(m.created_at).toLocaleDateString()}</td>
                      <td className="p-4 text-text-secondary text-xs max-w-[180px] truncate" title={m.notes}>
                        {m.notes || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </div>
      )}

      {/* 3. TRAINING DATASETS TAB */}
      {activeTab === 'datasets' && !error && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Upload Form */}
          <GlassCard className="p-6 self-start">
            <h3 className="font-bold font-mono text-sm tracking-wider uppercase text-text-muted border-b border-white/5 pb-2 mb-6">
              Upload Verified Training CSV
            </h3>

            <form onSubmit={handleUploadDataset} className="space-y-4 font-mono text-sm">
              <div className="space-y-1.5">
                <label className="text-xs text-text-secondary block">Dataset Identifier Name:</label>
                <input
                  type="text"
                  placeholder="e.g. nasa_june_2026"
                  required
                  value={uploadName}
                  onChange={(e) => setUploadName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-space-900 border border-white/10 text-sm font-mono text-text-primary focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-text-secondary block">Upload CSV File:</label>
                <input
                  id="dataset-file-input"
                  type="file"
                  accept=".csv"
                  required
                  onChange={(e) => setUploadFile(e.target.files[0])}
                  className="w-full text-xs text-text-secondary bg-space-900 rounded-lg border border-white/10 p-2.5"
                />
                <span className="text-[10px] text-text-muted leading-tight block">
                  File must contain ground truth target labels column 'P_HABITABLE_BINARY' (0 or 1).
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-text-secondary block">Auditing Notes:</label>
                <textarea
                  rows="3"
                  placeholder="Describe data source, filtering rules, ground truth confirmation mechanism..."
                  value={uploadNotes}
                  onChange={(e) => setUploadNotes(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-space-900 border border-white/10 text-xs font-mono text-text-primary focus:outline-none"
                />
              </div>

              <button type="submit" disabled={loading} className="btn-primary w-full justify-center font-bold py-3">
                {loading ? 'Uploading File...' : 'Upload Dataset'}
              </button>
            </form>
          </GlassCard>

          {/* Uploaded dataset list */}
          <GlassCard className="lg:col-span-2 p-6 overflow-hidden">
            <h3 className="font-bold font-mono text-sm tracking-wider uppercase text-text-muted mb-6 border-b border-white/5 pb-2">
              Dataset Registry Control
            </h3>

            {datasets.length === 0 ? (
              <div className="text-center py-12 text-text-secondary font-mono text-sm">
                No datasets uploaded in training register.
              </div>
            ) : (
              <div className="space-y-4">
                {datasets.map((d) => {
                  const isExpanded = expandedDatasetId === d.id;
                  let valReport = null;
                  if (d.validation_result) {
                    try {
                      valReport = JSON.parse(d.validation_result);
                    } catch (e) {
                      console.error(e);
                    }
                  }

                  return (
                    <div key={d.id} className="border border-white/5 rounded-xl bg-white/3 overflow-hidden">
                      <div
                        onClick={() => setExpandedDatasetId(isExpanded ? null : d.id)}
                        className="p-4 flex flex-wrap items-center justify-between gap-4 hover:bg-white/5 cursor-pointer transition-colors"
                      >
                        <div className="flex flex-col">
                          <span className="font-bold text-sm text-text-primary font-mono">{d.name}</span>
                          <span className="text-[10px] text-text-muted font-mono mt-0.5">
                            {d.filename} • {d.row_count || '?'} rows • {(d.file_size_bytes / 1024).toFixed(1)} KB
                          </span>
                        </div>

                        <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider font-mono ${
                              d.status === 'ready'
                                ? 'bg-success/20 text-success border border-success/30'
                                : d.status === 'validated'
                                ? 'bg-primary/10 text-primary border border-primary/20'
                                : d.status === 'invalid'
                                ? 'bg-danger/10 text-danger border border-danger/25'
                                : 'bg-white/5 text-text-muted'
                            }`}
                          >
                            {d.status}
                          </span>

                          <div className="flex gap-1.5">
                            {d.status === 'uploaded' && (
                              <button
                                onClick={() => handleValidateDataset(d.id)}
                                className="px-2 py-1 text-[10px] font-bold rounded bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30"
                              >
                                Validate
                              </button>
                            )}
                            {d.status === 'validated' && (
                              <button
                                onClick={() => handleMarkDatasetReady(d.id)}
                                className="px-2 py-1 text-[10px] font-bold rounded bg-success/20 text-success border border-success/30 hover:bg-success/30"
                              >
                                Mark Ready
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteDataset(d.id)}
                              className="px-2 py-1 text-[10px] font-bold rounded bg-danger/10 text-danger border border-danger/20 hover:bg-danger/20"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Expandable validation report */}
                      {isExpanded && (
                        <div className="px-4 pb-4 pt-2 border-t border-white/5 bg-space-950/20 text-xs font-mono">
                          {d.notes && (
                            <div className="mb-4">
                              <span className="text-text-muted text-[10px] block mb-1 uppercase tracking-wider">
                                Audit Notes:
                              </span>
                              <p className="text-text-secondary leading-relaxed bg-white/3 p-3 rounded-lg border border-white/5">
                                {d.notes}
                              </p>
                            </div>
                          )}

                          {valReport ? (
                            <div className="space-y-4">
                              <h4 className="font-bold text-[10px] uppercase tracking-wider text-text-muted border-b border-white/5 pb-1">
                                Validation Analysis Engine Telemetry
                              </h4>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Details column 1 */}
                                <div className="space-y-2">
                                  <div className="flex justify-between border-b border-white/5 pb-0.5">
                                    <span className="text-text-secondary">Valid for retrain:</span>
                                    <span className={valReport.valid ? 'text-success font-bold' : 'text-danger font-bold'}>
                                      {valReport.valid ? 'PASSED' : 'FAILED'}
                                    </span>
                                  </div>
                                  <div className="flex justify-between border-b border-white/5 pb-0.5">
                                    <span className="text-text-secondary">Expected Features:</span>
                                    <span className="text-text-primary">
                                      {valReport.schema?.found_features} / {valReport.schema?.expected_features}
                                    </span>
                                  </div>
                                  <div className="flex justify-between border-b border-white/5 pb-0.5">
                                    <span className="text-text-secondary">Duplicate Rows:</span>
                                    <span className="text-text-primary">{valReport.quality?.duplicate_rows}</span>
                                  </div>
                                </div>

                                {/* Details column 2 */}
                                <div className="space-y-2">
                                  <div className="flex justify-between border-b border-white/5 pb-0.5">
                                    <span className="text-text-secondary">Class Balance (0/1):</span>
                                    <span className="text-text-primary">
                                      {valReport.quality?.label_distribution ? (
                                        `${valReport.quality.label_distribution['0'] || 0} vs ${
                                          valReport.quality.label_distribution['1'] || 0
                                        }`
                                      ) : (
                                        'N/A'
                                      )}
                                    </span>
                                  </div>
                                  <div className="flex justify-between border-b border-white/5 pb-0.5">
                                    <span className="text-text-secondary">Missing Target Labels:</span>
                                    <span className="text-text-primary">
                                      {valReport.quality?.invalid_labels || 0}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Errors & Warnings list */}
                              {valReport.errors?.length > 0 && (
                                <div className="bg-danger/10 border border-danger/20 rounded-lg p-3 text-[11px] text-danger space-y-1">
                                  <span className="font-bold block uppercase tracking-wider">Blocking Errors:</span>
                                  {valReport.errors.map((err, idx) => (
                                    <div key={idx}>• {err}</div>
                                  ))}
                                </div>
                              )}

                              {valReport.warnings?.length > 0 && (
                                <div className="bg-warning/10 border border-warning/20 rounded-lg p-3 text-[11px] text-warning space-y-1">
                                  <span className="font-bold block uppercase tracking-wider">Quality Warnings:</span>
                                  {valReport.warnings.map((warn, idx) => (
                                    <div key={idx}>• {warn}</div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-text-muted italic py-2">
                              Dataset validation report not available. Validate dataset first.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </GlassCard>
        </div>
      )}

      {/* 4. RETRAINING TAB */}
      {activeTab === 'retraining' && !error && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 font-mono">
          {/* Configure retrain */}
          <GlassCard className="p-6 self-start">
            <h3 className="font-bold text-sm tracking-wider uppercase text-text-muted border-b border-white/5 pb-2 mb-6">
              Launch Retrain Worker
            </h3>

            <form onSubmit={handleStartRetraining} className="space-y-4 text-sm">
              <div className="space-y-1.5">
                <label className="text-xs text-text-secondary block">Select Verified Dataset (Optional):</label>
                <select
                  value={selectedDatasetId}
                  onChange={(e) => setSelectedDatasetId(e.target.value)}
                  className="w-full bg-space-900 border border-white/10 text-text-primary rounded-lg px-4 py-2.5 focus:outline-none"
                >
                  <option value="">Baseline only (original planetsdata.csv)</option>
                  {readyDatasets.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.row_count} rows)
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-text-muted leading-tight block">
                  Select an uploaded dataset that has passed validation and is marked as 'ready'. If omitted, retraining runs baseline data only.
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-text-secondary block">Retraining Reason (Audit Trail):</label>
                <textarea
                  required
                  rows="3"
                  placeholder="e.g. Incorporating NASA June 2026 confirmed exoplanet data to adjust habitability weights."
                  value={retrainReason}
                  onChange={(e) => setRetrainReason(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-space-900 border border-white/10 text-xs text-text-primary focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={loading || pollingActive}
                className="btn-primary w-full justify-center font-bold py-3 disabled:opacity-50 disabled:pointer-events-none"
              >
                {pollingActive ? 'Retraining running...' : 'Start Retraining'}
              </button>
            </form>
          </GlassCard>

          {/* Job status */}
          <GlassCard className="lg:col-span-2 p-6">
            <h3 className="font-bold text-sm tracking-wider uppercase text-text-muted border-b border-white/5 pb-2 mb-6">
              MLOps Retrain worker status
            </h3>

            {retrainStatus ? (
              <div className="space-y-6">
                {/* Status indicator banner */}
                <div
                  className={`p-4 rounded-xl flex items-center gap-4 ${
                    retrainStatus.is_running
                      ? 'bg-warning/10 border border-warning/20'
                      : retrainStatus.last_result === 'success'
                      ? 'bg-success/10 border border-success/20'
                      : 'bg-white/5 border border-white/10'
                  }`}
                >
                  {retrainStatus.is_running ? (
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-warning border-t-transparent" />
                  ) : (
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center ${
                        retrainStatus.last_result === 'success' ? 'bg-success/20 text-success' : 'bg-white/10 text-text-secondary'
                      }`}
                    >
                      ✓
                    </div>
                  )}

                  <div className="flex flex-col">
                    <span className="text-xs text-text-secondary">Worker State:</span>
                    <span className="text-sm font-bold text-text-primary">
                      {retrainStatus.is_running ? 'COMPUTING GRADIENTS (RUNNING)' : 'STANDBY (IDLE)'}
                    </span>
                  </div>
                </div>

                {/* Status details grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
                  <div className="space-y-3">
                    <div className="flex justify-between border-b border-white/5 pb-1">
                      <span className="text-text-secondary">Current Model Version:</span>
                      <span className="text-text-primary font-bold">{retrainStatus.current_model_version}</span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-1">
                      <span className="text-text-secondary">Last Result:</span>
                      <span className="text-text-primary font-semibold">{retrainStatus.last_result || '—'}</span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between border-b border-white/5 pb-1">
                      <span className="text-text-secondary">Worker Last Started:</span>
                      <span className="text-text-primary text-xs">
                        {retrainStatus.last_started ? new Date(retrainStatus.last_started).toLocaleString() : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-1">
                      <span className="text-text-secondary">Worker Last Finished:</span>
                      <span className="text-text-primary text-xs">
                        {retrainStatus.last_completed ? new Date(retrainStatus.last_completed).toLocaleString() : '—'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-text-muted italic">
                Telemetry stats unavailable.
              </div>
            )}
          </GlassCard>
        </div>
      )}

      {/* 5. AUDIT LOGS TAB */}
      {activeTab === 'logs' && !error && (
        <GlassCard className="p-6 overflow-hidden">
          <h3 className="font-bold font-mono text-sm tracking-wider uppercase text-text-muted mb-6 border-b border-white/5 pb-2">
            Retraining Logs Audit Trail
          </h3>

          {logs.length === 0 ? (
            <div className="text-center py-12 text-text-secondary font-mono text-sm">
              No retraining run logs found in database audit trail.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm font-mono">
                <thead>
                  <tr className="border-b border-white/5 text-text-muted text-xs uppercase tracking-wider">
                    <th className="p-4 font-semibold">Timestamp</th>
                    <th className="p-4 font-semibold">Status</th>
                    <th className="p-4 font-semibold">Previous Version</th>
                    <th className="p-4 font-semibold">New Version</th>
                    <th className="p-4 font-semibold">F1 Score</th>
                    <th className="p-4 font-semibold">Dataset Size</th>
                    <th className="p-4 font-semibold">Triggered By</th>
                    <th className="p-4 font-semibold">Reason / Audit Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-4 text-text-muted text-xs">
                        {log.timestamp ? new Date(log.timestamp).toLocaleString() : '—'}
                      </td>
                      <td className="p-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            log.status === 'success'
                              ? 'bg-success/15 text-success'
                              : log.status === 'rejected'
                              ? 'bg-warning/15 text-warning'
                              : 'bg-danger/15 text-danger'
                          }`}
                        >
                          {log.status}
                        </span>
                      </td>
                      <td className="p-4 text-text-secondary">{log.previous_model_version || '—'}</td>
                      <td className="p-4 text-text-primary font-bold">{log.model_version || '—'}</td>
                      <td className="p-4 text-text-primary">
                        {log.f1_score !== null ? `${(log.f1_score * 100).toFixed(2)}%` : '—'}
                      </td>
                      <td className="p-4 text-text-secondary">{log.dataset_size || '—'}</td>
                      <td className="p-4 text-text-secondary uppercase">{log.requested_by}</td>
                      <td className="p-4 text-text-secondary text-xs max-w-[200px] truncate" title={log.reason}>
                        {log.reason}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>
      )}
    </div>
  );
}
