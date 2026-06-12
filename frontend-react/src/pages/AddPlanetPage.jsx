import { useState } from 'react';
import { Link } from 'react-router-dom';
import { planetsAPI } from '../api/planets';
import { extractError } from '../api/client';
import GlassCard from '../components/GlassCard';
import Tooltip from '../components/Tooltip';
import ErrorState from '../components/ErrorState';

const EARTH_DEFAULTS = {
  planet_name: '',
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

export default function AddPlanetPage() {
  const [formData, setFormData] = useState({ ...EARTH_DEFAULTS });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorState, setErrorState] = useState(null);

  const handleInputChange = (field, val) => {
    if (field === 'planet_name') {
      setFormData((prev) => ({ ...prev, [field]: val }));
      return;
    }

    const numVal = val === '' ? '' : parseFloat(val);
    setFormData((prev) => ({ ...prev, [field]: numVal }));
  };

  const handleReset = () => {
    setFormData({ ...EARTH_DEFAULTS });
    setSuccess(false);
    setErrorState(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorState(null);
    setSuccess(false);

    // Validate inputs
    if (!formData.planet_name.trim()) {
      setErrorState({
        variant: 'validation',
        message: 'Planetary candidate name is required to chart database records.',
      });
      setLoading(false);
      return;
    }

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
      const res = await planetsAPI.addPlanet(formData);
      if (res.data?.status === 'success' || res.data?.data?.stored) {
        setSuccess(true);
      } else {
        setErrorState({
          variant: 'generic',
          message: res.data?.message || 'Database rejected candidate addition.',
        });
      }
    } catch (err) {
      console.error('Submit candidate to database failed:', err);
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

  if (success) {
    return (
      <div className="site-container flex-grow flex items-center justify-center py-12 md:py-20">
        <GlassCard
          glow={true}
          hoverable={false}
          animate={true}
          variant="raised"
          className="w-full max-w-md border-success/20 text-center p-10 flex flex-col items-center gap-8"
        >
          <div className="w-16 h-16 rounded-full bg-success/15 border border-success/30 flex items-center justify-center text-success text-3xl animate-bounce">
            ✓
          </div>
          <div>
            <span className="font-mono text-[10px] tracking-[0.25em] text-success uppercase font-bold">
              TRANSMISSION RECEIVED
            </span>
            <h2 className="text-xl font-bold font-mono text-text-primary tracking-tight mt-3">
              Candidate Charted Successfully
            </h2>
            <p className="text-xs text-text-secondary leading-relaxed mt-3 max-w-xs" style={{ lineHeight: '1.7' }}>
              Exoplanet <strong>{formData.planet_name}</strong> is officially entered into the database registry and queued for future model retraining runs.
            </p>
          </div>

          <div className="flex flex-col gap-3 w-full mt-2">
            <button onClick={handleReset} className="btn-primary w-full text-xs py-3">
              Chart Another Candidate
            </button>
            <Link to="/rankings" className="btn-secondary w-full text-xs py-3 border-white/5">
              View Updated Rankings
            </Link>
          </div>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="site-container section-padding flex flex-col" style={{ gap: '48px' }}>
      {/* PAGE HEADER */}
      <div className="page-header">
        <span className="page-eyebrow text-accent">Observatory Catalog Submitter</span>
        <h1 className="font-mono">Add Custom Candidate</h1>
        <p>
          Submit observed physical, orbital, and stellar data to the mainframe registry for model optimization and rankings integration.
        </p>
      </div>

      {/* SUBMISSION FORM */}
      <section className="max-w-4xl mx-auto w-full">
        {errorState && (
          <div className="mb-8">
            <ErrorState
              variant={errorState.variant}
              message={errorState.message}
              onRetry={handleSubmit}
            />
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <GlassCard glow={true} variant="raised" className="flex flex-col gap-7 w-full p-8">
            <div className="border-b border-white/5 pb-5">
              <span className="font-mono text-sm font-bold text-text-primary tracking-wide uppercase">
                Registry Telemetry Parameters
              </span>
            </div>

            {/* Planet Name */}
            <div className="flex flex-col">
              <label htmlFor="planet_name">Planetary Candidate Name (Required)</label>
              <input
                type="text"
                id="planet_name"
                value={formData.planet_name}
                onChange={(e) => handleInputChange('planet_name', e.target.value)}
                placeholder="e.g. KOI-351.01"
                required
                disabled={loading}
              />
            </div>

            {/* Three Column Attributes Inputs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Column 1: Planet Properties */}
              <div className="flex flex-col gap-6">
                <span className="form-section-label text-primary">
                  Planet Dimensions
                </span>

                <div className="flex flex-col">
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="P_RADIUS" className="m-0">Radius (R_Earth)</label>
                    <Tooltip content={FIELD_DESCRIPTIONS.P_RADIUS} />
                  </div>
                  <input type="number" id="P_RADIUS" step="0.01" min="0.01" max="100.0" value={formData.P_RADIUS} onChange={(e) => handleInputChange('P_RADIUS', e.target.value)} required disabled={loading} />
                </div>

                <div className="flex flex-col">
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="P_MASS" className="m-0">Mass (M_Earth)</label>
                    <Tooltip content={FIELD_DESCRIPTIONS.P_MASS} />
                  </div>
                  <input type="number" id="P_MASS" step="0.01" min="0.01" max="10000.0" value={formData.P_MASS} onChange={(e) => handleInputChange('P_MASS', e.target.value)} required disabled={loading} />
                </div>

                <div className="flex flex-col">
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="P_DENSITY" className="m-0">Density (g/cm³)</label>
                    <Tooltip content={FIELD_DESCRIPTIONS.P_DENSITY} />
                  </div>
                  <input type="number" id="P_DENSITY" step="0.01" min="0.01" max="50.0" value={formData.P_DENSITY} onChange={(e) => handleInputChange('P_DENSITY', e.target.value)} required disabled={loading} />
                </div>

                <div className="flex flex-col">
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="P_TEMP_SURF" className="m-0">Surf Temp (K)</label>
                    <Tooltip content={FIELD_DESCRIPTIONS.P_TEMP_SURF} />
                  </div>
                  <input type="number" id="P_TEMP_SURF" step="1" min="1" max="5000" value={formData.P_TEMP_SURF} onChange={(e) => handleInputChange('P_TEMP_SURF', e.target.value)} required disabled={loading} />
                </div>
              </div>

              {/* Column 2: Orbit Properties */}
              <div className="flex flex-col gap-6">
                <span className="form-section-label text-accent">
                  Orbital Mechanics
                </span>

                <div className="flex flex-col">
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="P_PERIOD" className="m-0">Period (Days)</label>
                    <Tooltip content={FIELD_DESCRIPTIONS.P_PERIOD} />
                  </div>
                  <input type="number" id="P_PERIOD" step="0.01" min="0.01" max="100000.0" value={formData.P_PERIOD} onChange={(e) => handleInputChange('P_PERIOD', e.target.value)} required disabled={loading} />
                </div>

                <div className="flex flex-col">
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="P_SEMI_MAJOR_AXIS" className="m-0">Semi-Major Axis (AU)</label>
                    <Tooltip content={FIELD_DESCRIPTIONS.P_SEMI_MAJOR_AXIS} />
                  </div>
                  <input type="number" id="P_SEMI_MAJOR_AXIS" step="0.001" min="0.001" max="500.0" value={formData.P_SEMI_MAJOR_AXIS} onChange={(e) => handleInputChange('P_SEMI_MAJOR_AXIS', e.target.value)} required disabled={loading} />
                </div>
              </div>

              {/* Column 3: Star Properties */}
              <div className="flex flex-col gap-6">
                <span className="form-section-label text-highlight">
                  Stellar Attributes
                </span>

                <div className="flex flex-col">
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="S_TEMPERATURE" className="m-0">Star Temp (K)</label>
                    <Tooltip content={FIELD_DESCRIPTIONS.S_TEMPERATURE} />
                  </div>
                  <input type="number" id="S_TEMPERATURE" step="1" min="500" max="50000" value={formData.S_TEMPERATURE} onChange={(e) => handleInputChange('S_TEMPERATURE', e.target.value)} required disabled={loading} />
                </div>

                <div className="flex flex-col">
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="S_LUMINOSITY" className="m-0">Luminosity (L_Sun)</label>
                    <Tooltip content={FIELD_DESCRIPTIONS.S_LUMINOSITY} />
                  </div>
                  <input type="number" id="S_LUMINOSITY" step="0.00001" min="0.00001" max="1000000.0" value={formData.S_LUMINOSITY} onChange={(e) => handleInputChange('S_LUMINOSITY', e.target.value)} required disabled={loading} />
                </div>

                <div className="flex flex-col">
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="S_METALLICITY" className="m-0">Metallicity ([Fe/H])</label>
                    <Tooltip content={FIELD_DESCRIPTIONS.S_METALLICITY} />
                  </div>
                  <input type="number" id="S_METALLICITY" step="0.01" min="-10.0" max="10.0" value={formData.S_METALLICITY} onChange={(e) => handleInputChange('S_METALLICITY', e.target.value)} required disabled={loading} />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full mt-4 font-mono shadow-[0_0_20px_rgba(94,234,212,0.25)]"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Submitting Telemetry Records...
                </span>
              ) : (
                'Chart Exoplanet Candidate'
              )}
            </button>
          </GlassCard>
        </form>
      </section>
    </div>
  );
}
