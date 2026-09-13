import { useState, useEffect } from 'react';
import { adminAPI } from '../../api/admin';
import GlassCard from '../../components/GlassCard';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorState from '../../components/ErrorState';
import Button from '../../components/ui/Button';
import { useToast } from '../../context/ToastContext';

export default function DatasetsPage() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [datasets, setDatasets] = useState([]);
  const [uploadName, setUploadName] = useState('');
  const [uploadNotes, setUploadNotes] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

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

  useEffect(() => { fetchDatasets(); }, []);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!uploadFile) {
      showToast('Please select a CSV file.', 'warning');
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
        setUploadName(''); setUploadNotes(''); setUploadFile(null);
        document.getElementById('dataset-file-input').value = '';
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
        showToast('Validation triggered.', 'success');
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
        showToast('Dataset marked as ready.', 'success');
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
        showToast('Dataset deleted.', 'success');
        if (expandedId === id) setExpandedId(null);
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

  if (loading && datasets.length === 0) return <LoadingSpinner message="Loading datasets..." />;
  if (error) return <ErrorState message={error} onRetry={fetchDatasets} />;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary">Training Datasets</h1>
        <p className="text-text-secondary text-sm mt-1">Upload, validate, and manage datasets for model training.</p>
      </div>

      {/* Upload Form */}
      <GlassCard padding="md">
        <h3 className="font-semibold text-sm uppercase tracking-wider text-text-muted mb-4">Upload New Dataset</h3>
        <form onSubmit={handleUpload} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col">
              <label htmlFor="dataset-name">Dataset Name</label>
              <input type="text" id="dataset-name" value={uploadName} onChange={(e) => setUploadName(e.target.value)} placeholder="e.g. exoplanets_v3" required />
            </div>
            <div className="flex flex-col">
              <label htmlFor="dataset-file-input">CSV File</label>
              <input type="file" id="dataset-file-input" accept=".csv" onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                className="text-sm text-text-secondary file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20 file:cursor-pointer" />
            </div>
          </div>
          <div className="flex flex-col">
            <label htmlFor="dataset-notes">Notes (optional)</label>
            <input type="text" id="dataset-notes" value={uploadNotes} onChange={(e) => setUploadNotes(e.target.value)} placeholder="Description or version notes" />
          </div>
          <Button type="submit" loading={loading} className="self-start">Upload Dataset</Button>
        </form>
      </GlassCard>

      {/* Dataset List */}
      {datasets.length === 0 ? (
        <GlassCard padding="md" className="text-center text-text-secondary text-sm">No datasets uploaded yet.</GlassCard>
      ) : (
        <GlassCard padding="sm" className="overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Rows</th>
                <th>Uploaded</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {datasets.map((ds) => (
                <tr key={ds.id}>
                  <td className="primary-cell">{ds.name}</td>
                  <td>
                    <span className={`badge ${ds.status === 'ready' ? 'badge-success' : ds.status === 'validated' ? 'badge-info' : ds.status === 'failed' ? 'badge-danger' : 'badge-warning'}`}>
                      {ds.status}
                    </span>
                  </td>
                  <td>{ds.row_count ?? '—'}</td>
                  <td className="text-text-muted text-xs">{ds.created_at ? new Date(ds.created_at).toLocaleDateString() : '—'}</td>
                  <td className="text-right">
                    <div className="flex justify-end gap-2">
                      {ds.status === 'uploaded' && (
                        <button onClick={() => handleValidate(ds.id)} className="btn-ghost text-xs text-primary">Validate</button>
                      )}
                      {ds.status === 'validated' && (
                        <button onClick={() => handleMarkReady(ds.id)} className="btn-ghost text-xs text-success">Mark Ready</button>
                      )}
                      <button onClick={() => handleDelete(ds.id)} className="btn-ghost text-xs text-danger">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </GlassCard>
      )}
    </div>
  );
}
