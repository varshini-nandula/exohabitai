import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { rankingsAPI } from '../api/rankings';
import GlassCard from '../components/GlassCard';
import StatCard from '../components/StatCard';

export default function HomePage() {
  const [topPlanets, setTopPlanets] = useState([]);
  const [rankingsLoading, setRankingsLoading] = useState(true);
  const [rankingsReady, setRankingsReady] = useState(false);

  useEffect(() => {
    let active = true;
    const fetchTopRankings = async () => {
      try {
        const res = await rankingsAPI.getRankings('all');
        if (active && res.data?.status === 'success') {
          const planetData = res.data.data?.planets || [];
          const normalized = planetData.map((p, idx) => ({
            ...p,
            rank: p.rank || idx + 1,
          }));
          const top5 = normalized.slice(0, 5);
          setTopPlanets(top5);
          if (top5.length > 0) setRankingsReady(true);
        }
      } catch {
        // Silently fail — section won't render
      } finally {
        if (active) setRankingsLoading(false);
      }
    };

    fetchTopRankings();
    return () => { active = false; };
  }, []);

  const containerVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.12 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 24 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: 'spring', stiffness: 60, damping: 18 },
    },
  };

  const getBarColor = (prob) => {
    if (prob < 30) return '#EF4444';
    if (prob < 50) return '#F59E0B';
    if (prob < 75) return '#4F8CFF';
    return '#22C55E';
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      {/* ============================================================
          SECTION 1 — HERO
          Deliberate vertical rhythm:
          Badge (20px) → Heading (24px) → Desc (40px) → Buttons (48px) → Stats (80px) → End
          ============================================================ */}
      <section className="relative overflow-visible">
        {/* Background glow */}
        <div className="absolute top-20 right-1/4 w-[400px] h-[400px] rounded-full bg-gradient-to-tr from-primary/10 to-accent/5 filter blur-[120px] -z-10 animate-pulse" />
        <div className="absolute bottom-0 left-[10%] w-[500px] h-[500px] rounded-full bg-gradient-to-br from-highlight/8 to-transparent filter blur-[120px] -z-10" />

        <div
          className="site-container flex flex-col items-center justify-center text-center"
          style={{ paddingTop: '100px', paddingBottom: '80px', minHeight: '85vh' }}
        >
          <motion.div variants={itemVariants} className="flex flex-col items-center" style={{ maxWidth: '700px' }}>
            {/* Badge */}
            <span className="font-mono text-[11px] md:text-xs font-semibold tracking-[0.25em] uppercase text-accent border border-accent/20 bg-accent/5 px-5 py-1.5 rounded-full">
              Exoplanet Habitability Platform
            </span>

            {/* Heading — 20px from badge */}
            <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight" style={{ marginTop: '20px' }}>
              <span className="bg-gradient-to-r from-primary via-[#89B4FF] to-accent bg-clip-text text-transparent">
                ExoHabitAI
              </span>
            </h1>

            {/* Description — 24px from heading */}
            <p
              className="text-text-secondary text-base sm:text-lg md:text-xl"
              style={{ marginTop: '24px', maxWidth: '580px', lineHeight: '1.7' }}
            >
              Discover which exoplanets could support life. Powered by machine learning trained on 6,000+ planetary records from the PHL catalog.
            </p>
          </motion.div>

          {/* CTA Buttons — 40px from description */}
          <motion.div
            variants={itemVariants}
            className="flex flex-col sm:flex-row gap-4 justify-center"
            style={{ marginTop: '40px' }}
          >
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

          {/* Credibility Stats — 48px from buttons */}
          <motion.div
            variants={itemVariants}
            className="grid grid-cols-3 gap-5 sm:gap-6 w-full"
            style={{ marginTop: '48px', maxWidth: '560px' }}
          >
            <div className="glass rounded-xl py-6 px-5 flex flex-col items-center gap-3 text-center">
              <span className="text-2xl sm:text-3xl font-bold font-mono text-accent leading-none">6,000+</span>
              <span className="text-[10px] text-text-muted font-mono uppercase tracking-wider leading-tight">Planet Records</span>
            </div>
            <div className="glass rounded-xl py-6 px-5 flex flex-col items-center gap-3 text-center">
              <span className="text-2xl sm:text-3xl font-bold font-mono text-primary leading-none">9</span>
              <span className="text-[10px] text-text-muted font-mono uppercase tracking-wider leading-tight">Planetary Features</span>
            </div>
            <div className="glass rounded-xl py-6 px-5 flex flex-col items-center gap-3 text-center">
              <span className="text-2xl sm:text-3xl font-bold font-mono text-success leading-none">96%</span>
              <span className="text-[10px] text-text-muted font-mono uppercase tracking-wider leading-tight">Model Accuracy</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Section Divider */}
      <div className="section-divider" />

      {/* ============================================================
          SECTION 2 — HOW EXOHABITAI WORKS
          ============================================================ */}
      <section className="section-padding">
        <div className="site-container flex flex-col items-center">
          {/* Section header — uses consistent hierarchy */}
          <div className="section-header">
            <h2 className="font-mono">How ExoHabitAI Works</h2>
            <p>
              A four-stage machine learning pipeline that evaluates planetary habitability from raw telemetry to classification.
            </p>
          </div>

          {/* Pipeline cards — wider grid, content-driven height */}
          <motion.div
            variants={containerVariants}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8 w-full"
          >
            {[
              {
                step: '01',
                title: 'Enter Telemetry',
                desc: 'Supply planet properties, orbital mechanics, and host star attributes into our telemetry modules.',
                color: 'primary',
              },
              {
                step: '02',
                title: 'ML Evaluation',
                desc: 'Random Forest classifier parses stellar temperatures, planet masses, density ratios, and radiation indices.',
                color: 'accent',
              },
              {
                step: '03',
                title: 'Habitability Score',
                desc: 'Receive a calculated probability score verified against a classification boundary threshold of 50%.',
                color: 'highlight',
              },
              {
                step: '04',
                title: 'Observatory Logs',
                desc: 'Registered users can store confirmed candidates inside the rankings and system archives.',
                color: 'success',
              },
            ].map((card) => (
              <GlassCard
                key={card.step}
                animate={true}
                delay={parseFloat(card.step) * 0.1}
                className="flex flex-col relative group overflow-hidden h-full p-10"
              >
                <div className={`absolute top-0 right-0 w-28 h-28 bg-${card.color}/5 rounded-full filter blur-xl group-hover:bg-${card.color}/10 transition-colors`} />

                {/* Step number */}
                <div className={`w-12 h-12 rounded-lg bg-${card.color}/10 border border-${card.color}/20 flex items-center justify-center font-bold font-mono text-${card.color} select-none shrink-0`}>
                  {card.step}
                </div>

                {/* Title — 28px from number */}
                <h3 className="font-bold text-base font-mono text-text-primary" style={{ marginTop: '28px' }}>
                  {card.title}
                </h3>

                {/* Description — 16px from title */}
                <p className="text-xs text-text-secondary" style={{ marginTop: '16px', lineHeight: '1.7' }}>
                  {card.desc}
                </p>
              </GlassCard>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ============================================================
          SECTION 3 — RANKINGS PREVIEW
          Only render if real data is available. No placeholders.
          ============================================================ */}
      {!rankingsLoading && rankingsReady && topPlanets.length > 0 && (
        <>
          <div className="section-divider" />
          <section className="section-padding">
            <div className="site-container flex flex-col items-center">
              {/* Section header */}
              <div className="section-header">
                <h2 className="font-mono">Top Habitability Candidates</h2>
                <p>
                  The highest-ranked exoplanets from our classification model, sorted by habitability probability.
                </p>
              </div>

              <div className="w-full" style={{ maxWidth: '800px' }}>
                <motion.div variants={containerVariants} className="flex flex-col gap-3">
                  {topPlanets.map((planet, index) => {
                    const probPercent = (planet.habitability_probability * 100).toFixed(1);
                    const numProb = parseFloat(probPercent);
                    const color = getBarColor(numProb);

                    return (
                      <motion.div
                        key={planet.planet_name || index}
                        variants={itemVariants}
                      >
                        <GlassCard
                          hoverable={true}
                          className="flex items-center gap-6 py-6 px-8 relative overflow-hidden"
                        >
                          {/* Rank badge */}
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center font-mono font-bold text-xs shrink-0"
                            style={{ background: `${color}12`, color: color, border: `1px solid ${color}25` }}
                          >
                            #{planet.rank}
                          </div>

                          {/* Planet info */}
                          <div className="flex-grow min-w-0">
                            <h4 className="font-bold text-sm font-mono text-text-primary truncate mb-3">
                              {planet.planet_name}
                            </h4>
                            <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-1000"
                                style={{ width: `${probPercent}%`, backgroundColor: color }}
                              />
                            </div>
                          </div>

                          {/* Probability */}
                          <div className="text-right shrink-0 pl-2">
                            <span className="font-bold font-mono text-sm" style={{ color }}>
                              {probPercent}%
                            </span>
                            <div className="text-[9px] font-mono uppercase text-text-muted mt-1">
                              Habitability
                            </div>
                          </div>
                        </GlassCard>
                      </motion.div>
                    );
                  })}

                  {/* CTA */}
                  <motion.div variants={itemVariants} className="flex justify-center" style={{ marginTop: '32px' }}>
                    <Link
                      to="/rankings"
                      className="btn-secondary px-8 py-3 inline-flex items-center gap-2 text-sm hover:gap-3 transition-all"
                    >
                      View Full Rankings
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                    </Link>
                  </motion.div>
                </motion.div>
              </div>
            </div>
          </section>
        </>
      )}

      {/* Section Divider */}
      <div className="section-divider" />

      {/* ============================================================
          SECTION 4 — MODEL TRUST & DATASET
          Clearer hierarchy: label → title (16px) → desc (24px) → metrics
          ============================================================ */}
      <section className="section-padding">
        <div className="site-container flex flex-col items-center">
          {/* Section header */}
          <div className="section-header">
            <span className="section-eyebrow">Scientific Validation</span>
            <h2 className="font-mono">Model Trust &amp; Dataset</h2>
            <p>
              Trained on the PHL Exoplanet Catalog with rigorous cross-validation and performance benchmarking.
            </p>
          </div>

          {/* Two-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 w-full" style={{ maxWidth: '1100px' }}>
            {/* Left — Dataset */}
            <motion.div variants={itemVariants}>
              <GlassCard glow={true} className="h-full flex flex-col justify-between p-10">
                <div>
                  {/* Eyebrow */}
                  <span className="font-mono text-[11px] font-semibold text-primary tracking-wider uppercase">
                    Data Source
                  </span>

                  {/* Title — 20px from eyebrow */}
                  <h3 className="text-lg font-bold font-mono text-text-primary" style={{ marginTop: '20px' }}>
                    PHL Exoplanet Catalog
                  </h3>

                  {/* Description — 24px from title */}
                  <p className="text-sm text-text-secondary" style={{ marginTop: '24px', lineHeight: '1.7', maxWidth: '50ch' }}>
                    Verified data curated by the Planetary Habitability Laboratory (PHL) at UPR Arecibo. Over 6,000 exoplanetary records across 9 physical and orbital dimensions.
                  </p>

                  {/* Metric mini-cards — 32px from description */}
                  <div className="grid grid-cols-2 gap-5" style={{ marginTop: '32px' }}>
                    <div className="p-5 rounded-xl bg-white/5 border border-white/5 flex flex-col gap-3">
                      <span className="text-[10px] text-text-muted font-mono uppercase font-semibold">Dataset Size</span>
                      <span className="text-lg font-bold font-mono text-accent">6,000+</span>
                    </div>
                    <div className="p-5 rounded-xl bg-white/5 border border-white/5 flex flex-col gap-3">
                      <span className="text-[10px] text-text-muted font-mono uppercase font-semibold">Features</span>
                      <span className="text-lg font-bold font-mono text-accent">9 Dimensions</span>
                    </div>
                  </div>
                </div>

                {/* Attributes footer — separated */}
                <div className="border-t border-white/5 text-xs text-text-muted" style={{ paddingTop: '24px', marginTop: '32px', lineHeight: '1.7' }}>
                  <strong>Attributes:</strong> Planet Radius, Planet Mass, Stellar Temperature, Semi-Major Axis, Stellar Luminosity, Orbital Period, Planet Density, Surface Temperature, Stellar Metallicity.
                </div>
              </GlassCard>
            </motion.div>

            {/* Right — Model performance */}
            <motion.div variants={itemVariants}>
              <GlassCard glow={true} className="h-full flex flex-col p-10">
                {/* Eyebrow */}
                <span className="font-mono text-[11px] font-semibold text-accent tracking-wider uppercase">
                  Performance Metrics
                </span>

                {/* Title — 20px from eyebrow */}
                <h3 className="text-lg font-bold font-mono text-text-primary" style={{ marginTop: '20px' }}>
                  Random Forest Classifier
                </h3>

                {/* Description — 24px from title */}
                <p className="text-sm text-text-secondary" style={{ marginTop: '24px', lineHeight: '1.7', maxWidth: '50ch' }}>
                  Validation results from stratified cross-validation on the PHL catalog dataset.
                </p>

                {/* Metric grid — 36px from description, pushed to bottom */}
                <div className="grid grid-cols-2 gap-5 mt-auto" style={{ paddingTop: '36px' }}>
                  <StatCard label="F1 Score" value="0.94" decimals={2} suffix="" delay={0.1} />
                  <StatCard label="ROC-AUC" value="0.985" decimals={3} suffix="" delay={0.2} />
                  <StatCard label="PR-AUC" value="0.979" decimals={3} suffix="" delay={0.3} />
                  <StatCard label="Cross Val." value="96.2" decimals={1} suffix="%" delay={0.4} />
                </div>
              </GlassCard>
            </motion.div>
          </div>
        </div>
      </section>
    </motion.div>
  );
}
