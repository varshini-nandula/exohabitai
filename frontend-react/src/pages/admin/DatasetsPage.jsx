import { useState, useEffect } from 'react';
import { adminAPI } from '../../api/admin';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorState from '../../components/ErrorState';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { useToast } from '../../context/ToastContext';

export default function DatasetsPage() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [datasets, setDatasets] = useState([]);
  const [uploadName, setUploadName] = useState('');
  const [uploadNotes, setUploadNotes] = useState('');
  const [uploadFile, setUploadFile] = useState(null);

  const fetchDatasets = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await adminAPI.getDatasets();
      if (res.data?.status === 'success') {
        setDatasets(res.data.data.datasets || []);
      } else {
        setError(res.data?.message || 'Failed to load datasets.');
      }
    } catch (err) {
      console.error(err);
      setError('Error fetching datasets.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDatasets();
  }, []);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!uploadFile) {
      showToast('Please select a CSV file to upload.', 'warning');
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
        const fileInput = document.getElementById('dataset-file-input');
        if (fileInput) fileInput.value = '';
        showToast('Dataset uploaded successfully.', 'success');
        fetchDatasets();
      } else {
        showToast(res.data?.message || 'Upload failed.', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Error uploading dataset.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleValidate = async (id) => {
    try {
      setLoading(true);
      const res = await adminAPI.validateDataset(id);
      if (res.data?.status === 'success') {
        showToast('Dataset validation completed.', 'success');
        fetchDatasets();
      } else {
        showToast(res.data?.message || 'Validation failed.', 'error');
      }
    } catch (err) {
      showToast('Error triggering validation.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkReady = async (id) => {
    try {
      setLoading(true);
      const res = await adminAPI.markDatasetReady(id);
      if (res.data?.status === 'success') {
        showToast('Dataset marked as ready for retraining.', 'success');
        fetchDatasets();
      } else {
        showToast(res.data?.message || 'Action failed.', 'error');
      }
    } catch (err) {
      showToast('Error updating dataset status.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      setLoading(true);
      const res = await adminAPI.deleteDataset(id);
      if (res.data?.status === 'success') {
        showToast('Dataset deleted from catalog.', 'success');
        fetchDatasets();
      } else {
        showToast(res.data?.message || 'Delete failed.', 'error');
      }
    } catch (err) {
      showToast('Error deleting dataset.', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loading && datasets.length === 0) {
    return (
      <div className="py-20 flex justify-center">
        <LoadingSpinner message="Loading dataset catalog..." />
      </div>
    );
  }

  if (error) return <ErrorState message={error} onRetry={fetchDatasets} />;

  return (
    <div className="space-y-10">
      {/* ── Page Header ────────────────────────────────────────── */}
      <div className="border-b border-white/10 pb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-text-primary">
            Training Datasets
          </h1>
          <p className="text-text-secondary text-sm sm:text-base leading-relaxed max-w-2xl">
            Ingest, validate format schemas, and prepare planetary telemetry catalogs for model training.
          </p>
        </div>
      </div>

      {/* ── Upload New Dataset Form ────────────────────────────── */}
      <div className="p-6 rounded-2xl bg-space-900/60 border border-white/10 backdrop-blur-md">
        <div className="pb-4 mb-5 border-b border-white/5">
          <h3 className="font-bold text-base text-text-primary">Upload Dataset</h3>
          <p className="text-xs text-text-muted mt-0.5">Upload a CSV dataset containing exoplanet orbital and physical features</p>
        </div>

        <form onSubmit={handleUpload} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label htmlFor="dataset-name" className="text-xs font-bold uppercase tracking-wider text-text-muted">
                Dataset Name *
              </label>
              <input
                type="text"
                id="dataset-name"
                value={uploadName}
                onChange={(e) => setUploadName(e.target.value)}
                placeholder="e.g. kepler_dr25_v2"
                required
                className="w-full text-sm py-3 px-4 rounded-xl bg-space-900/80 border border-white/10 focus:border-primary/50 text-text-primary placeholder:text-text-muted"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="dataset-file-input" className="text-xs font-bold uppercase tracking-wider text-text-muted">
                CSV Data File *
              </label>
              <input
                type="file"
                id="dataset-file-input"
                accept=".csv"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                className="w-full text-xs text-text-secondary file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-primary/20 file:text-primary hover:file:bg-primary/30 file:cursor-pointer p-1.5 rounded-xl bg-space-900/80 border border-white/10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="dataset-notes" className="text-xs font-bold uppercase tracking-wider text-text-muted">
              Description & Release Notes (Optional)
            </label>
            <input
              type="text"
              id="dataset-notes"
              value={uploadNotes}
              onChange={(e) => setUploadNotes(e.target.value)}
              placeholder="Source archive notes, feature preprocessing version, or data lineage"
              className="w-full text-sm py-3 px-4 rounded-xl bg-space-900/80 border border-white/10 focus:border-primary/50 text-text-primary placeholder:text-text-muted"
            />
          </div>

          <Button type="submit" loading={loading} className="px-6 py-3">
            Upload & Ingest Dataset
          </Button>
        </form>
      </div>

      {/* ── Dataset Catalog Table ──────────────────────────────── */}
      <div className="p-6 rounded-2xl bg-space-900/60 border border-white/10 backdrop-blur-md">
        <div className="pb-4 mb-4 border-b border-white/5">
          <h3 className="font-bold text-base text-text-primary">Dataset Catalog</h3>
          <p className="text-xs text-text-muted mt-0.5">Available datasets for ML model retraining pipelines</p>
        </div>

        {datasets.length === 0 ? (
          <div className="text-center py-10 text-text-secondary text-sm">
            No datasets uploaded yet. Upload your first dataset using the form above.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/5">
            <table className="data-table w-full">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02]">
                  <th className="py-3.5 px-4 text-left text-xs font-bold uppercase tracking-wider text-text-muted">Dataset Identifier</th>
                  <th className="py-3.5 px-4 text-left text-xs font-bold uppercase tracking-wider text-text-muted">Status</th>
                  <th className="py-3.5 px-4 text-left text-xs font-bold uppercase tracking-wider text-text-muted">Row Count</th>
                  <th className="py-3.5 px-4 text-left text-xs font-bold uppercase tracking-wider text-text-muted">Uploaded Date</th>
                  <th className="py-3.5 px-4 text-right text-xs font-bold uppercase tracking-wider text-text-muted">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {datasets.map((ds) => (
                  <tr key={ds.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-4 px-4">
                      <span className="font-bold text-text-primary text-sm font-mono">{ds.name}</span>
                      {ds.notes && <p className="text-xs text-text-muted mt-0.5 truncate max-w-sm">{ds.notes}</p>}
                    </td>
                    <td className="py-4 px-4">
                      <Badge
                        variant={
                          ds.status === 'ready'
                            ? 'success'
                            : ds.status === 'validated'
                            ? 'info'
                            : ds.status === 'failed'
                            ? 'danger'
                            : 'warning'
                        }
                      >
                        {ds.status}
                      </Badge>
                    </td>
                    <td className="py-4 px-4 font-mono text-sm text-text-secondary">{ds.row_count ?? '—'}</td>
                    <td className="py-4 px-4 text-text-muted text-xs">
                      {ds.uploaded_at || ds.created_at ? new Date(ds.uploaded_at || ds.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex justify-end gap-2">
                        {ds.status === 'uploaded' && (
                          <button
                            onClick={() => handleValidate(ds.id)}
                            className="px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 border border-primary/25 text-xs font-semibold text-primary transition-colors"
                          >
                            Validate Schema
                          </button>
                        )}
                        {ds.status === 'validated' && (
                          <button
                            onClick={() => handleMarkReady(ds.id)}
                            className="px-3 py-1.5 rounded-lg bg-success/10 hover:bg-success/20 border border-success/25 text-xs font-semibold text-success transition-colors"
                          >
                            Mark Ready
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(ds.id)}
                          className="px-3 py-1.5 rounded-lg bg-danger/10 hover:bg-danger/20 border border-danger/25 text-xs font-semibold text-danger transition-colors"
                        >
                          Delete
                        </button>
                      </div>
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
