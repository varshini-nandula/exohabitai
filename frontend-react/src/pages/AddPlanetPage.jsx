import { useState } from 'react';
import { Link } from 'react-router-dom';
import { predictionAPI } from '../api/prediction';
import { extractError } from '../api/client';
import GlassCard from '../components/GlassCard';
import Tooltip from '../components/Tooltip';
import ErrorState from '../components/ErrorState';
import Button from '../components/ui/Button';
import PageHeader from '../components/ui/PageHeader';
import { FIELD_HUMAN_NAMES } from './PredictPage';

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
  P_SEMI_MAJOR_AXIS: "Distance from host star in AU (Earth = 1.0)",
  S_TEMPERATURE: "Host star surface temperature in Kelvin (Sun ≈ 5778 K)",
  S_LUMINOSITY: "Star luminosity relative to the Sun (Sun = 1.0)",
  S_METALLICITY: "Metal content in [Fe/H] log-ratio (Sun = 0.0)",
};

export default function AddPlanetPage() {
  const [formData, setFormData] = useState({ ...EARTH_DEFAULTS });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [result, setResult] = useState(null);
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
    setResult(null);
    setErrorState(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorState(null);
    setSuccess(false);

    if (!formData.planet_name.trim()) {
      setErrorState({ variant: 'validation', message: 'Planet name is required.' });
      setLoading(false);
      return;
    }

    for (const key of Object.keys(formData)) {
      if (key !== 'planet_name' && (formData[key] === '' || isNaN(formData[key]))) {
        const fieldName = FIELD_HUMAN_NAMES[key] || key;
        setErrorState({ variant: 'validation', message: `"${fieldName}" has an invalid value. Please enter a number.` });
        setLoading(false);
        return;
      }
    }

    try {
      const res = await predictionAPI.predictAndStore(formData);
      const data = res.data?.data;
      if (res.data?.status === 'success' && data?.stored) {
        setResult(data);
        setSuccess(true);
      } else if (data && data.stored === false) {
        setErrorState({ variant: 'generic', message: data.storage_message || 'This planet could not be saved.' });
      } else {
        setErrorState({ variant: 'generic', message: res.data?.message || 'Submission was rejected.' });
      }
    } catch (err) {
      console.error('Submit failed:', err);
      const extracted = extractError(err);
      let errorVariant = 'generic';
      if (err.response?.status === 429) errorVariant = 'rate-limit';
      else if (!err.response) errorVariant = 'offline';
      else if (err.response?.status === 400) errorVariant = 'validation';
      setErrorState({ variant: errorVariant, message: extracted });
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="site-container flex-grow flex items-center justify-center py-12 md:py-20">
        <GlassCard
          glow={true} hoverable={false} animate={true} variant="raised" padding="lg"
          className="w-full max-w-md text-center flex flex-col items-center gap-8 border-success/20"
        >
          <div className="w-14 h-14 rounded-full bg-success/15 border border-success/30 flex items-center justify-center text-success text-2xl">
            ✓
          </div>
          <div>
            <h2 className="text-xl font-bold text-text-primary tracking-tight">
              Planet Submitted!
            </h2>

            {result && (
              <div className="mt-5 flex flex-col items-center gap-2">
                <span className="text-xs text-text-secondary uppercase tracking-wider">
                  Predicted Habitability
                </span>
                <span className="font-mono text-3xl font-bold text-primary">
                  {(result.habitability_probability * 100).toFixed(1)}%
                </span>
                <span className={`text-xs uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${result.habitability === 1 ? 'text-success border-success/40 bg-success/10' : 'text-text-secondary border-white/10'}`}>
                  {result.habitability === 1 ? 'Potentially Habitable' : 'Non-Habitable'}
                </span>
              </div>
            )}

            <p className="text-sm text-text-secondary leading-relaxed mt-4 max-w-xs" style={{ lineHeight: '1.7' }}>
              <strong>{formData.planet_name}</strong> has been recorded and is{' '}
              <strong className="text-highlight">pending admin approval</strong>. It will appear in
              public rankings once approved.
            </p>
          </div>

          <div className="flex flex-col gap-3 w-full mt-2">
            <Button onClick={handleReset} className="w-full">Submit Another Planet</Button>
            <Link to="/history" className="btn-secondary w-full text-sm py-3 border-white/5 justify-center">
              View My Predictions
            </Link>
          </div>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="site-container section-padding flex flex-col" style={{ gap: '48px' }}>
      <PageHeader
        eyebrow="Contribute"
        eyebrowColor="text-accent"
        title="Add a Planet"
        description="Submit a planet with its physical, orbital, and stellar properties. Our AI model will predict its habitability score."
      />

      <section className="max-w-4xl mx-auto w-full">
        {errorState && (
          <div className="mb-8">
            <ErrorState variant={errorState.variant} message={errorState.message} onRetry={handleSubmit} />
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <GlassCard glow={true} variant="raised" padding="lg" className="flex flex-col gap-8 w-full">
            {/* Planet Name */}
            <div className="flex flex-col">
              <label htmlFor="planet_name">Planet Name <span className="text-danger">*</span></label>
              <input
                type="text" id="planet_name" value={formData.planet_name}
                onChange={(e) => handleInputChange('planet_name', e.target.value)}
                placeholder="e.g. KOI-351.01" required disabled={loading}
              />
            </div>

            {/* Three Column Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Column 1: Planet Properties */}
              <div className="flex flex-col gap-5">
                <span className="form-section-label text-primary">Planet Properties</span>
                {[
                  { id: 'P_RADIUS', label: 'Radius (Earth = 1)', step: '0.01', min: '0.01', max: '100.0' },
                  { id: 'P_MASS', label: 'Mass (Earth = 1)', step: '0.01', min: '0.01', max: '10000.0' },
                  { id: 'P_DENSITY', label: 'Density (g/cm³)', step: '0.01', min: '0.01', max: '50.0' },
                  { id: 'P_TEMP_SURF', label: 'Surface Temp (K)', step: '1', min: '1', max: '5000' },
                ].map(f => (
                  <div key={f.id} className="flex flex-col">
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor={f.id} className="m-0">{f.label}</label>
                      <Tooltip content={FIELD_DESCRIPTIONS[f.id]} />
                    </div>
                    <input type="number" id={f.id} step={f.step} min={f.min} max={f.max}
                      value={formData[f.id]} onChange={(e) => handleInputChange(f.id, e.target.value)}
                      required disabled={loading} />
                  </div>
                ))}
              </div>

              {/* Column 2: Orbital Parameters */}
              <div className="flex flex-col gap-5">
                <span className="form-section-label text-accent">Orbital Parameters</span>
                {[
                  { id: 'P_PERIOD', label: 'Orbital Period (days)', step: '0.01', min: '0.01', max: '100000.0' },
                  { id: 'P_SEMI_MAJOR_AXIS', label: 'Semi-Major Axis (AU)', step: '0.001', min: '0.001', max: '500.0' },
                ].map(f => (
                  <div key={f.id} className="flex flex-col">
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor={f.id} className="m-0">{f.label}</label>
                      <Tooltip content={FIELD_DESCRIPTIONS[f.id]} />
                    </div>
                    <input type="number" id={f.id} step={f.step} min={f.min} max={f.max}
                      value={formData[f.id]} onChange={(e) => handleInputChange(f.id, e.target.value)}
                      required disabled={loading} />
                  </div>
                ))}
              </div>

              {/* Column 3: Star Properties */}
              <div className="flex flex-col gap-5">
                <span className="form-section-label text-highlight">Host Star</span>
                {[
                  { id: 'S_TEMPERATURE', label: 'Star Temp (K)', step: '1', min: '500', max: '50000' },
                  { id: 'S_LUMINOSITY', label: 'Luminosity (Sun = 1)', step: '0.00001', min: '0.00001', max: '1000000.0' },
                  { id: 'S_METALLICITY', label: 'Metallicity [Fe/H]', step: '0.01', min: '-10.0', max: '10.0' },
                ].map(f => (
                  <div key={f.id} className="flex flex-col">
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor={f.id} className="m-0">{f.label}</label>
                      <Tooltip content={FIELD_DESCRIPTIONS[f.id]} />
                    </div>
                    <input type="number" id={f.id} step={f.step} min={f.min} max={f.max}
                      value={formData[f.id]} onChange={(e) => handleInputChange(f.id, e.target.value)}
                      required disabled={loading} />
                  </div>
                ))}
              </div>
            </div>

            <Button type="submit" loading={loading} className="w-full mt-4">
              {loading ? 'Submitting...' : 'Submit Planet'}
            </Button>
          </GlassCard>
        </form>
      </section>
    </div>
  );
}
