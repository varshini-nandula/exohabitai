import { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { rankingsAPI } from '../api/rankings';
import { extractError } from '../api/client';
import GlassCard from '../components/GlassCard';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';

export default function RankingsPage() {
  const [loading, setLoading] = useState(true);
  const [planets, setPlanets] = useState([]);
  const [errorState, setErrorState] = useState(null);

  // Search, sorting, limit & pagination state
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('rank'); // 'rank' or 'probability'
  const [limit, setLimit] = useState('all'); // 10 | 20 | 30 | 50 | 'all'
  const [currentPage, setCurrentPage] = useState(1);
  const [reloadToken, setReloadToken] = useState(0);
  const itemsPerPage = 20;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setErrorState(null);
    const fetchRankings = async () => {
      try {
        const res = await rankingsAPI.getRankings(limit);
        if (active) {
          if (res.data?.status === 'success') {
            const planetData = res.data.data?.planets || [];
            // Ensure every planet has a valid rank index
            const normalized = planetData.map((p, idx) => ({
              ...p,
              rank: p.rank || idx + 1,
            }));
            setPlanets(normalized);
          } else {
            setErrorState({
              variant: 'generic',
              message: res.data?.message || 'Telescope catalog failed to compile.',
            });
          }
          setLoading(false);
        }
      } catch (err) {
        console.error('Telemetry rankings compile failure:', err);
        const extracted = extractError(err);
        if (active) {
          setErrorState({
            variant: !err.response ? 'offline' : 'generic',
            message: extracted,
          });
          setLoading(false);
        }
      }
    };

    fetchRankings();
    return () => {
      active = false;
    };
  }, [limit, reloadToken]);

  if (loading) {
    return <div className="site-container py-16"><LoadingSpinner message="Querying exoplanet rankings database..." /></div>;
  }

  if (errorState) {
    return (
      <div className="site-container py-16">
        <ErrorState
          variant={errorState.variant}
          message={errorState.message}
          onRetry={() => setReloadToken((t) => t + 1)}
        />
      </div>
    );
  }

  // Filter exoplanets
  const filteredPlanets = planets.filter((planet) =>
    (planet.planet_name || '')
      .toLowerCase()
      .includes(searchQuery.toLowerCase().trim())
  );

  // Sort exoplanets
  const sortedPlanets = [...filteredPlanets].sort((a, b) => {
    if (sortBy === 'probability') {
      return b.habitability_probability - a.habitability_probability;
    }
    return a.rank - b.rank; // Default rank asc
  });

  // Top 10 exoplanets for Recharts visualization
  const top10 = sortedPlanets.slice(0, 10).map((p) => ({
    name: p.planet_name,
    probability: parseFloat((p.habitability_probability * 100).toFixed(1)),
  }));

  // Pagination bounds
  const totalPages = Math.ceil(sortedPlanets.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedPlanets = sortedPlanets.slice(
    startIndex,
    startIndex + itemsPerPage
  );

  const handlePageChange = (pageNum) => {
    if (pageNum >= 1 && pageNum <= totalPages) {
      setCurrentPage(pageNum);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const getBarColor = (prob) => {
    if (prob < 30) return '#EF4444'; // Red
    if (prob < 50) return '#F59E0B'; // Orange
    if (prob < 75) return '#4F8CFF'; // Blue
    return '#22C55E'; // Green
  };

  // Custom Chart Tooltip
  const CustomChartTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="p-3 border border-white/10 rounded-lg backdrop-blur-md bg-space-800 text-xs font-mono">
          <p className="font-bold text-text-primary mb-1">{data.name}</p>
          <p className="text-accent">Probability: {data.probability}%</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="site-container section-padding flex flex-col" style={{ gap: '56px' }}>
      {/* PAGE HEADER */}
      <div className="page-header">
        <span className="page-eyebrow text-primary">Observatory Archives Catalog</span>
        <h1 className="font-mono">Exoplanet Habitability Rankings</h1>
        <p>
          Examine the compiled registry of exoplanets classified by their computed habitability indexes.
        </p>
      </div>

      {/* TOP 10 CHART VISUALIZATION */}
      {top10.length > 0 && (
        <section className="w-full">
          <GlassCard glow={true} variant="raised" className="flex flex-col gap-7 w-full p-10">
            <span className="font-mono text-xs font-semibold text-accent uppercase tracking-wider">
              Telemetry Chart: Top 10 Habitable Candidates
            </span>
            <div className="h-64 sm:h-80 w-full mt-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={top10} margin={{ top: 10, right: 10, left: -25, bottom: 20 }}>
                  <XAxis
                    dataKey="name"
                    tick={{ fill: '#94A3B8', fontSize: 10, fontFamily: 'monospace' }}
                    axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                    tickLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                    interval={0}
                    angle={-25}
                    textAnchor="end"
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fill: '#94A3B8', fontSize: 10, fontFamily: 'monospace' }}
                    axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                    tickLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                  />
                  <RechartsTooltip content={<CustomChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                  <Bar dataKey="probability" radius={[4, 4, 0, 0]} maxBarSize={45}>
                    {top10.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getBarColor(entry.probability)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        </section>
      )}

      {/* FILTER & EXPLORER CONTROLS */}
      <section>
        <GlassCard variant="raised" className="flex flex-col md:flex-row gap-6 items-center justify-between p-8">
          {/* Search */}
          <div className="relative w-full md:max-w-md">
            <span className="absolute inset-y-0 left-3 flex items-center text-text-muted">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="text"
              className="pl-9 w-full font-mono text-xs py-2.5"
              placeholder="Search candidate name..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1); // Reset page on filter
              }}
            />
          </div>

          {/* Show Top-N + Sorting selection */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-end flex-wrap">
            <span className="font-mono text-xs text-text-secondary select-none uppercase font-semibold whitespace-nowrap">
              Show:
            </span>
            <select
              className="font-mono text-xs max-w-[160px] py-2.5 px-4 rounded-lg"
              value={limit}
              onChange={(e) => {
                setLimit(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="10">Top 10</option>
              <option value="20">Top 20</option>
              <option value="30">Top 30</option>
              <option value="50">Top 50</option>
              <option value="all">All Candidates</option>
            </select>

            <span className="font-mono text-xs text-text-secondary select-none uppercase font-semibold whitespace-nowrap">
              Sort:
            </span>
            <select
              className="font-mono text-xs max-w-[200px] py-2.5 px-4 rounded-lg"
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="rank">Database Rank (Asc)</option>
              <option value="probability">Habitability Prob. (Desc)</option>
            </select>
          </div>
        </GlassCard>
      </section>

      {/* DATA GRID & LIST CARD SECTION */}
      {paginatedPlanets.length > 0 ? (
        <section className="flex flex-col gap-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {paginatedPlanets.map((planet, index) => {
              const probPercent = (planet.habitability_probability * 100).toFixed(1);
              const numProb = parseFloat(probPercent);
              const color = getBarColor(numProb);

              return (
                <GlassCard
                  key={planet.planet_name || index}
                  hoverable={true}
                  className="flex items-center gap-6 py-6 px-8 relative overflow-hidden"
                >
                  {/* Dynamic background line */}
                  <div
                    className="absolute bottom-0 left-0 h-0.5 transition-all opacity-60"
                    style={{ width: `${probPercent}%`, backgroundColor: color }}
                  />

                  {/* Rank Badge */}
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center font-mono font-bold text-xs border shrink-0 text-text-primary"
                    style={{
                      borderColor: `${color}30`,
                      background: `${color}10`,
                    }}
                  >
                    #{planet.rank}
                  </div>

                  {/* Planet Details */}
                  <div className="flex-grow min-w-0">
                    <h4 className="font-bold text-sm font-mono text-text-primary truncate mb-3">
                      {planet.planet_name}
                    </h4>
                    {/* Compact probability progress line */}
                    <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-1000"
                        style={{ width: `${probPercent}%`, backgroundColor: color }}
                      />
                    </div>
                  </div>

                  {/* Percentage score */}
                  <div className="text-right shrink-0 pl-4">
                    <span
                      className="font-bold font-mono text-sm"
                      style={{ color: color }}
                    >
                      {probPercent}%
                    </span>
                    <div className="text-[9px] font-mono uppercase text-text-muted mt-1">
                      Prob
                    </div>
                  </div>
                </GlassCard>
              );
            })}
          </div>

          {/* PAGINATION NAVIGATION CONTROLS */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-4 font-mono text-xs">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="btn-secondary py-2.5 px-4 border-white/5 rounded-xl disabled:opacity-30 disabled:pointer-events-none text-xs"
              >
                ◀ Prev
              </button>

              <span className="text-text-secondary select-none px-3 py-2 rounded-xl bg-white/5 border border-white/5">
                Sector <strong className="text-text-primary">{currentPage}</strong> of{' '}
                <strong className="text-text-primary">{totalPages}</strong>
              </span>

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="btn-secondary py-2.5 px-4 border-white/5 rounded-xl disabled:opacity-30 disabled:pointer-events-none text-xs"
              >
                Next ▶
              </button>
            </div>
          )}
        </section>
      ) : (
        <EmptyState
          title="Telemetry Archive Sector Empty"
          description={`No recorded exoplanets found in search registry for "${searchQuery}". Try updating queries.`}
          actionLabel="Clear Search Filter"
          onAction={() => setSearchQuery('')}
        />
      )}
    </div>
  );
}
