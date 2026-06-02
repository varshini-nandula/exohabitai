import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { statsAPI } from '../api/stats';
import GlassCard from '../components/GlassCard';
import StatCard from '../components/StatCard';
import LoadingSpinner from '../components/LoadingSpinner';

export default function HomePage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [health, setHealth] = useState(null);
  const [retraining, setRetraining] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    const fetchHomeTelemetry = async () => {
      try {
        const [statsRes, healthRes, retrainRes] = await Promise.all([
          statsAPI.getStats(),
          statsAPI.getHealth(),
          statsAPI.getRetrainingStatus(),
        ]);

        if (active) {
          setStats(statsRes.data?.data || null);
          setHealth(healthRes.data?.data || null);
          setRetraining(retrainRes.data?.data || null);
          setLoading(false);
        }
      } catch (err) {
        console.error('Telemetry fetch error on homepage:', err);
        if (active) {
          setError(true);
          setLoading(false);
        }
      }
    };

    fetchHomeTelemetry();
    return () => {
      active = false;
    };
  }, []);

  const containerVariants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: 0.15,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: 'spring', stiffness: 50, damping: 15 },
    },
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      {/* ============================================================
          HERO SECTION — Full-width background, centered content
          ============================================================ */}
      <section className="relative overflow-visible">
        {/* Full-width background glow effects */}
        <div className="absolute top-20 right-1/4 w-[400px] h-[400px] rounded-full bg-gradient-to-tr from-primary/10 to-accent/5 filter blur-[120px] -z-10 animate-pulse" />
        <div className="absolute bottom-0 left-[10%] w-[500px] h-[500px] rounded-full bg-gradient-to-br from-highlight/8 to-transparent filter blur-[120px] -z-10" />

        <div className="site-container flex flex-col items-center justify-center text-center min-h-[80vh]"
             style={{ paddingTop: 'var(--space-4xl)', paddingBottom: 'var(--space-3xl)' }}>
          <motion.div variants={itemVariants} className="flex flex-col items-center max-w-[720px]">
            {/* Badge */}
            <span className="font-mono text-xs md:text-sm font-semibold tracking-[0.3em] uppercase text-accent mb-5 border border-accent/20 bg-accent/5 px-4 py-1.5 rounded-full">
              Machine Learning System
            </span>

            {/* Title — 24px gap from badge */}
            <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight mb-7">
              <span className="bg-gradient-to-r from-primary via-[#89B4FF] to-accent bg-clip-text text-transparent">
                ExoHabitAI
              </span>
            </h1>

            {/* Description — 28px gap from title */}
            <p className="max-w-[600px] text-base sm:text-lg md:text-xl text-text-secondary leading-relaxed mb-10">
              A production-oriented machine learning observatory predicting the habitability of distant worlds using Random Forest classification models.
            </p>
          </motion.div>

          {/* CTA Buttons — 40px gap from description */}
          <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/predict"
              className="btn-primary px-10 py-4 shadow-[0_0_30px_rgba(79,140,255,0.35)] inline-flex items-center justify-center text-center min-w-[200px]"
            >
              Predict Habitability
            </Link>
            <Link
              to="/rankings"
              className="btn-secondary px-10 py-4 border-white/15 inline-flex items-center justify-center text-center min-w-[200px]"
            >
              Explore Rankings
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Section Divider */}
      <div className="section-divider" />

      {/* ============================================================
          EXPLORATION PIPELINE — How it works
          ============================================================ */}
      <section className="section-padding">
        <div className="site-container flex flex-col items-center">
          {/* Section header — centered */}
          <div className="text-center max-w-[600px] mb-12 md:mb-16">
            <h2 className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-text-primary">
              EXPLORATION PIPELINE
            </h2>
            <p className="text-sm sm:text-base text-text-secondary mt-3 leading-relaxed">
              The four-stage telemetry pipeline deployed to evaluate exoplanet candidates.
            </p>
          </div>

          {/* Cards grid — constrained width for tighter grouping */}
          <motion.div
            variants={containerVariants}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8 w-full max-w-5xl"
          >
            {/* Step 1 */}
            <GlassCard animate={true} delay={0.1} className="flex flex-col gap-5 relative group overflow-hidden h-full min-h-[280px] p-8 justify-between">
              <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full filter blur-xl group-hover:bg-primary/10 transition-colors" />
              <div className="w-11 h-11 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center font-bold font-mono text-primary select-none shrink-0">
                01
              </div>
              <div className="flex flex-col gap-2.5 mt-auto">
                <h3 className="font-bold text-base font-mono text-text-primary">Enter Telemetry</h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Supply planet properties, orbital mechanics, and host star attributes into our telemetry modules.
                </p>
              </div>
            </GlassCard>

            {/* Step 2 */}
            <GlassCard animate={true} delay={0.2} className="flex flex-col gap-5 relative group overflow-hidden h-full min-h-[280px] p-8 justify-between">
              <div className="absolute top-0 right-0 w-24 h-24 bg-accent/5 rounded-full filter blur-xl group-hover:bg-accent/10 transition-colors" />
              <div className="w-11 h-11 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center font-bold font-mono text-accent select-none shrink-0">
                02
              </div>
              <div className="flex flex-col gap-2.5 mt-auto">
                <h3 className="font-bold text-base font-mono text-text-primary">ML Evaluation</h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Random Forest classifier parses stellar temperatures, planet masses, density ratios, and radiation indices.
                </p>
              </div>
            </GlassCard>

            {/* Step 3 */}
            <GlassCard animate={true} delay={0.3} className="flex flex-col gap-5 relative group overflow-hidden h-full min-h-[280px] p-8 justify-between">
              <div className="absolute top-0 right-0 w-24 h-24 bg-highlight/5 rounded-full filter blur-xl group-hover:bg-highlight/10 transition-colors" />
              <div className="w-11 h-11 rounded-lg bg-highlight/10 border border-highlight/20 flex items-center justify-center font-bold font-mono text-highlight select-none shrink-0">
                03
              </div>
              <div className="flex flex-col gap-2.5 mt-auto">
                <h3 className="font-bold text-base font-mono text-text-primary">Habitability Score</h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Receive a calculated probability score verified against a classification boundary threshold of 50%.
                </p>
              </div>
            </GlassCard>

            {/* Step 4 */}
            <GlassCard animate={true} delay={0.4} className="flex flex-col gap-5 relative group overflow-hidden h-full min-h-[280px] p-8 justify-between">
              <div className="absolute top-0 right-0 w-24 h-24 bg-success/5 rounded-full filter blur-xl group-hover:bg-success/10 transition-colors" />
              <div className="w-11 h-11 rounded-lg bg-success/10 border border-success/20 flex items-center justify-center font-bold font-mono text-success select-none shrink-0">
                04
              </div>
              <div className="flex flex-col gap-2.5 mt-auto">
                <h3 className="font-bold text-base font-mono text-text-primary">Observatory Logs</h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Registered astronavigators can store confirmed candidates inside the rankings and system archives.
                </p>
              </div>
            </GlassCard>
          </motion.div>
        </div>
      </section>

      {/* Section Divider */}
      <div className="section-divider" />

      {/* ============================================================
          DATA & CONTROL PANEL — Two-column layout
          ============================================================ */}
      <section className="section-padding">
        <div className="site-container">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            {/* Dataset credibility section */}
            <motion.div variants={itemVariants} className="lg:col-span-7 flex flex-col justify-between">
              <GlassCard glow={true} className="h-full flex flex-col justify-between gap-6">
                <div>
                  <span className="font-mono text-xs font-semibold text-primary tracking-wider uppercase">
                    SCIENTIFIC FOUNDATION
                  </span>
                  <h3 className="text-xl font-bold font-mono text-text-primary mt-3">
                    PHL Exoplanet Catalog Archive
                  </h3>
                  <p className="text-sm text-text-secondary leading-relaxed mt-4">
                    Our classification networks are trained on verified data curated by the Planetary Habitability Laboratory (PHL) at UPR Arecibo.
                  </p>
                  <div className="grid grid-cols-2 gap-4 mt-6">
                    <div className="p-4 rounded-xl bg-white/5 border border-white/5 flex flex-col gap-1">
                      <span className="text-[10px] text-text-muted font-mono uppercase font-semibold">
                        Catalog Records
                      </span>
                      <span className="text-lg font-bold font-mono text-accent">
                        {stats ? stats.total_planets.toLocaleString() : '6,000+'}
                      </span>
                    </div>
                    <div className="p-4 rounded-xl bg-white/5 border border-white/5 flex flex-col gap-1">
                      <span className="text-[10px] text-text-muted font-mono uppercase font-semibold">
                        Parameters Loaded
                      </span>
                      <span className="text-lg font-bold font-mono text-accent">
                        9 Dimensions
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-white/5 text-xs text-text-muted leading-relaxed">
                  <strong>Dataset Attributes Evaluated:</strong> Planet Radius, Planet Mass, Stellar Temperature, Semi-Major Axis, Stellar Luminosity, Orbital Period, Planet Density, Planet Surface Temperature, Stellar Metallicity.
                </div>
              </GlassCard>
            </motion.div>

            {/* Model Status control panel */}
            <motion.div variants={itemVariants} className="lg:col-span-5">
              <GlassCard glow={true} hoverable={false} className="h-full flex flex-col justify-between gap-6 border-accent/20 bg-space-800/40">
                <div>
                  <span className="font-mono text-xs font-semibold text-accent tracking-wider uppercase flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${error ? 'bg-danger' : 'bg-success'}`}></span>
                      <span className={`relative inline-flex rounded-full h-2 w-2 ${error ? 'bg-danger' : 'bg-success'}`}></span>
                    </span>
                    Observatory Telemetry Status
                  </span>
                  <h3 className="text-xl font-bold font-mono text-text-primary mt-3">
                    Mainframe Control Panel
                  </h3>

                  {loading ? (
                    <div className="py-8">
                      <LoadingSpinner message="Querying satellite dish..." size="sm" />
                    </div>
                  ) : error ? (
                    <div className="flex flex-col gap-3 py-6">
                      <div className="text-xs text-danger font-mono bg-danger/10 border border-danger/25 p-3 rounded-lg leading-relaxed">
                        MAIN FRAME OFFLINE: Unable to contact telemetry servers. Falling back to local satellite mode.
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4 mt-6 font-mono text-xs text-text-secondary">
                      <div className="flex justify-between items-center py-2.5 border-b border-white/5">
                        <span>Model Engine</span>
                        <span className="text-text-primary font-semibold">Random Forest</span>
                      </div>
                      <div className="flex justify-between items-center py-2.5 border-b border-white/5">
                        <span>Version</span>
                        <span className="text-text-primary font-semibold">
                          {health?.model_version || 'v1.0.0'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2.5 border-b border-white/5">
                        <span>Database Connection</span>
                        <span className={health?.db_connected ? 'text-success font-semibold' : 'text-danger font-semibold'}>
                          {health?.db_connected ? 'ACTIVE' : 'OFFLINE'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2.5 border-b border-white/5">
                        <span>Retraining State</span>
                        <span className={retraining?.is_running ? 'text-warning font-semibold animate-pulse' : 'text-text-muted font-semibold'}>
                          {retraining?.is_running ? 'RUNNING' : 'STANDBY'}
                        </span>
                      </div>
                      {retraining?.last_completed && (
                        <div className="flex justify-between items-center py-2.5 border-b border-white/5">
                          <span>Last Engine Calibr.</span>
                          <span className="text-text-primary text-[10px]">
                            {new Date(retraining.last_completed).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="text-[10px] text-text-muted font-mono text-center pt-2">
                  SATELLITE INTERFEROMETRY SYSTEM ONBOARD & ACTIVE.
                </div>
              </GlassCard>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Section Divider */}
      <div className="section-divider" />

      {/* ============================================================
          PLATFORM CAPABILITIES — Feature cards
          ============================================================ */}
      <section className="section-padding">
        <div className="site-container flex flex-col items-center">
          {/* Section header — centered */}
          <div className="text-center max-w-[600px] mb-12 md:mb-16">
            <h2 className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-text-primary">
              PLATFORM CAPABILITIES
            </h2>
            <p className="text-sm sm:text-base text-text-secondary mt-3 leading-relaxed">
              Professional analytics and data recording instruments deployed at your command.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 w-full">
            <GlassCard className="flex flex-col gap-4 p-8">
              <div className="text-2xl">🎯</div>
              <h4 className="font-bold font-mono text-text-primary">Prediction Engine</h4>
              <p className="text-xs text-text-secondary leading-relaxed">
                Real-time classification based on specific exoplanetary physical dimensions, stellar properties, and orbit.
              </p>
            </GlassCard>

            <GlassCard className="flex flex-col gap-4 p-8">
              <div className="text-2xl">⚡</div>
              <h4 className="font-bold font-mono text-text-primary">Adaptive Batch Mode</h4>
              <p className="text-xs text-text-secondary leading-relaxed">
                Batch prediction capabilities integrated seamlessly, allowing swift analysis of multiple space systems.
              </p>
            </GlassCard>

            <GlassCard className="flex flex-col gap-4 p-8">
              <div className="text-2xl">📊</div>
              <h4 className="font-bold font-mono text-text-primary">Observation Rankings</h4>
              <p className="text-xs text-text-secondary leading-relaxed">
                Interactive rankings compiled from database queries. Filters exoplanets sorted by habitability probability.
              </p>
            </GlassCard>

            <GlassCard className="flex flex-col gap-4 p-8">
              <div className="text-2xl">⏳</div>
              <h4 className="font-bold font-mono text-text-primary">Telemetry Retraining</h4>
              <p className="text-xs text-text-secondary leading-relaxed">
                Continuous optimization module enabling the core Random Forest models to adapt as the database grows.
              </p>
            </GlassCard>

            <GlassCard className="flex flex-col gap-4 p-8">
              <div className="text-2xl">🛡️</div>
              <h4 className="font-bold font-mono text-text-primary">Secure Mainframe JWT</h4>
              <p className="text-xs text-text-secondary leading-relaxed">
                Role-based web access using authenticated JSON Web Token structures to lock down database writing access.
              </p>
            </GlassCard>

            <GlassCard className="flex flex-col gap-4 p-8">
              <div className="text-2xl">🛰️</div>
              <h4 className="font-bold font-mono text-text-primary">Add Candidate Planets</h4>
              <p className="text-xs text-text-secondary leading-relaxed">
                Submit newly charted candidates to the repository catalog database for future retraining cycles.
              </p>
            </GlassCard>
          </div>
        </div>
      </section>

      {/* Section Divider */}
      <div className="section-divider" />

      {/* ============================================================
          MODEL STATS — Academic validation
          ============================================================ */}
      <section className="section-padding">
        <div className="site-container flex flex-col items-center">
          {/* Section header — centered */}
          <div className="text-center max-w-[600px] mb-10 md:mb-14">
            <span className="font-mono text-[10px] tracking-widest text-text-muted uppercase font-bold">
              Academic Validation Logs
            </span>
            <h3 className="text-xl sm:text-2xl font-bold font-mono text-text-primary mt-2">
              Random Forest Performance Summary
            </h3>
            <p className="text-xs sm:text-sm text-text-secondary mt-2 leading-relaxed">
              Historical validation results logged on model build, trained on a split of the catalog database.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-5 md:gap-6 w-full max-w-4xl">
            <StatCard label="Model F1 Score" value="0.94" decimals={2} suffix="" delay={0.1} />
            <StatCard label="Model ROC-AUC" value="0.985" decimals={3} suffix="" delay={0.2} />
            <StatCard label="Model PR-AUC" value="0.979" decimals={3} suffix="" delay={0.3} />
            <StatCard label="Cross Validation" value="96.2" decimals={1} suffix="%" delay={0.4} />
          </div>
        </div>
      </section>
    </motion.div>
  );
}
