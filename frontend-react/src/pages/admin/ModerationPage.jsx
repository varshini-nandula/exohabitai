import { useState, useEffect } from 'react';
import { adminAPI } from '../../api/admin';
import GlassCard from '../../components/GlassCard';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorState from '../../components/ErrorState';

export default function ModerationPage() {
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'approved' | 'rejected' | 'all'
  const [planets, setPlanets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Search & Pagination state
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [expandedPlanetId, setExpandedPlanetId] = useState(null);
  
  // Detail state for selected planet
  const [planetDetail, setPlanetDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const fetchPlanets = async () => {
    try {
      setLoading(true);
      setError(null);
      
      let res;
      if (activeTab === 'pending') {
        res = await adminAPI.getPendingPlanets(page, 15);
      } else {
        const statusFilter = activeTab === 'all' ? undefined : activeTab;
        res = await adminAPI.getAllPlanets({
          status: statusFilter,
          search: search || undefined,
          page,
          per_page: 15,
        });
      }

      if (res.data?.status === 'success') {
        setPlanets(res.data.data.planets);
        setTotalPages(res.data.data.total_pages || 1);
      } else {
        setError(res.data?.message || 'Failed to retrieve moderation data.');
      }
    } catch (err) {
      console.error(err);
      setError('Error communicating with administration moderation endpoints.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    fetchPlanets();
  }, [activeTab]);

  useEffect(() => {
    // debounce search
    const delayDebounce = setTimeout(() => {
      if (activeTab !== 'pending') {
        fetchPlanets();
      }
    }, 500);
    return () => clearTimeout(delayDebounce);
  }, [search, page]);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
    }
  };

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
      if (res.data?.status === 'success') {
        setPlanetDetail(res.data.data);
      } else {
        console.error(res.data?.message);
      }
    } catch (err) {
      console.error('Error fetching detail:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleApprove = async (e, id) => {
    e.stopPropagation();
    try {
      const res = await adminAPI.approvePlanet(id);
      if (res.data?.status === 'success') {
        // Refresh list
        fetchPlanets();
        if (expandedPlanetId === id) setExpandedPlanetId(null);
      } else {
        alert(res.data?.message || 'Approve action failed.');
      }
    } catch (err) {
      console.error(err);
      alert('Error approving planet submission.');
    }
  };

  const handleReject = async (e, id) => {
    e.stopPropagation();
    const reason = prompt('Specify rejection reason (optional):');
    if (reason === null) return; // user cancelled prompt

    try {
      const res = await adminAPI.rejectPlanet(id, reason);
      if (res.data?.status === 'success') {
        fetchPlanets();
        if (expandedPlanetId === id) setExpandedPlanetId(null);
      } else {
        alert(res.data?.message || 'Reject action failed.');
      }
    } catch (err) {
      console.error(err);
      alert('Error rejecting planet submission.');
    }
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent font-mono">
          PLANET MODERATION
        </h1>
        <p className="text-text-secondary font-mono text-sm mt-1">
          Review, approve, or reject user-submitted planets. Only approved submissions are displayed on public ranking lists.
        </p>
      </div>

      {/* Tabs Menu */}
      <div className="flex flex-wrap gap-2 border-b border-white/5 pb-px font-mono text-sm">
        {['pending', 'approved', 'rejected', 'all'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-3 px-4 font-semibold border-b-2 uppercase transition-all ${
              activeTab === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Search & Filters */}
      {activeTab !== 'pending' && (
        <div className="flex gap-4">
          <input
            type="text"
            placeholder="Search planets by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-grow max-w-md px-4 py-2.5 rounded-lg bg-space-900 border border-white/10 text-sm font-mono text-text-primary focus:outline-none focus:border-primary/50 transition-colors"
          />
        </div>
      )}

      {/* Main List */}
      {loading && planets.length === 0 ? (
        <LoadingSpinner message="Retrieving exoplanet submissions..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchPlanets} />
      ) : planets.length === 0 ? (
        <GlassCard className="p-8 text-center text-text-secondary font-mono text-sm">
          No exoplanets found in the '{activeTab}' category.
        </GlassCard>
      ) : (
        <div className="space-y-4">
          {/* Table Container */}
          <GlassCard className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm font-mono">
                <thead>
                  <tr className="border-b border-white/5 text-text-muted text-xs uppercase tracking-wider">
                    <th className="p-4 font-semibold w-8"></th>
                    <th className="p-4 font-semibold">Planet Name</th>
                    <th className="p-4 font-semibold">Submission Date</th>
                    <th className="p-4 font-semibold">Probability</th>
                    <th className="p-4 font-semibold">Label</th>
                    <th className="p-4 font-semibold">Status</th>
                    <th className="p-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {planets.map((p) => {
                    const isExpanded = expandedPlanetId === p.id;
                    return (
                      <>
                        <tr
                          key={p.id}
                          onClick={() => handleToggleExpand(p.id)}
                          className="hover:bg-white/5 cursor-pointer transition-colors"
                        >
                          <td className="p-4 text-center">
                            <svg
                              className={`w-4 h-4 text-text-muted transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                            </svg>
                          </td>
                          <td className="p-4 font-bold text-text-primary">{p.planet_name}</td>
                          <td className="p-4 text-text-secondary">
                            {p.created_at ? new Date(p.created_at).toLocaleDateString() : 'N/A'}
                          </td>
                          <td className="p-4 text-text-primary">
                            {p.habitability_probability !== null
                              ? `${(p.habitability_probability * 100).toFixed(2)}%`
                              : 'N/A'}
                          </td>
                          <td className="p-4">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                                p.habitability === 1 ? 'bg-accent/15 text-accent' : 'bg-white/10 text-text-muted'
                              }`}
                            >
                              {p.habitability === 1 ? 'Habitable' : 'Uninhabitable'}
                            </span>
                          </td>
                          <td className="p-4">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                p.status === 'approved'
                                  ? 'bg-success/15 text-success'
                                  : p.status === 'rejected'
                                  ? 'bg-danger/15 text-danger'
                                  : 'bg-warning/15 text-warning'
                              }`}
                            >
                              {p.status}
                            </span>
                          </td>
                          <td className="p-4 text-right flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                            {p.status === 'pending' && (
                              <>
                                <button
                                  onClick={(e) => handleApprove(e, p.id)}
                                  className="px-2.5 py-1 text-xs font-bold font-mono rounded bg-success/20 text-success border border-success/30 hover:bg-success/30 transition-colors"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={(e) => handleReject(e, p.id)}
                                  className="px-2.5 py-1 text-xs font-bold font-mono rounded bg-danger/20 text-danger border border-danger/30 hover:bg-danger/30 transition-colors"
                                >
                                  Reject
                                </button>
                              </>
                            )}
                            {p.status === 'approved' && (
                              <button
                                onClick={(e) => handleReject(e, p.id)}
                                className="px-2.5 py-1 text-xs font-semibold font-mono rounded bg-white/5 text-danger border border-danger/10 hover:bg-danger/15 transition-colors"
                              >
                                Reject
                              </button>
                            )}
                            {p.status === 'rejected' && (
                              <button
                                onClick={(e) => handleApprove(e, p.id)}
                                className="px-2.5 py-1 text-xs font-semibold font-mono rounded bg-white/5 text-success border border-success/10 hover:bg-success/15 transition-colors"
                              >
                                Approve
                              </button>
                            )}
                          </td>
                        </tr>

                        {/* Collapsible detail panel */}
                        {isExpanded && (
                          <tr>
                            <td colSpan="7" className="bg-space-900/50 p-6 border-b border-white/5">
                              {loadingDetail ? (
                                <LoadingSpinner message="Retrieving physical parameter data..." />
                              ) : planetDetail ? (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                  {/* Section 1: Physical Parameters */}
                                  <div className="md:col-span-2 space-y-4">
                                    <h4 className="font-bold text-xs uppercase tracking-wider text-text-muted border-b border-white/5 pb-2">
                                      Physical Feature Matrix (Inference Values)
                                    </h4>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs font-mono">
                                      {Object.entries(planetDetail.features || {}).map(([key, value]) => (
                                        <div key={key} className="flex justify-between border-b border-white/5 pb-1 pr-4">
                                          <span className="text-text-secondary">{key}:</span>
                                          <span className="text-text-primary font-semibold">
                                            {typeof value === 'number' ? value.toFixed(4) : String(value)}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>

                                  {/* Section 2: Submitter & Metadata */}
                                  <div className="space-y-6">
                                    {/* Submitter */}
                                    <div className="space-y-2">
                                      <h4 className="font-bold text-xs uppercase tracking-wider text-text-muted border-b border-white/5 pb-2">
                                        Provenance & Accountability
                                      </h4>
                                      <div className="text-xs space-y-1.5 font-mono">
                                        <div className="flex justify-between">
                                          <span className="text-text-secondary">Username:</span>
                                          <span className="text-text-primary font-semibold">
                                            {planetDetail.submitter?.username || 'anonymous'}
                                          </span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-text-secondary">Email:</span>
                                          <span className="text-text-primary font-semibold">
                                            {planetDetail.submitter?.email || 'N/A'}
                                          </span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-text-secondary">Submitter Role:</span>
                                          <span className="text-text-primary font-semibold uppercase">
                                            {planetDetail.submitter?.role || 'N/A'}
                                          </span>
                                        </div>
                                      </div>
                                    </div>

                                    {/* JSON payload dump */}
                                    <div className="space-y-2">
                                      <h4 className="font-bold text-xs uppercase tracking-wider text-text-muted border-b border-white/5 pb-2">
                                        Full Payload Audit Log
                                      </h4>
                                      <pre className="text-[10px] leading-tight text-accent bg-space-950 p-3 rounded-lg border border-white/5 overflow-x-auto max-h-40">
                                        {JSON.stringify(planetDetail.raw_input || {}, null, 2)}
                                      </pre>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="text-center text-xs text-text-muted">
                                  Failed to load parameters details.
                                </div>
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

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center px-4 font-mono text-sm">
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 1}
                className="px-3 py-1.5 rounded bg-white/5 border border-white/10 text-text-secondary hover:text-text-primary disabled:opacity-30 disabled:pointer-events-none transition-colors"
              >
                &larr; Previous
              </button>
              <span className="text-text-muted">
                Page <span className="text-text-primary font-semibold">{page}</span> of{' '}
                <span className="text-text-primary font-semibold">{totalPages}</span>
              </span>
              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={page === totalPages}
                className="px-3 py-1.5 rounded bg-white/5 border border-white/10 text-text-secondary hover:text-text-primary disabled:opacity-30 disabled:pointer-events-none transition-colors"
              >
                Next &rarr;
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
