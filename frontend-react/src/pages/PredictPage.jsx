import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { predictionAPI } from '../api/prediction';
import { extractError } from '../api/client';
import GlassCard from '../components/GlassCard';
import HabitabilityGauge from '../components/HabitabilityGauge';
import Tooltip from '../components/Tooltip';
import ErrorState from '../components/ErrorState';

const EARTH_DEFAULTS = {
  planet_name: 'Sol-d (Earth-like)',
  P_RADIUS: 1.0,
  P_MASS: 1.0,
  P_DENSITY: 5.51,
  P_TEMP_SURF: 288,
  P_PERIOD: 365.25,
  P_SEMI_MAJOR_AXIS: 1.0,
  S_TEMPERATURE: 5778,
  S_LUMINOSITY: 1.0,
  S_METALLICITY: 0.0,
};

const PRESETS = {
  earth: EARTH_DEFAULTS,
  superEarth: {
    planet_name: 'Super-Earth Kepler-A',
    P_RADIUS: 1.6,
    P_MASS: 5.0,
    P_DENSITY: 5.5,
    P_TEMP_SURF: 300,
    P_PERIOD: 25.0,
    P_SEMI_MAJOR_AXIS: 0.15,
    S_TEMPERATURE: 3800,
    S_LUMINOSITY: 0.03,
    S_METALLICITY: -0.1,
  },
  gasGiant: {
    planet_name: 'Gas Giant Kepler-B',
    P_RADIUS: 11.2,
    P_MASS: 317.8,
    P_DENSITY: 1.33,
    P_TEMP_SURF: 165,
    P_PERIOD: 4333.0,
    P_SEMI_MAJOR_AXIS: 5.2,
    S_TEMPERATURE: 5778,
    S_LUMINOSITY: 1.0,
    S_METALLICITY: 0.0,
  },
  lavaWorld: {
    planet_name: 'Lava World Kepler-C',
    P_RADIUS: 1.1,
    P_MASS: 1.8,
    P_DENSITY: 6.0,
    P_TEMP_SURF: 2500,
    P_PERIOD: 0.85,
    P_SEMI_MAJOR_AXIS: 0.015,
    S_TEMPERATURE: 5778,
    S_LUMINOSITY: 1.0,
    S_METALLICITY: 0.0,
  },
};

const FAMOUS_EXOPLANETS = {
  kepler442b: {
    planet_name: 'Kepler-442b',
    P_RADIUS: 1.34,
    P_MASS: 2.36,
    P_DENSITY: 7.0,
    P_TEMP_SURF: 233,
    P_PERIOD: 112.3,
    P_SEMI_MAJOR_AXIS: 0.409,
    S_TEMPERATURE: 4402,
    S_LUMINOSITY: 0.12,
    S_METALLICITY: -0.37,
  },
  trappist1e: {
    planet_name: 'TRAPPIST-1e',
    P_RADIUS: 0.92,
    P_MASS: 0.692,
    P_DENSITY: 5.65,
    P_TEMP_SURF: 246,
    P_PERIOD: 6.1,
    P_SEMI_MAJOR_AXIS: 0.029,
    S_TEMPERATURE: 2566,
    S_LUMINOSITY: 0.000553,
    S_METALLICITY: 0.04,
  },
  proximaCentaurib: {
    planet_name: 'Proxima Centauri b',
    P_RADIUS: 1.03,
    P_MASS: 1.27,
    P_DENSITY: 5.6,
    P_TEMP_SURF: 234,
    P_PERIOD: 11.19,
    P_SEMI_MAJOR_AXIS: 0.049,
    S_TEMPERATURE: 3042,
    S_LUMINOSITY: 0.0017,
    S_METALLICITY: 0.21,
  },
};

const FIELD_DESCRIPTIONS = {
  P_RADIUS: "Relative to Earth's radius (Earth = 1.0)",
  P_MASS: "Relative to Earth's mass (Earth = 1.0)",
  P_DENSITY: "Average density in g/cm³ (Earth ≈ 5.51)",
  P_TEMP_SURF: "Surface temperature in Kelvin (Earth ≈ 288 K)",
  P_PERIOD: "Orbital period in Earth days (Earth = 365.25)",
  P_SEMI_MAJOR_AXIS: "Distance from host star in Astronomical Units (Earth = 1.0 AU)",
  S_TEMPERATURE: "Surface temperature of the host star in Kelvin (Sun ≈ 5778 K)",
  S_LUMINOSITY: "Luminosity relative to the Sun (Sun = 1.0)",
  S_METALLICITY: "Metal content relative to the Sun in [Fe/H] log-ratio (Sun = 0.0)",
};

export default function PredictPage() {
  const { isAuthenticated } = useAuth();
  const [formData, setFormData] = useState({ ...EARTH_DEFAULTS });
  const [shouldStore, setShouldStore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [errorState, setErrorState] = useState(null);

  const applyPreset = (presetKey, isFamous = false) => {
    const dataSource = isFamous ? FAMOUS_EXOPLANETS : PRESETS;
    if (dataSource[presetKey]) {
      setFormData({ ...dataSource[presetKey] });
    }
  };

  const handleInputChange = (field, val) => {
    if (field === 'planet_name') {
      setFormData((prev) => ({ ...prev, [field]: val }));
      return;
    }

    const numVal = val === '' ? '' : parseFloat(val);
    setFormData((prev) => ({ ...prev, [field]: numVal }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorState(null);
    setResult(null);

    // Form validation check
    for (const key of Object.keys(formData)) {
      if (key !== 'planet_name' && (formData[key] === '' || isNaN(formData[key]))) {
        setErrorState({
          variant: 'validation',
          message: `Parameter "${key}" has an invalid numeric entry. Please verify.`,
        });
        setLoading(false);
        return;
      }
    }

    try {
      let res;
      // Strip planet name or other details depending on backend structure
      // Wait, let's include the whole formData.
      if (isAuthenticated && shouldStore) {
        res = await predictionAPI.predictAndStore(formData);
      } else {
        res = await predictionAPI.predict(formData);
      }

      if (res.data?.status === 'success') {
        setResult(res.data.data);
      } else {
        setErrorState({
          variant: 'generic',
          message: res.data?.message || 'The telescope returned a telemetry error.',
        });
      }
    } catch (err) {
      console.error('Telemetry prediction error:', err);
      const extracted = extractError(err);
      
      let errorVariant = 'generic';
      if (err.response?.status === 429) {
        errorVariant = 'rate-limit';
      } else if (!err.response) {
        errorVariant = 'offline';
      } else if (err.response?.status === 400) {
        errorVariant = 'validation';
      }

      setErrorState({
        variant: errorVariant,
        message: extracted,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="site-container section-padding flex flex-col" style={{ gap: '48px' }}>
      {/* PAGE HEADER */}
      <div className="page-header">
        <span className="page-eyebrow text-primary">Observatory Telemetry Terminal</span>
        <h1 className="font-mono">Habitability Classification</h1>
        <p>
          Input your charted astronomical properties or deploy pre-loaded planetary configurations to predict core biological suitability scores.
        </p>
      </div>

      {/* QUICK PRESETS & FAMOUS EXPLORER */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Presets */}
        <GlassCard variant="raised" className="flex flex-col gap-5 p-7">
          <span className="form-section-label text-accent" style={{ marginBottom: '0' }}>
            Quick System Configurations
          </span>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => applyPreset('earth')} className="btn-secondary text-xs px-4 py-2.5 border-white/5 bg-white/5 flex-grow">
              🌍 Earth-like
            </button>
            <button onClick={() => applyPreset('superEarth')} className="btn-secondary text-xs px-4 py-2.5 border-white/5 bg-white/5 flex-grow">
              🪐 Super-Earth
            </button>
            <button onClick={() => applyPreset('gasGiant')} className="btn-secondary text-xs px-4 py-2.5 border-white/5 bg-white/5 flex-grow">
              🌀 Gas Giant
            </button>
            <button onClick={() => applyPreset('lavaWorld')} className="btn-secondary text-xs px-4 py-2.5 border-white/5 bg-white/5 flex-grow">
              🔥 Lava World
            </button>
          </div>
        </GlassCard>

        {/* Famous explorer */}
        <GlassCard variant="raised" className="flex flex-col gap-5 p-7">
          <span className="form-section-label text-highlight" style={{ marginBottom: '0' }}>
            Sample Exoplanet Explorer
          </span>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => applyPreset('kepler442b', true)} className="btn-secondary text-xs px-4 py-2.5 border-white/5 bg-white/5 flex-grow font-semibold">
              🔭 Kepler-442b
            </button>
            <button onClick={() => applyPreset('trappist1e', true)} className="btn-secondary text-xs px-4 py-2.5 border-white/5 bg-white/5 flex-grow font-semibold">
              ☄️ TRAPPIST-1e
            </button>
            <button onClick={() => applyPreset('proximaCentaurib', true)} className="btn-secondary text-xs px-4 py-2.5 border-white/5 bg-white/5 flex-grow font-semibold">
              📡 Proxima Centauri b
            </button>
          </div>
        </GlassCard>
      </section>

      {/* CORE FORM & RESULTS LAYOUT */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Input Parameters Form */}
        <form onSubmit={handleSubmit} className="lg:col-span-8 flex flex-col gap-6">
          <GlassCard glow={true} variant="raised" className="flex flex-col gap-7 p-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-white/5 pb-5 gap-3">
              <span className="font-mono text-sm font-bold text-text-primary tracking-wide uppercase">
                Telemetry Inputs
              </span>
              {/* Optional Archiving */}
              {isAuthenticated ? (
                <label className="inline-flex items-center gap-2 cursor-pointer font-mono text-xs text-text-secondary select-none m-0">
                  <input
                    type="checkbox"
                    checked={shouldStore}
                    onChange={(e) => setShouldStore(e.target.checked)}
                    className="w-4 h-4 rounded border-white/10 bg-white/5 focus:ring-primary accent-primary cursor-pointer outline-none"
                  />
                  Log in rankings database archives
                </label>
              ) : (
                <span className="font-mono text-[10px] text-text-muted">
                  Guest mode. Login to save candidates.
                </span>
              )}
            </div>

            {/* Candidate name */}
            <div className="flex flex-col">
              <label htmlFor="planet_name">Planetary Candidate Name</label>
              <input
                type="text"
                id="planet_name"
                value={formData.planet_name}
                onChange={(e) => handleInputChange('planet_name', e.target.value)}
                placeholder="e.g. Kepler-452b"
                required
              />
            </div>

            {/* THREE-COLUMN GRID FIELDS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Column 1: Planet Properties */}
              <div className="flex flex-col gap-6">
                <span className="form-section-label text-primary">
                  Planet Dimensions
                </span>

                {/* Radius */}
                <div className="flex flex-col">
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="P_RADIUS" className="m-0">Radius (R_Earth)</label>
                    <Tooltip content={FIELD_DESCRIPTIONS.P_RADIUS} />
                  </div>
                  <input type="number" id="P_RADIUS" step="0.01" min="0.01" max="100.0" value={formData.P_RADIUS} onChange={(e) => handleInputChange('P_RADIUS', e.target.value)} required />
                </div>

                {/* Mass */}
                <div className="flex flex-col">
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="P_MASS" className="m-0">Mass (M_Earth)</label>
                    <Tooltip content={FIELD_DESCRIPTIONS.P_MASS} />
                  </div>
                  <input type="number" id="P_MASS" step="0.01" min="0.01" max="10000.0" value={formData.P_MASS} onChange={(e) => handleInputChange('P_MASS', e.target.value)} required />
                </div>

                {/* Density */}
                <div className="flex flex-col">
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="P_DENSITY" className="m-0">Density (g/cm³)</label>
                    <Tooltip content={FIELD_DESCRIPTIONS.P_DENSITY} />
                  </div>
                  <input type="number" id="P_DENSITY" step="0.01" min="0.01" max="50.0" value={formData.P_DENSITY} onChange={(e) => handleInputChange('P_DENSITY', e.target.value)} required />
                </div>

                {/* Surf Temp */}
                <div className="flex flex-col">
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="P_TEMP_SURF" className="m-0">Surf Temp (K)</label>
                    <Tooltip content={FIELD_DESCRIPTIONS.P_TEMP_SURF} />
                  </div>
                  <input type="number" id="P_TEMP_SURF" step="1" min="1" max="5000" value={formData.P_TEMP_SURF} onChange={(e) => handleInputChange('P_TEMP_SURF', e.target.value)} required />
                </div>
              </div>

              {/* Column 2: Orbit Properties */}
              <div className="flex flex-col gap-6">
                <span className="form-section-label text-accent">
                  Orbital Mechanics
                </span>

                {/* Period */}
                <div className="flex flex-col">
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="P_PERIOD" className="m-0">Period (Days)</label>
                    <Tooltip content={FIELD_DESCRIPTIONS.P_PERIOD} />
                  </div>
                  <input type="number" id="P_PERIOD" step="0.01" min="0.01" max="100000.0" value={formData.P_PERIOD} onChange={(e) => handleInputChange('P_PERIOD', e.target.value)} required />
                </div>

                {/* Semi Major Axis */}
                <div className="flex flex-col">
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="P_SEMI_MAJOR_AXIS" className="m-0">Semi-Major Axis (AU)</label>
                    <Tooltip content={FIELD_DESCRIPTIONS.P_SEMI_MAJOR_AXIS} />
                  </div>
                  <input type="number" id="P_SEMI_MAJOR_AXIS" step="0.001" min="0.001" max="500.0" value={formData.P_SEMI_MAJOR_AXIS} onChange={(e) => handleInputChange('P_SEMI_MAJOR_AXIS', e.target.value)} required />
                </div>
              </div>

              {/* Column 3: Star Properties */}
              <div className="flex flex-col gap-6">
                <span className="form-section-label text-highlight">
                  Stellar Attributes
                </span>

                {/* Temp */}
                <div className="flex flex-col">
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="S_TEMPERATURE" className="m-0">Star Temp (K)</label>
                    <Tooltip content={FIELD_DESCRIPTIONS.S_TEMPERATURE} />
                  </div>
                  <input type="number" id="S_TEMPERATURE" step="1" min="500" max="50000" value={formData.S_TEMPERATURE} onChange={(e) => handleInputChange('S_TEMPERATURE', e.target.value)} required />
                </div>

                {/* Luminosity */}
                <div className="flex flex-col">
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="S_LUMINOSITY" className="m-0">Luminosity (L_Sun)</label>
                    <Tooltip content={FIELD_DESCRIPTIONS.S_LUMINOSITY} />
                  </div>
                  <input type="number" id="S_LUMINOSITY" step="0.00001" min="0.00001" max="1000000.0" value={formData.S_LUMINOSITY} onChange={(e) => handleInputChange('S_LUMINOSITY', e.target.value)} required />
                </div>

                {/* Metallicity */}
                <div className="flex flex-col">
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="S_METALLICITY" className="m-0">Metallicity ([Fe/H])</label>
                    <Tooltip content={FIELD_DESCRIPTIONS.S_METALLICITY} />
                  </div>
                  <input type="number" id="S_METALLICITY" step="0.01" min="-10.0" max="10.0" value={formData.S_METALLICITY} onChange={(e) => handleInputChange('S_METALLICITY', e.target.value)} required />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full mt-4 font-mono shadow-[0_0_20px_rgba(79,140,255,0.2)]"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Calculating Orbital Telemetry...
                </span>
              ) : (
                'Run Habitability Predictor'
              )}
            </button>
          </GlassCard>
        </form>

        {/* Prediction Results Board */}
        <div className="lg:col-span-4 flex flex-col gap-6 w-full">
          {/* Active Error Displays */}
          {errorState && (
            <ErrorState
              variant={errorState.variant}
              message={errorState.message}
              onRetry={handleSubmit}
            />
          )}

          {/* Active Result Card */}
          {result && (
            <GlassCard
              glow={true}
              hoverable={false}
              animate={true}
              variant="raised"
              className={`flex flex-col gap-6 relative border-t-4 overflow-hidden p-8 ${
                result.habitability
                  ? 'border-t-success border-success/15'
                  : 'border-t-danger border-danger/15'
              }`}
            >
              {/* Subtle dynamic highlight orb */}
              <div
                className={`absolute -top-24 -right-24 w-48 h-48 rounded-full blur-3xl pointer-events-none opacity-20 transition-colors ${
                  result.habitability ? 'bg-success' : 'bg-danger'
                }`}
              />

              <div className="text-center font-mono border-b border-white/5 pb-5">
                <span className="text-[10px] tracking-[0.25em] text-text-secondary uppercase font-bold">
                  Telemetry Evaluation Result
                </span>
                <h3 className="text-lg font-bold text-text-primary mt-2 truncate">
                  {result.planet_name || formData.planet_name}
                </h3>
              </div>

              {/* Habitability Gauge */}
              <HabitabilityGauge probability={result.habitability_probability} size={160} />

              {/* Classification label */}
              <div className="text-center mt-2 flex flex-col gap-2">
                <span
                  className={`text-xl font-bold font-mono uppercase tracking-wide ${
                    result.habitability ? 'text-success' : 'text-danger'
                  }`}
                >
                  {result.habitability ? 'Potentially Habitable' : 'Non-Habitable'}
                </span>
                <span className="text-xs text-text-secondary font-mono">
                  Probability: {(result.habitability_probability * 100).toFixed(1)}% — Threshold: 50%
                </span>
              </div>

              {/* Warnings (if any) */}
              {result.warnings && result.warnings.length > 0 && (
                <div className="text-[10px] text-warning bg-warning/5 border border-warning/10 p-3 rounded-lg font-mono leading-relaxed mt-2">
                  <div className="font-semibold uppercase tracking-wider mb-1.5">⚠️ Classifier Telemetry Warnings:</div>
                  <ul className="list-disc pl-4 space-y-0.5">
                    {result.warnings.map((warn, i) => (
                      <li key={i}>{warn}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Storage confirmation (if saved) */}
              {result.stored && (
                <div className="text-[10px] text-success bg-success/5 border border-success/10 p-2.5 rounded-lg font-mono text-center">
                  ✅ Telemetry logged successfully inside exoplanet archives rankings.
                </div>
              )}

              {/* Academic Disclaimer */}
              <div className="text-[9px] text-text-muted font-mono leading-relaxed border-t border-white/5 pt-5 text-justify select-none" style={{ lineHeight: '1.7' }}>
                <strong>Science Disclaimer:</strong> Predictions are generated by a machine learning model trained on historical exoplanet datasets and should be interpreted as exploratory estimates rather than scientific confirmation of habitability.
              </div>
            </GlassCard>
          )}

          {/* Prompt card when empty */}
          {!result && !errorState && (
            <GlassCard
              hoverable={false}
              variant="raised"
              className="flex flex-col items-center justify-center text-center p-12 min-h-[350px] text-text-muted border-dashed border-white/10"
            >
              <svg className="w-12 h-12 opacity-30 animate-pulse mb-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
              <h4 className="font-mono text-sm font-bold text-text-primary tracking-wide uppercase mb-3">
                Awaiting Telemetry
              </h4>
              <p className="text-xs text-text-secondary max-w-[220px]" style={{ lineHeight: '1.7' }}>
                Configure planetary properties and initiate the classifier to compile scientific evaluations.
              </p>
            </GlassCard>
          )}
        </div>
      </section>
    </div>
  );
}
