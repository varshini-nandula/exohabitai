import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { statsAPI } from '../api/stats';
import GlassCard from '../components/GlassCard';
import FlipCard from '../components/FlipCard';
import LoadingSpinner from '../components/LoadingSpinner';

export default function AboutPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [health, setHealth] = useState(null);
  const [retraining, setRetraining] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    const fetchTelemetry = async () => {
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
        console.error('Telemetry fetch error on about page:', err);
        if (active) {
          setError(true);
          setLoading(false);
        }
      }
    };

    fetchTelemetry();
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

  const capabilities = [
    {
      icon: '🎯',
      title: 'Prediction Engine',
      description: 'Real-time classification based on specific exoplanetary physical dimensions, stellar properties, and orbit.',
    },
    {
      icon: '⚡',
      title: 'Adaptive Batch Mode',
      description: 'Batch prediction capabilities integrated seamlessly, allowing swift analysis of multiple space systems.',
    },
    {
      icon: '📊',
      title: 'Observation Rankings',
      description: 'Interactive rankings compiled from database queries. Filters exoplanets sorted by habitability probability.',
    },
    {
      icon: '⏳',
      title: 'Telemetry Retraining',
      description: 'Continuous optimization module enabling the core Random Forest models to adapt as the database grows.',
    },
    {
      icon: '🛡️',
      title: 'Secure Mainframe JWT',
      description: 'Role-based web access using authenticated JSON Web Token structures to lock down database writing access.',
    },
    {
      icon: '🛰️',
      title: 'Add Candidate Planets',
      description: 'Submit newly charted candidates to the repository catalog database for future retraining cycles.',
    },
  ];

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
              Behind the System
            </span>
            <h1>
              <span className="bg-gradient-to-r from-primary via-[#89B4FF] to-accent bg-clip-text text-transparent">
                About ExoHabitAI
              </span>
            </h1>
            <p>
              Explore the technical infrastructure, platform capabilities, and live system telemetry powering our habitability predictions.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Section Divider */}
      <div className="section-divider" style={{ marginTop: '64px' }} />

      {/* ============================================================
          OBSERVATORY TELEMETRY STATUS
          ============================================================ */}
      <section className="section-padding">
        <div className="site-container">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            {/* Dataset credibility section */}
            <motion.div variants={itemVariants} className="lg:col-span-7 flex flex-col justify-between">
              <GlassCard glow={true} variant="raised" className="h-full flex flex-col justify-between gap-6 p-8">
                <div>
                  <span className="font-mono text-xs font-semibold text-primary tracking-wider uppercase">
                    SCIENTIFIC FOUNDATION
                  </span>
                  <h3 className="text-xl font-bold font-mono text-text-primary mt-4">
                    PHL Exoplanet Catalog Archive
                  </h3>
                  <p className="text-sm text-text-secondary mt-4" style={{ lineHeight: '1.7', maxWidth: '50ch' }}>
                    Our classification networks are trained on verified data curated by the Planetary Habitability Laboratory (PHL) at UPR Arecibo.
                  </p>
                  <div className="grid grid-cols-2 gap-5 mt-8">
                    <div className="p-5 rounded-xl bg-white/5 border border-white/5 flex flex-col gap-2">
                      <span className="text-[10px] text-text-muted font-mono uppercase font-semibold">
                        Catalog Records
                      </span>
                      <span className="text-lg font-bold font-mono text-accent">
                        {stats ? stats.total_planets.toLocaleString() : '6,000+'}
                      </span>
                    </div>
                    <div className="p-5 rounded-xl bg-white/5 border border-white/5 flex flex-col gap-2">
                      <span className="text-[10px] text-text-muted font-mono uppercase font-semibold">
                        Parameters Loaded
                      </span>
                      <span className="text-lg font-bold font-mono text-accent">
                        9 Dimensions
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-white/5 text-xs text-text-muted leading-relaxed" style={{ lineHeight: '1.7' }}>
                  <strong>Dataset Attributes Evaluated:</strong> Planet Radius, Planet Mass, Stellar Temperature, Semi-Major Axis, Stellar Luminosity, Orbital Period, Planet Density, Planet Surface Temperature, Stellar Metallicity.
                </div>
              </GlassCard>
            </motion.div>

            {/* Model Status control panel */}
            <motion.div variants={itemVariants} className="lg:col-span-5">
              <GlassCard glow={true} hoverable={false} variant="raised" className="h-full flex flex-col justify-between gap-6 border-accent/20 p-8">
                <div>
                  <span className="font-mono text-xs font-semibold text-accent tracking-wider uppercase flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${error ? 'bg-danger' : 'bg-success'}`}></span>
                      <span className={`relative inline-flex rounded-full h-2 w-2 ${error ? 'bg-danger' : 'bg-success'}`}></span>
                    </span>
                    Observatory Telemetry Status
                  </span>
                  <h3 className="text-xl font-bold font-mono text-text-primary mt-4">
                    Mainframe Control Panel
                  </h3>

                  {loading ? (
                    <div className="py-8">
                      <LoadingSpinner message="Querying satellite dish..." size="sm" />
                    </div>
                  ) : error ? (
                    <div className="flex flex-col gap-3 py-6">
                      <div className="text-xs text-danger font-mono bg-danger/10 border border-danger/25 p-4 rounded-lg leading-relaxed" style={{ lineHeight: '1.7' }}>
                        MAIN FRAME OFFLINE: Unable to contact telemetry servers. Falling back to local satellite mode.
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4 mt-6 font-mono text-xs text-text-secondary">
                      <div className="flex justify-between items-center py-3 border-b border-white/5">
                        <span>Model Engine</span>
                        <span className="text-text-primary font-semibold">Random Forest</span>
                      </div>
                      <div className="flex justify-between items-center py-3 border-b border-white/5">
                        <span>Version</span>
                        <span className="text-text-primary font-semibold">
                          {health?.model_version || 'v1.0.0'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-3 border-b border-white/5">
                        <span>Database Connection</span>
                        <span className={health?.db_connected ? 'text-success font-semibold' : 'text-danger font-semibold'}>
                          {health?.db_connected ? 'ACTIVE' : 'OFFLINE'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-3 border-b border-white/5">
                        <span>Retraining State</span>
                        <span className={retraining?.is_running ? 'text-warning font-semibold animate-pulse' : 'text-text-muted font-semibold'}>
                          {retraining?.is_running ? 'RUNNING' : 'STANDBY'}
                        </span>
                      </div>
                      {retraining?.last_completed && (
                        <div className="flex justify-between items-center py-3 border-b border-white/5">
                          <span>Last Engine Calibr.</span>
                          <span className="text-text-primary text-[10px]">
                            {new Date(retraining.last_completed).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="text-[10px] text-text-muted font-mono text-center pt-3">
                  SATELLITE INTERFEROMETRY SYSTEM ONBOARD &amp; ACTIVE.
                </div>
              </GlassCard>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Section Divider */}
      <div className="section-divider" />

      {/* ============================================================
          PLATFORM CAPABILITIES — FlipCards
          ============================================================ */}
      <section className="section-padding">
        <div className="site-container flex flex-col items-center">
          {/* Section header */}
          <div className="section-header">
            <h2>Platform Capabilities</h2>
            <p>
              Professional analytics and data recording instruments deployed at your command.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 w-full">
            {capabilities.map((cap, i) => (
              <FlipCard
                key={i}
                className="min-h-[220px]"
                front={
                  <>
                    <div className="text-3xl mb-2">{cap.icon}</div>
                    <h4 className="font-bold font-mono text-text-primary text-sm">{cap.title}</h4>
                  </>
                }
                back={
                  <>
                    <div className="text-xl mb-1">{cap.icon}</div>
                    <h4 className="font-bold font-mono text-text-primary text-xs mb-2">{cap.title}</h4>
                    <p className="text-xs text-text-secondary" style={{ lineHeight: '1.7', maxWidth: '30ch' }}>
                      {cap.description}
                    </p>
                  </>
                }
              />
            ))}
          </div>
        </div>
      </section>
    </motion.div>
  );
}
