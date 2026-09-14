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

  useEffect(() => {
    setPage(1);
    fetchPlanets();
  }, [activeTab]);

  useEffect(() => {
    const delay = setTimeout(() => {
      if (activeTab !== 'pending') fetchPlanets();
    }, 400);
    return () => clearTimeout(delay);
  }, [search, page]);

  const handleToggleExpand = async (planetId) => {
    if (expandedPlanetId === planetId) {
      setExpandedPlanetId(null);
      setPlanetDetail(null);
      return;
    }
    setExpandedPlanetId(planetId);
    setLoadingDetail(true);
    setPlanetDetail(null);
    try {
      const res = await adminAPI.getPlanetDetail(planetId);
      if (res.data?.status === 'success') setPlanetDetail(res.data.data);
    } catch (err) {
      console.error('Error fetching detail:', err);
    } finally {
      setLoadingDetail(false);
    }
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

  const tabs = [
    { key: 'pending', label: 'Pending Review' },
    { key: 'approved', label: 'Approved' },
    { key: 'rejected', label: 'Rejected' },
    { key: 'all', label: 'All Submissions' },
  ];

  return (
    <div className="space-y-10">
      {/* ── Page Header ────────────────────────────────────────── */}
      <div className="border-b border-white/10 pb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-text-primary">
            Submission Moderation
          </h1>
          <p className="text-text-secondary text-sm sm:text-base leading-relaxed max-w-2xl">
            Review user-submitted candidate exoplanets, verify planetary feature values, and grant publication approval.
          </p>
        </div>
      </div>

      {/* ── Tabs & Search Bar ──────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 border-b border-white/10 pb-6">
        <div className="flex flex-wrap gap-3">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-2.5 text-xs sm:text-sm font-semibold rounded-xl transition-all ${activeTab === tab.key
                  ? 'bg-primary/20 text-primary border border-primary/30 shadow-sm'
                  : 'text-text-secondary hover:text-text-primary hover:bg-white/5 border border-transparent'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab !== 'pending' && (
          <div className="relative w-full sm:w-88">
            <input
              type="text"
              placeholder="Search planet name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-sm py-3 pl-11 pr-4 rounded-xl bg-space-900/80 border border-white/10 focus:border-primary/50 text-text-primary placeholder:text-text-muted"
            />
            <svg
              className="w-4 h-4 text-text-muted absolute left-4 top-1/2 -translate-y-1/2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        )}
      </div>

      {/* ── Table Content ──────────────────────────────────────── */}
      {loading && planets.length === 0 ? (
        <div className="py-20 flex justify-center">
          <LoadingSpinner message="Loading submissions from queue..." />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={fetchPlanets} />
      ) : planets.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-space-900/40 border border-white/10 flex flex-col items-center justify-center">
          <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center text-text-muted mb-3">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-base font-semibold text-text-primary">No submissions in queue</p>
          <p className="text-xs text-text-muted mt-1 max-w-sm">
            There are currently no planets under the "{activeTab}" filter.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl bg-space-900/60 border border-white/10 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="data-table w-full">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.02]">
                    <th className="w-10 py-3.5 px-4 text-center"></th>
                    <th className="py-3.5 px-4 text-left text-xs font-bold uppercase tracking-wider text-text-muted">Planet Name</th>
                    <th className="py-3.5 px-4 text-left text-xs font-bold uppercase tracking-wider text-text-muted">Date Submitted</th>
                    <th className="py-3.5 px-4 text-left text-xs font-bold uppercase tracking-wider text-text-muted">ML Score</th>
                    <th className="py-3.5 px-4 text-left text-xs font-bold uppercase tracking-wider text-text-muted">Classification</th>
                    <th className="py-3.5 px-4 text-center text-xs font-bold uppercase tracking-wider text-text-muted">Status</th>
                    <th className="py-3.5 px-4 text-right text-xs font-bold uppercase tracking-wider text-text-muted">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {planets.map((p) => {
                    const isExpanded = expandedPlanetId === p.id;
                    return (
                      <tbody key={p.id} className="contents">
                        <tr
                          onClick={() => handleToggleExpand(p.id)}
                          className={`cursor-pointer transition-colors ${isExpanded ? 'bg-primary/[0.04]' : 'hover:bg-white/[0.02]'
                            }`}
                        >
                          <td className="py-4 px-4 text-center">
                            <svg
                              className={`w-4 h-4 text-text-muted transition-transform inline-block ${isExpanded ? 'rotate-90 text-primary' : ''
                                }`}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                            </svg>
                          </td>
                          <td className="py-4 px-4 font-bold text-text-primary text-sm">{p.planet_name}</td>
                          <td className="py-4 px-4 text-text-muted text-xs">
                            {p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}
                          </td>
                          <td className="py-4 px-4 font-mono text-sm font-semibold text-accent">
                            {p.habitability_probability != null
                              ? `${(p.habitability_probability * 100).toFixed(1)}%`
                              : '—'}
                          </td>
                          <td className="py-4 px-4">
                            <Badge variant={p.habitability === 1 ? 'info' : 'neutral'}>
                              {p.habitability === 1 ? 'Habitable Candidate' : 'Non-Habitable'}
                            </Badge>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <Badge
                              variant={
                                p.status === 'approved'
                                  ? 'success'
                                  : p.status === 'rejected'
                                    ? 'danger'
                                    : 'warning'
                              }
                            >
                              {p.status}
                            </Badge>
                          </td>
                          <td className="py-4 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-end gap-2">
                              {p.status !== 'approved' && (
                                <button
                                  onClick={(e) => handleApprove(e, p.id)}
                                  className="px-3 py-1.5 rounded-lg bg-success/15 hover:bg-success/25 border border-success/30 text-xs font-semibold text-success transition-colors"
                                >
                                  Approve
                                </button>
                              )}
                              {p.status !== 'rejected' && (
                                <button
                                  onClick={(e) => handleReject(e, p.id)}
                                  className="px-3 py-1.5 rounded-lg bg-danger/15 hover:bg-danger/25 border border-danger/30 text-xs font-semibold text-danger transition-colors"
                                >
                                  Reject
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr>
                            <td colSpan="7" className="bg-space-950/60 p-6 border-y border-white/10">
                              {loadingDetail ? (
                                <div className="py-6 flex justify-center">
                                  <LoadingSpinner message="Loading full telemetry features..." />
                                </div>
                              ) : planetDetail ? (
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                  <div className="lg:col-span-2 space-y-3">
                                    <h4 className="font-bold text-xs uppercase tracking-wider text-accent border-b border-white/10 pb-2">
                                      Physical & Orbital Parameters
                                    </h4>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs font-mono">
                                      {Object.entries(planetDetail.features || {}).map(([key, value]) => (
                                        <div key={key} className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5 flex flex-col justify-between">
                                          <span className="text-text-muted text-[10px] uppercase truncate">{key}</span>
                                          <span className="text-text-primary font-bold text-sm mt-0.5">
                                            {typeof value === 'number' ? value.toFixed(4) : String(value)}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>

                                  <div className="space-y-4">
                                    <div className="space-y-3">
                                      <h4 className="font-bold text-xs uppercase tracking-wider text-primary border-b border-white/10 pb-2">
                                        Submitter Attribution
                                      </h4>
                                      <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 text-xs space-y-2">
                                        <div className="flex justify-between">
                                          <span className="text-text-muted">Username:</span>
                                          <span className="text-text-primary font-semibold">{planetDetail.submitter?.username || 'anonymous'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-text-muted">Email:</span>
                                          <span className="text-text-primary font-semibold">{planetDetail.submitter?.email || '—'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-text-muted">Account Role:</span>
                                          <span className="text-accent font-semibold capitalize">{planetDetail.submitter?.role || '—'}</span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="text-center text-xs text-text-muted py-4">Failed to load detailed feature vectors.</div>
                              )}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={executeAction}
        title={confirmAction === 'approve' ? 'Approve Planet Submission?' : 'Reject Planet Submission?'}
        description={
          confirmAction === 'approve'
            ? 'This candidate planet will be published immediately to the public discovery rankings.'
            : 'This candidate submission will be marked as rejected and excluded from public rankings.'
        }
        confirmLabel={confirmAction === 'approve' ? 'Approve Publication' : 'Reject Submission'}
        variant={confirmAction === 'approve' ? 'success' : 'danger'}
        loading={confirmLoading}
        withInput={confirmAction === 'reject'}
        inputLabel="Rejection rationale (optional)"
        inputPlaceholder="e.g. Inconsistent orbital period or non-conforming feature values"
      />
    </div>
  );
}
