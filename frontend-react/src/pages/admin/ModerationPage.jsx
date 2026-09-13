import { useState, useEffect } from 'react';
import { adminAPI } from '../../api/admin';
import GlassCard from '../../components/GlassCard';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorState from '../../components/ErrorState';
import Badge from '../../components/ui/Badge';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Pagination from '../../components/ui/Pagination';
import { useToast } from '../../context/ToastContext';

export default function ModerationPage() {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('pending');
  const [planets, setPlanets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [expandedPlanetId, setExpandedPlanetId] = useState(null);
  const [planetDetail, setPlanetDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Confirm dialog state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmPlanetId, setConfirmPlanetId] = useState(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const fetchPlanets = async () => {
    try {
      setLoading(true);
      setError(null);
      let res;
      if (activeTab === 'pending') {
        res = await adminAPI.getPendingPlanets(page, 15);
      } else {
        const statusFilter = activeTab === 'all' ? undefined : activeTab;
        res = await adminAPI.getAllPlanets({ status: statusFilter, search: search || undefined, page, per_page: 15 });
      }
      if (res.data?.status === 'success') {
        setPlanets(res.data.data.planets);
        setTotalPages(res.data.data.total_pages || 1);
      } else {
        setError(res.data?.message || 'Failed to load submissions.');
      }
    } catch (err) {
      console.error(err);
      setError('Error loading submissions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { setPage(1); fetchPlanets(); }, [activeTab]);
  useEffect(() => {
    const delay = setTimeout(() => { if (activeTab !== 'pending') fetchPlanets(); }, 500);
    return () => clearTimeout(delay);
  }, [search, page]);

  const handleToggleExpand = async (planetId) => {
    if (expandedPlanetId === planetId) { setExpandedPlanetId(null); setPlanetDetail(null); return; }
    setExpandedPlanetId(planetId);
    setLoadingDetail(true);
    setPlanetDetail(null);
    try {
      const res = await adminAPI.getPlanetDetail(planetId);
      if (res.data?.status === 'success') setPlanetDetail(res.data.data);
    } catch (err) { console.error('Error fetching detail:', err); }
    finally { setLoadingDetail(false); }
  };

  const handleApprove = (e, id) => {
    e.stopPropagation();
    setConfirmPlanetId(id);
    setConfirmAction('approve');
    setConfirmOpen(true);
  };

  const handleReject = (e, id) => {
    e.stopPropagation();
    setConfirmPlanetId(id);
    setConfirmAction('reject');
    setConfirmOpen(true);
  };

  const executeAction = async (inputValue) => {
    setConfirmLoading(true);
    try {
      let res;
      if (confirmAction === 'approve') {
        res = await adminAPI.approvePlanet(confirmPlanetId);
      } else {
        res = await adminAPI.rejectPlanet(confirmPlanetId, inputValue || '');
      }
      if (res.data?.status === 'success') {
        showToast(`Planet ${confirmAction === 'approve' ? 'approved' : 'rejected'} successfully.`, 'success');
        fetchPlanets();
        if (expandedPlanetId === confirmPlanetId) setExpandedPlanetId(null);
      } else {
        showToast(res.data?.message || 'Action failed.', 'error');
      }
    } catch (err) {
      showToast(`Error ${confirmAction === 'approve' ? 'approving' : 'rejecting'} submission.`, 'error');
    } finally {
      setConfirmLoading(false);
      setConfirmOpen(false);
    }
  };

  const tabs = ['pending', 'approved', 'rejected', 'all'];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary">Submissions</h1>
        <p className="text-text-secondary text-sm mt-1">Review, approve, or reject user-submitted planets.</p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-white/5 pb-px">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-3 px-4 text-sm font-medium border-b-2 capitalize transition-all ${
              activeTab === tab ? 'border-primary text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Search */}
      {activeTab !== 'pending' && (
        <input
          type="text" placeholder="Search by planet name..." value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />
      )}

      {/* List */}
      {loading && planets.length === 0 ? (
        <LoadingSpinner message="Loading submissions..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchPlanets} />
      ) : planets.length === 0 ? (
        <GlassCard padding="md" className="text-center text-text-secondary text-sm">
          No planets found in "{activeTab}".
        </GlassCard>
      ) : (
        <div className="space-y-4">
          <GlassCard padding="sm" className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="w-8"></th>
                    <th>Planet</th>
                    <th>Date</th>
                    <th>Score</th>
                    <th>Label</th>
                    <th>Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {planets.map((p) => {
                    const isExpanded = expandedPlanetId === p.id;
                    return (
                      <>
                        <tr key={p.id} onClick={() => handleToggleExpand(p.id)} className="cursor-pointer">
                          <td className="text-center">
                            <svg className={`w-4 h-4 text-text-muted transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                            </svg>
                          </td>
                          <td className="primary-cell">{p.planet_name}</td>
                          <td className="text-text-muted text-xs">{p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}</td>
                          <td>{p.habitability_probability != null ? `${(p.habitability_probability * 100).toFixed(1)}%` : '—'}</td>
                          <td><Badge variant={p.habitability === 1 ? 'info' : 'neutral'}>{p.habitability === 1 ? 'Habitable' : 'Non-Habitable'}</Badge></td>
                          <td><Badge variant={p.status === 'approved' ? 'success' : p.status === 'rejected' ? 'danger' : 'warning'}>{p.status}</Badge></td>
                          <td className="text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-end gap-2">
                              {p.status !== 'approved' && (
                                <button onClick={(e) => handleApprove(e, p.id)} className="btn-ghost text-xs text-success">Approve</button>
                              )}
                              {p.status !== 'rejected' && (
                                <button onClick={(e) => handleReject(e, p.id)} className="btn-ghost text-xs text-danger">Reject</button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr key={`${p.id}-detail`}>
                            <td colSpan="7" className="bg-space-900/50 p-6 border-b border-white/5">
                              {loadingDetail ? (
                                <LoadingSpinner message="Loading details..." />
                              ) : planetDetail ? (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                  <div className="md:col-span-2 space-y-3">
                                    <h4 className="font-semibold text-xs uppercase tracking-wider text-text-muted border-b border-white/5 pb-2">Feature Values</h4>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs font-mono">
                                      {Object.entries(planetDetail.features || {}).map(([key, value]) => (
                                        <div key={key} className="flex justify-between border-b border-white/5 pb-1 pr-4">
                                          <span className="text-text-secondary">{key}:</span>
                                          <span className="text-text-primary font-semibold">{typeof value === 'number' ? value.toFixed(4) : String(value)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                  <div className="space-y-4">
                                    <div className="space-y-2">
                                      <h4 className="font-semibold text-xs uppercase tracking-wider text-text-muted border-b border-white/5 pb-2">Submitter</h4>
                                      <div className="text-xs space-y-1.5">
                                        <div className="flex justify-between"><span className="text-text-secondary">Username:</span><span className="text-text-primary font-semibold">{planetDetail.submitter?.username || 'anonymous'}</span></div>
                                        <div className="flex justify-between"><span className="text-text-secondary">Email:</span><span className="text-text-primary font-semibold">{planetDetail.submitter?.email || '—'}</span></div>
                                        <div className="flex justify-between"><span className="text-text-secondary">Role:</span><span className="text-text-primary font-semibold capitalize">{planetDetail.submitter?.role || '—'}</span></div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="text-center text-xs text-text-muted">Failed to load details.</div>
                              )}
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </GlassCard>

          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={executeAction}
        title={confirmAction === 'approve' ? 'Approve Submission?' : 'Reject Submission?'}
        description={confirmAction === 'approve'
          ? 'This planet will appear in the public rankings.'
          : 'This planet will be marked as rejected.'}
        confirmLabel={confirmAction === 'approve' ? 'Approve' : 'Reject'}
        variant={confirmAction === 'approve' ? 'success' : 'danger'}
        loading={confirmLoading}
        withInput={confirmAction === 'reject'}
        inputLabel="Rejection reason (optional)"
        inputPlaceholder="e.g. Invalid data"
      />
    </div>
  );
}
