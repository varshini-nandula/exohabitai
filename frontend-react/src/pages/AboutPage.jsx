import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { statsAPI } from '../api/stats';
import GlassCard from '../components/GlassCard';
import LoadingSpinner from '../components/LoadingSpinner';

export default function AboutPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    let active = true;
    const fetchStats = async () => {
      try {
        const res = await statsAPI.getStats();
        if (active) {
          setStats(res.data?.data || null);
          setLoading(false);
        }
      } catch (err) {
        console.error('Stats fetch error:', err);
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchStats();
    return () => {
      active = false;
    };
  }, []);

  const containerVariants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: 0.12,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 25 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: 'spring', stiffness: 50, damping: 15 },
    },
  };

  const capabilities = [
    {
      icon: '🎯',
      title: 'Habitability Classification',
      description: 'Multi-parametric machine learning model assessing planetary size, thermal equilibrium, host star radiation, and atmospheric retention capacity.',
      badge: 'Core ML',
      badgeColor: 'text-primary border-primary/20 bg-primary/10',
    },
    {
      icon: '⚡',
      title: 'Smart Imputation Engine',
      description: 'Handles observational gaps in astronomical survey data using domain-informed astrophysically constrained missing-data strategies.',
      badge: 'Data Pipeline',
      badgeColor: 'text-accent border-accent/20 bg-accent/10',
    },
    {
      icon: '📊',
      title: 'Curated Observatory Rankings',
      description: 'Continuously updated leaderboard ranking confirmed and candidate exoplanets by calculated habitability probability index.',
      badge: 'Exploration',
      badgeColor: 'text-highlight border-highlight/20 bg-highlight/10',
    },
    {
      icon: '🔭',
      title: 'Exoplanet Preset Library',
      description: 'Instant benchmarks against iconic worlds like Kepler-442b, TRAPPIST-1e, and Proxima Centauri b alongside archetype archetypes.',
      badge: 'Reference',
      badgeColor: 'text-success border-success/20 bg-success/10',
    },
    {
      icon: '🌌',
      title: 'Community Catalog Submissions',
      description: 'Allows researchers and space enthusiasts to propose custom orbital configurations with automated AI peer verification.',
      badge: 'Research',
      badgeColor: 'text-accent border-accent/20 bg-accent/10',
    },
    {
      icon: '🛡️',
      title: 'Secure Scientific History',
      description: 'Authenticated personal workspace to track, revisit, and compare individual planetary evaluations over time.',
      badge: 'Workspace',
      badgeColor: 'text-primary border-primary/20 bg-primary/10',
    },
  ];

  const totalPlanetsDisplay = stats?.total_planets && stats.total_planets > 0
    ? stats.total_planets.toLocaleString()
    : '6,000+';

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      {/* ============================================================
          PAGE HEADER
          ============================================================ */}
      <section className="section-padding" style={{ paddingBottom: '0' }}>
        <div className="site-container">
          <motion.div variants={itemVariants} className="page-header" style={{ marginBottom: '0' }}>
            <span className="page-eyebrow text-accent border border-accent/20 bg-accent/5 px-4 py-1.5 rounded-full inline-block">
              About the Platform
            </span>
            <h1>
              <span className="bg-gradient-to-r from-primary via-[#89B4FF] to-accent bg-clip-text text-transparent">
                The Science Behind ExoHabitAI
              </span>
            </h1>
            <p>
              Bridging observational astrophysics and machine learning to evaluate the habitable potential of worlds beyond our Solar System.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Section Divider */}
      <div className="section-divider" style={{ marginTop: '64px' }} />

      {/* ============================================================
          SCIENTIFIC FOUNDATION & ML ARCHITECTURE
          ============================================================ */}
      <section className="section-padding">
        <div className="site-container">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
            {/* Dataset credibility section */}
            <motion.div variants={itemVariants} className="lg:col-span-7 flex flex-col justify-between">
              <GlassCard glow={true} variant="raised" className="h-full flex flex-col justify-between gap-8 p-7 sm:p-9 md:p-11">
                <div>
                  <span className="text-xs font-semibold text-primary tracking-wider uppercase">
                    SCIENTIFIC FOUNDATION
                  </span>
                  <h3 className="text-xl sm:text-2xl font-bold text-text-primary mt-4">
                    PHL Exoplanet Catalog & NASA Archive
                  </h3>
                  <p className="text-sm text-text-secondary mt-4 leading-relaxed" style={{ lineHeight: '1.8' }}>
                    ExoHabitAI is trained on rigorously curated exoplanet datasets from the <strong>Planetary Habitability Laboratory (PHL)</strong> at UPR Arecibo and the <strong>NASA Exoplanet Archive</strong>. Our models evaluate key astrophysical parameters to estimate whether an exoplanet could maintain liquid water on its surface under an Earth-like atmosphere.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6 mt-8">
                    <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col gap-2.5">
                      <span className="text-[10px] text-text-muted uppercase font-semibold tracking-wider">
                        Cataloged Worlds
                      </span>
                      <span className="text-3xl font-bold font-mono text-accent">
                        {loading ? '...' : totalPlanetsDisplay}
                      </span>
                      <span className="text-xs text-text-muted">Confirmed & candidate planets</span>
                    </div>
                    <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col gap-2.5">
                      <span className="text-[10px] text-text-muted uppercase font-semibold tracking-wider">
                        Core Feature Vector
                      </span>
                      <span className="text-3xl font-bold font-mono text-primary">
                        9+ Dimensions
                      </span>
                      <span className="text-xs text-text-muted">Planetary & stellar metrics</span>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-white/5 text-xs text-text-muted leading-relaxed" style={{ lineHeight: '1.75' }}>
                  <strong className="text-text-secondary">Primary Evaluated Dimensions:</strong> Planet Radius (R⊕), Mass (M⊕), Mean Density, Equilibrium Temperature (K), Semi-Major Axis (AU), Orbital Period (days), Stellar Luminosity (L☉), Stellar Effective Temperature (K), and Metallicity ([Fe/H]).
                </div>
              </GlassCard>
            </motion.div>

            {/* Methodology & Model Architecture card */}
            <motion.div variants={itemVariants} className="lg:col-span-5">
              <GlassCard glow={true} hoverable={false} variant="raised" className="h-full flex flex-col justify-between gap-8 border-accent/20 p-7 sm:p-9 md:p-11">
                <div>
                  <span className="text-xs font-semibold text-accent tracking-wider uppercase flex items-center gap-2">
                    <span className="inline-block w-2 h-2 rounded-full bg-accent animate-pulse" />
                    AI MODEL ARCHITECTURE
                  </span>
                  <h3 className="text-xl sm:text-2xl font-bold text-text-primary mt-4">
                    Random Forest Ensemble
                  </h3>

                  <div className="flex flex-col gap-4 mt-6 text-xs text-text-secondary">
                    <div className="p-5 rounded-xl bg-white/[0.03] border border-white/5">
                      <span className="font-semibold text-text-primary block mb-1.5 text-sm">Ensemble Decision Trees</span>
                      <p className="text-xs leading-relaxed text-text-muted">
                        Utilizes an ensemble of uncorrelated decision trees to capture non-linear relationships between stellar radiation and planetary retention.
                      </p>
                    </div>

                    <div className="p-5 rounded-xl bg-white/[0.03] border border-white/5">
                      <span className="font-semibold text-text-primary block mb-1.5 text-sm">Astrophysical Imputation</span>
                      <p className="text-xs leading-relaxed text-text-muted">
                        Automatically derives missing physical quantities using Keplerian mechanics and empirical mass-radius relations when telescope data is incomplete.
                      </p>
                    </div>

                    <div className="p-5 rounded-xl bg-white/[0.03] border border-white/5">
                      <span className="font-semibold text-text-primary block mb-1.5 text-sm">Calibrated Probabilities</span>
                      <p className="text-xs leading-relaxed text-text-muted">
                        Outputs calibrated habitability probability scores from 0% to 100%, with 50% representing the standard threshold for potential habitability.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="text-xs text-text-muted text-center pt-4 border-t border-white/5">
                  Trained & validated against peer-reviewed exoplanetary baselines.
                </div>
              </GlassCard>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Section Divider */}
      <div className="section-divider" />

      {/* ============================================================
          PLATFORM CAPABILITIES — Static Glass Cards
          ============================================================ */}
      <section className="section-padding">
        <div className="site-container flex flex-col items-center">
          <div className="section-header">
            <span className="page-eyebrow text-primary">Capabilities</span>
            <h2>Platform Capabilities</h2>
            <p>
              Comprehensive tools designed for researchers, students, and space enthusiasts.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 w-full">
            {capabilities.map((cap, i) => (
              <GlassCard
                key={i}
                hoverable={true}
                className="flex flex-col justify-between p-7 sm:p-8 gap-6"
              >
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <span className="text-3xl">{cap.icon}</span>
                    <span className={`text-[10px] font-semibold uppercase tracking-wider px-3 py-1 rounded-full border ${cap.badgeColor}`}>
                      {cap.badge}
                    </span>
                  </div>
                  <h4 className="font-bold text-text-primary text-base mb-2.5">{cap.title}</h4>
                  <p className="text-xs text-text-secondary leading-relaxed" style={{ lineHeight: '1.75' }}>
                    {cap.description}
                  </p>
                </div>
              </GlassCard>
            ))}
          </div>
        </div>
      </section>

      {/* Section Divider */}
      <div className="section-divider" />

      {/* ============================================================
          SCIENTIFIC LIMITATIONS & DISCLAIMER
          ============================================================ */}
      <section className="section-padding">
        <div className="site-container">
          <GlassCard variant="raised" className="p-7 sm:p-9 md:p-11 border-white/10">
            <div className="flex flex-col md:flex-row gap-6 sm:gap-8 items-start">
              <div className="w-12 sm:w-14 h-12 sm:h-14 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent text-2xl shrink-0">
                🔭
              </div>
              <div className="flex flex-col gap-4">
                <h3 className="text-lg sm:text-xl font-bold text-text-primary">
                  Understanding Habitability Scores & Astronomical Limitations
                </h3>
                <p className="text-xs sm:text-sm text-text-secondary leading-relaxed" style={{ lineHeight: '1.8' }}>
                  <strong>Habitable Zone ≠ Inhabited:</strong> A high habitability score indicates that a planet possesses physical, thermal, and orbital characteristics compatible with liquid surface water under standard atmospheric assumptions. It is <em>not</em> confirmation of extraterrestrial life or a breathable atmosphere.
                </p>
                <p className="text-xs sm:text-sm text-text-secondary leading-relaxed" style={{ lineHeight: '1.8' }}>
                  <strong>Observational Uncertainty:</strong> Many exoplanetary parameters are estimated via transit photometry or radial velocity measurements and carry observational margins of error. ExoHabitAI provides a probabilistic framework to prioritize candidates for upcoming spectroscopic follow-up (such as the James Webb Space Telescope and future ARIEL missions).
                </p>
              </div>
            </div>
          </GlassCard>
        </div>
      </section>

      {/* ============================================================
          CALL TO ACTION
          ============================================================ */}
      <section className="section-padding pt-0">
        <div className="site-container">
          <GlassCard glow={true} className="p-8 sm:p-12 md:p-16 text-center flex flex-col items-center gap-6 sm:gap-8 border-primary/20 bg-gradient-to-b from-space-800/80 to-space-900/90">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-text-primary">
              Ready to Explore Candidate Worlds?
            </h2>
            <p className="text-sm sm:text-base text-text-secondary max-w-xl leading-relaxed">
              Input custom planetary parameters to run an instant AI evaluation, or browse the leaderboard of top-ranked exoplanets.
            </p>
            <div className="flex flex-wrap gap-4 justify-center mt-2">
              <Link to="/predict" className="btn-primary px-8 py-3.5 text-sm font-semibold shadow-[0_0_25px_rgba(79,140,255,0.3)]">
                Predict Habitability →
              </Link>
              <Link to="/rankings" className="btn-secondary px-8 py-3.5 text-sm font-semibold border-white/10 bg-white/5">
                Explore Rankings
              </Link>
            </div>
          </GlassCard>
        </div>
      </section>
    </motion.div>
  );
}

