import { useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { predictionAPI } from '../api/prediction';
import { extractError } from '../api/client';
import GlassCard from '../components/GlassCard';
import HabitabilityGauge from '../components/HabitabilityGauge';
import Tooltip from '../components/Tooltip';
import ErrorState from '../components/ErrorState';
import ImputationModal, { computeMissingFeatures } from '../components/ImputationModal';

export const FIELD_HUMAN_NAMES = {
  P_RADIUS: 'Planet Radius',
  P_MASS: 'Planet Mass',
  P_DENSITY: 'Planet Density',
  P_TEMP_SURF: 'Surface Temperature',
  P_PERIOD: 'Orbital Period',
  P_SEMI_MAJOR_AXIS: 'Semi-Major Axis',
  P_ECCENTRICITY: 'Eccentricity',
  P_INCLINATION: 'Inclination',
  P_HILL_SPHERE: 'Hill Sphere',
  S_TEMPERATURE: 'Host Star Temperature',
  S_LUMINOSITY: 'Host Star Luminosity',
  S_METALLICITY: 'Host Star Metallicity',
  S_MAG: 'Host Star Apparent Magnitude',
  S_DISTANCE: 'Distance to Star',
  S_MASS: 'Host Star Mass',
  S_RADIUS: 'Host Star Radius',
  S_AGE: 'Host Star Age',
  S_LOG_G: 'Host Star Surface Gravity',
};


const EMPTY_FORM_STATE = {
  planet_name: '',
  P_RADIUS: '',
  P_MASS: '',
  P_DENSITY: '',
  P_TEMP_SURF: '',
  P_PERIOD: '',
  P_SEMI_MAJOR_AXIS: '',
  S_TEMPERATURE: '',
  S_LUMINOSITY: '',
  S_METALLICITY: '',
  P_ECCENTRICITY: '',
  P_INCLINATION: '',
  S_MAG: '',
  S_DISTANCE: '',
  S_MASS: '',
  S_RADIUS: '',
  S_AGE: '',
  S_LOG_G: '',
  P_HILL_SPHERE: '',
};

const EARTH_DEFAULTS = {
  ...EMPTY_FORM_STATE,
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
  P_ECCENTRICITY: 0.017,
  P_INCLINATION: 89.97,
  S_MAG: 4.83,
  S_DISTANCE: 10.0,
  S_MASS: 1.0,
  S_RADIUS: 1.0,
  S_AGE: 4.6,
  S_LOG_G: 4.44,
  P_HILL_SPHERE: 0.01,
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
    P_ECCENTRICITY: 0.05,
    P_INCLINATION: 89.5,
    S_MAG: 12.5,
    S_DISTANCE: 120.0,
    S_MASS: 0.5,
    S_RADIUS: 0.5,
    S_AGE: 5.0,
    S_LOG_G: 4.7,
    P_HILL_SPHERE: 0.005,
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
    P_ECCENTRICITY: 0.048,
    P_INCLINATION: 88.5,
    S_MAG: 4.83,
    S_DISTANCE: 10.0,
    S_MASS: 1.0,
    S_RADIUS: 1.0,
    S_AGE: 4.6,
    S_LOG_G: 4.44,
    P_HILL_SPHERE: 0.35,
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
    P_ECCENTRICITY: 0.01,
    P_INCLINATION: 87.0,
    S_MAG: 4.83,
    S_DISTANCE: 10.0,
    S_MASS: 1.0,
    S_RADIUS: 1.0,
    S_AGE: 4.6,
    S_LOG_G: 4.44,
    P_HILL_SPHERE: 0.0002,
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
    P_ECCENTRICITY: 0.04,
    P_INCLINATION: 89.9,
    S_MAG: 14.96,
    S_DISTANCE: 374.0,
    S_MASS: 0.61,
    S_RADIUS: 0.60,
    S_AGE: 2.9,
    S_LOG_G: 4.67,
    P_HILL_SPHERE: 0.015,
  },
  trappist1e: {
    planet_name: 'TRAPPIST-1e',
    P_RADIUS: 0.92,
    P_MASS: 0.69,
    P_DENSITY: 5.65,
    P_TEMP_SURF: 246,
    P_PERIOD: 6.1,
    P_SEMI_MAJOR_AXIS: 0.029,
    S_TEMPERATURE: 2566,
    S_LUMINOSITY: 0.00055,
    S_METALLICITY: 0.04,
    P_ECCENTRICITY: 0.008,
    P_INCLINATION: 89.86,
    S_MAG: 18.8,
    S_DISTANCE: 12.1,
    S_MASS: 0.09,
    S_RADIUS: 0.12,
    S_AGE: 7.6,
    S_LOG_G: 5.24,
    P_HILL_SPHERE: 0.0004,
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
    P_ECCENTRICITY: 0.11,
    P_INCLINATION: 89.0,
    S_MAG: 11.13,
    S_DISTANCE: 1.3,
    S_MASS: 0.12,
    S_RADIUS: 0.14,
    S_AGE: 4.8,
    S_LOG_G: 5.20,
    P_HILL_SPHERE: 0.0008,
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
  P_ECCENTRICITY: "Orbital eccentricity, shape of the orbit (0 = circular, < 1 = elliptical)",
  P_INCLINATION: "Orbital inclination in degrees relative to the sky plane (0 - 180°)",
  S_MAG: "Apparent magnitude (brightness) of host star as seen from Earth",
  S_DISTANCE: "Distance to host star in parsecs (1 parsec ≈ 3.26 light years)",
  S_MASS: "Mass of the host star relative to the Sun (Sun = 1.0)",
  S_RADIUS: "Radius of the host star relative to the Sun (Sun = 1.0)",
  S_AGE: "Age of the host star in billions of years (Sun ≈ 4.6 Gyr)",
  S_LOG_G: "Logarithm of surface gravity of host star in cgs units (log g)",
  P_HILL_SPHERE: "Radius of the planet's gravitational influence sphere in AU",
};

/**
 * Validation constraints for each numeric form field, extracted from the
 * HTML <input> attributes.  Used by clampPreset() to guarantee that every
 * preset value passes browser-native HTML5 validation, and by validateField()
 * to provide real-time inline feedback.
 */
const FIELD_CONSTRAINTS = {
  P_RADIUS:          { min: 0.01,    max: 100.0,      step: 0.01    },
  P_MASS:            { min: 0.01,    max: 10000.0,    step: 0.01    },
  P_DENSITY:         { min: 0.01,    max: 50.0,       step: 0.01    },
  P_TEMP_SURF:       { min: 1,       max: 5000,       step: 1       },
  P_HILL_SPHERE:     { min: 0.0001,  max: null,       step: 0.0001  },
  P_PERIOD:          { min: 0.01,    max: 100000.0,   step: 0.01    },
  P_SEMI_MAJOR_AXIS: { min: 0.001,   max: 500.0,      step: 0.001   },
  P_ECCENTRICITY:    { min: 0.0,     max: 1.0,        step: 0.001   },
  P_INCLINATION:     { min: 0.0,     max: 180.0,      step: 0.01    },
  S_TEMPERATURE:     { min: 500,     max: 50000,      step: 1       },
  S_LUMINOSITY:      { min: 0.00001, max: 1000000.0,  step: 0.00001 },
  S_METALLICITY:     { min: -10.0,   max: 10.0,       step: 0.01    },
  S_MAG:             { min: null,    max: null,       step: 0.01    },
  S_DISTANCE:        { min: 0.01,    max: null,       step: 0.01    },
  S_MASS:            { min: 0.01,    max: null,       step: 0.01    },
  S_RADIUS:          { min: 0.01,    max: null,       step: 0.01    },
  S_AGE:             { min: 0.01,    max: null,       step: 0.01    },
  S_LOG_G:           { min: null,    max: null,       step: 0.01    },
};

/**
 * Clamp every numeric value in a preset to the nearest valid value according
 * to FIELD_CONSTRAINTS.  This is a safeguard so that if a preset value ever
 * falls outside a field's allowed range (or doesn't align with the step), it
 * is automatically corrected before being inserted into the form.
 */
function clampPreset(preset) {
  const clamped = { ...preset };
  for (const [field, constraints] of Object.entries(FIELD_CONSTRAINTS)) {
    const value = clamped[field];
    if (value === '' || value === undefined || value === null) continue;

    let v = Number(value);
    if (isNaN(v)) continue;

    const { min, max, step } = constraints;

    // Clamp to [min, max]
    if (min !== null && v < min) v = min;
    if (max !== null && v > max) v = max;

    // Snap to the nearest valid step value:  min + n * step
    if (step != null && step > 0) {
      const base = min ?? 0;
      const diff = v - base;
      const n = Math.round(diff / step);
      v = base + n * step;
      // Clamp again in case rounding pushed it out of range
      if (min !== null && v < min) v = min;
      if (max !== null && v > max) v = max;
    }

    // Round to avoid floating-point artefacts (match step precision)
    if (step != null && step > 0) {
      const decimals = (step.toString().split('.')[1] || '').length;
      v = parseFloat(v.toFixed(decimals));
    }

    clamped[field] = v;
  }
  return clamped;
}

// ---------------------------------------------------------------------------
// Inline Validation
// ---------------------------------------------------------------------------

/**
 * Helper to determine the number of decimal places of a number.
 * Handles scientific notation correctly.
 */
function getDecimalPlaces(num) {
  const match = ('' + num).match(/(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/);
  if (!match) return 0;
  return Math.max(
    0,
    (match[1] ? match[1].length : 0) - (match[2] ? +match[2] : 0)
  );
}

/**
 * Validate a single field value against its constraints.
 * Returns an error message string or null if valid.
 */
function validateField(field, value) {
  // Empty / blank fields are optional — not an error
  if (value === '' || value === undefined || value === null) return null;

  const numVal = Number(value);

  if (isNaN(numVal)) {
    return 'Please enter a valid number';
  }

  const constraints = FIELD_CONSTRAINTS[field];
  if (!constraints) return null;

  const { min, max, step } = constraints;

  if (min !== null && max !== null && (numVal < min || numVal > max)) {
    return `Value must be between ${min} and ${max}`;
  }
  if (min !== null && numVal < min) {
    return `Minimum allowed value is ${min}`;
  }
  if (max !== null && numVal > max) {
    return `Maximum allowed value is ${max}`;
  }

  // Decimal precision / step validation
  if (step !== null && step !== undefined && step > 0) {
    const valueDecimals = getDecimalPlaces(numVal);
    const stepDecimals = getDecimalPlaces(step);
    if (valueDecimals > stepDecimals) {
      if (stepDecimals === 0) {
        return 'Value must be an integer';
      }
      return `Value must have at most ${stepDecimals} decimal places`;
    }
  }

  return null;
}

/**
 * Validate all numeric fields in a form data object.
 * Returns a map of { fieldName: errorMessage } for every invalid field.
 */
function validateAllFields(data) {
  const errors = {};
  for (const field of Object.keys(FIELD_CONSTRAINTS)) {
    const err = validateField(field, data[field]);
    if (err) errors[field] = err;
  }
  return errors;
}

/**
 * Build a human-readable range hint for a constrained field.
 */
function rangeHint(field) {
  const c = FIELD_CONSTRAINTS[field];
  if (!c) return null;
  const { min, max } = c;
  if (min !== null && max !== null) return `Range: ${min} – ${max}`;
  if (min !== null) return `Min: ${min}`;
  if (max !== null) return `Max: ${max}`;
  return null;
}

// ---------------------------------------------------------------------------
// Form field layout definition  (data-driven → less JSX repetition)
// ---------------------------------------------------------------------------

const COLUMN_DEFS = [
  {
    label: 'Planetary Dimensions & Orbit',
    colorClass: 'text-primary',
    fields: [
      { key: 'P_RADIUS',          label: 'Radius (R_Earth)' },
      { key: 'P_MASS',            label: 'Mass (M_Earth)' },
      { key: 'P_DENSITY',         label: 'Density (g/cm³)' },
      { key: 'P_TEMP_SURF',       label: 'Surf Temp (K)' },
      { key: 'P_PERIOD',          label: 'Period (Days)' },
      { key: 'P_SEMI_MAJOR_AXIS', label: 'Semi-Major Axis (AU)' },
    ],
  },
  {
    label: 'Orbital & System Dynamics',
    colorClass: 'text-accent',
    fields: [
      { key: 'P_ECCENTRICITY',    label: 'Eccentricity' },
      { key: 'P_INCLINATION',     label: 'Inclination (°)' },
      { key: 'P_HILL_SPHERE',     label: 'Hill Sphere (AU)' },
      { key: 'S_MAG',             label: 'Star Apparent Mag' },
      { key: 'S_DISTANCE',        label: 'Distance (parsecs)' },
      { key: 'S_AGE',             label: 'Star Age (Gyr)' },
    ],
  },
  {
    label: 'Host Star Physics',
    colorClass: 'text-highlight',
    fields: [
      { key: 'S_TEMPERATURE',     label: 'Star Temp (K)' },
      { key: 'S_LUMINOSITY',      label: 'Luminosity (L_Sun)' },
      { key: 'S_METALLICITY',     label: 'Metallicity ([Fe/H])' },
      { key: 'S_MASS',            label: 'Star Mass (M_Sun)' },
      { key: 'S_RADIUS',          label: 'Star Radius (R_Sun)' },
      { key: 'S_LOG_G',           label: 'Star Gravity (log g)' },
    ],
  },
];


// ---------------------------------------------------------------------------
// ValidatedInput — reusable field wrapper with inline feedback
// ---------------------------------------------------------------------------

function ValidatedInput({ field, label, value, error, touched, onChange, onBlur }) {
  const c = FIELD_CONSTRAINTS[field];
  const hint = rangeHint(field);
  const hasError = touched && !!error;
  const isValid = touched && !error && value !== '' && value !== undefined && value !== null;

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between mb-1">
        <label htmlFor={field} className="m-0">{label}</label>
        <Tooltip content={FIELD_DESCRIPTIONS[field]} />
      </div>
      <input
        type="number"
        id={field}
        step={c?.step}
        min={c?.min ?? undefined}
        max={c?.max ?? undefined}
        value={value}
        onChange={(e) => onChange(field, e.target.value)}
        onBlur={() => onBlur(field)}
        className={hasError ? 'field-error' : isValid ? 'field-valid' : ''}
        aria-invalid={hasError || undefined}
        aria-describedby={hasError ? `${field}-error` : hint ? `${field}-hint` : undefined}
      />
      {/* Error message — shown beneath the input */}
      {hasError && (
        <span id={`${field}-error`} className="field-error-msg" role="alert">
          {error}
        </span>
      )}
      {/* Range hint — shown when no error is active */}
      {!hasError && hint && (
        <span id={`${field}-hint`} className="field-hint">
          {hint}
        </span>
      )}
    </div>
  );
}


// ===========================================================================
// PredictPage Component
// ===========================================================================

export default function PredictPage() {
  const { isAuthenticated } = useAuth();
  const [formData, setFormData] = useState(() => clampPreset({ ...EARTH_DEFAULTS }));
  const [shouldStore, setShouldStore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [errorState, setErrorState] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [missingInfo, setMissingInfo] = useState(null);

  // Validation state: track per-field errors and which fields the user has interacted with
  const [fieldErrors, setFieldErrors] = useState({});
  const [touchedFields, setTouchedFields] = useState({});

  // Derived: are there any active validation errors?
  const hasErrors = useMemo(
    () => Object.values(fieldErrors).some(Boolean),
    [fieldErrors],
  );

  // ------ Validation helpers ------

  const runFieldValidation = useCallback((field, value) => {
    const err = validateField(field, value);
    setFieldErrors((prev) => {
      if (prev[field] === err) return prev;           // avoid pointless re-renders
      const next = { ...prev };
      if (err) next[field] = err; else delete next[field];
      return next;
    });
    return err;
  }, []);

  const markTouched = useCallback((field) => {
    setTouchedFields((prev) => (prev[field] ? prev : { ...prev, [field]: true }));
  }, []);

  // ------ Form data handlers ------

  const applyPreset = useCallback((presetKey, isFamous = false) => {
    const dataSource = isFamous ? FAMOUS_EXOPLANETS : PRESETS;
    if (!dataSource[presetKey]) return;

    const clamped = clampPreset({ ...EMPTY_FORM_STATE, ...dataSource[presetKey] });
    setFormData(clamped);

    // Validate every field immediately and mark all as touched so errors
    // (if any survive clamping) are surfaced right away.
    const errors = validateAllFields(clamped);
    setFieldErrors(errors);
    const touched = {};
    for (const f of Object.keys(FIELD_CONSTRAINTS)) touched[f] = true;
    setTouchedFields(touched);
  }, []);

  const handleInputChange = useCallback((field, val) => {
    if (field === 'planet_name') {
      setFormData((prev) => ({ ...prev, [field]: val }));
      return;
    }

    const numVal = val === '' ? '' : parseFloat(val);
    setFormData((prev) => ({ ...prev, [field]: numVal }));

    // Real-time validation while typing
    runFieldValidation(field, val === '' ? '' : numVal);
    markTouched(field);
  }, [runFieldValidation, markTouched]);

  // We need the actual current value in blur validation:
  const handleFieldBlur = useCallback((field) => {
    markTouched(field);
    // Use functional state to read current value
    setFormData((prev) => {
      runFieldValidation(field, prev[field]);
      return prev;  // no mutation
    });
  }, [markTouched, runFieldValidation]);

  // ------ Prediction / submit logic ------

  const executePrediction = async (strategy) => {
    setLoading(true);
    setErrorState(null);
    setResult(null);

    // Clean payload: convert empty strings to null so backend handles them as missing (None)
    const cleanedFeatures = {};
    Object.keys(formData).forEach((key) => {
      cleanedFeatures[key] = formData[key] === '' ? null : formData[key];
    });

    try {
      let res;
      const payload = { ...cleanedFeatures, imputation_strategy: strategy };
      if (isAuthenticated && shouldStore) {
        res = await predictionAPI.predictAndStore(payload);
      } else {
        res = await predictionAPI.predict(payload);
      }

      if (res.data?.status === 'success') {
        setResult(res.data.data);
      } else {
        setErrorState({
          variant: 'generic',
          message: res.data?.message || 'Prediction failed. Please try again.',
        });
      }
    } catch (err) {
      console.error('Prediction error:', err);
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

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorState(null);
    setResult(null);

    // Run full validation & touch all fields so every error is visible
    const allErrors = validateAllFields(formData);
    setFieldErrors(allErrors);
    const allTouched = {};
    for (const f of Object.keys(FIELD_CONSTRAINTS)) allTouched[f] = true;
    setTouchedFields(allTouched);

    if (Object.keys(allErrors).length > 0) {
      // Scroll the first invalid field into view
      const firstBad = Object.keys(allErrors)[0];
      document.getElementById(firstBad)?.focus({ preventScroll: false });
      return;
    }

    // Legacy NaN guard (belt-and-suspenders)
    for (const key of Object.keys(formData)) {
      if (key !== 'planet_name' && formData[key] !== '' && isNaN(formData[key])) {
        setErrorState({
          variant: 'validation',
          message: `Parameter "${FIELD_HUMAN_NAMES[key] || key}" has an invalid numeric entry. Please verify.`,
        });
        return;
      }
    }

    const info = computeMissingFeatures(formData);
    if (info.needsStrategy.length > 0) {
      setMissingInfo(info);
      setIsModalOpen(true);
    } else {
      executePrediction('median');
    }
  };

  const handleSelectStrategy = (strategy) => {
    setIsModalOpen(false);
    executePrediction(strategy);
  };

  // Derive submit-disabled state
  const submitDisabled = loading || hasErrors;

  return (
    <div className="site-container section-padding flex flex-col gap-10 sm:gap-12">
      {/* PAGE HEADER */}
      <div className="page-header">
        <span className="page-eyebrow text-primary">Habitability Prediction</span>
        <h1>Predict Habitability</h1>
        <p>
          Enter planet parameters or choose a preset to predict habitability. Leave fields blank for values you don't know.
        </p>
      </div>

      {/* QUICK PRESETS & FAMOUS EXPLORER */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
        {/* Presets */}
        <GlassCard variant="raised" padding="lg" className="flex flex-col gap-6">
          <div className="text-center pb-2 border-b border-white/5">
            <h3 className="text-sm sm:text-base font-bold text-accent uppercase tracking-wider">
              Quick Presets
            </h3>
            <p className="text-xs text-text-muted mt-1">
              Select a planetary archetype to auto-fill parameters
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => applyPreset('earth')}
              className="btn-secondary text-xs sm:text-sm py-3 px-4 border-white/10 bg-white/5 hover:bg-white/10 flex items-center justify-center gap-2 rounded-xl transition-all cursor-pointer font-medium"
            >
              <span>🌍</span> Earth-like
            </button>
            <button
              type="button"
              onClick={() => applyPreset('superEarth')}
              className="btn-secondary text-xs sm:text-sm py-3 px-4 border-white/10 bg-white/5 hover:bg-white/10 flex items-center justify-center gap-2 rounded-xl transition-all cursor-pointer font-medium"
            >
              <span>🪐</span> Super-Earth
            </button>
            <button
              type="button"
              onClick={() => applyPreset('gasGiant')}
              className="btn-secondary text-xs sm:text-sm py-3 px-4 border-white/10 bg-white/5 hover:bg-white/10 flex items-center justify-center gap-2 rounded-xl transition-all cursor-pointer font-medium"
            >
              <span>🌀</span> Gas Giant
            </button>
            <button
              type="button"
              onClick={() => applyPreset('lavaWorld')}
              className="btn-secondary text-xs sm:text-sm py-3 px-4 border-white/10 bg-white/5 hover:bg-white/10 flex items-center justify-center gap-2 rounded-xl transition-all cursor-pointer font-medium"
            >
              <span>🔥</span> Lava World
            </button>
          </div>
        </GlassCard>

        {/* Famous explorer */}
        <GlassCard variant="raised" padding="lg" className="flex flex-col gap-6">
          <div className="text-center pb-2 border-b border-white/5">
            <h3 className="text-sm sm:text-base font-bold text-highlight uppercase tracking-wider">
              Famous Exoplanets
            </h3>
            <p className="text-xs text-text-muted mt-1">
              Real observational benchmarks from space missions
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => applyPreset('kepler442b', true)}
              className="btn-secondary text-xs sm:text-sm py-3 px-4 border-white/10 bg-white/5 hover:bg-white/10 flex items-center justify-center gap-2 rounded-xl transition-all cursor-pointer font-medium"
            >
              <span>🔭</span> Kepler-442b
            </button>
            <button
              type="button"
              onClick={() => applyPreset('trappist1e', true)}
              className="btn-secondary text-xs sm:text-sm py-3 px-4 border-white/10 bg-white/5 hover:bg-white/10 flex items-center justify-center gap-2 rounded-xl transition-all cursor-pointer font-medium"
            >
              <span>☄️</span> TRAPPIST-1e
            </button>
            <button
              type="button"
              onClick={() => applyPreset('proximaCentaurib', true)}
              className="btn-secondary text-xs sm:text-sm py-3 px-4 border-white/10 bg-white/5 hover:bg-white/10 flex items-center justify-center gap-2 rounded-xl transition-all cursor-pointer font-medium"
            >
              <span>📡</span> Proxima b
            </button>
          </div>
        </GlassCard>
      </section>

      {/* CORE FORM & RESULTS LAYOUT */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
        {/* Input Parameters Form */}
        <form onSubmit={handleSubmit} noValidate className="lg:col-span-8 flex flex-col gap-6">
          <GlassCard glow={true} variant="raised" padding="lg" className="flex flex-col gap-8 sm:gap-9">
            <div className="flex flex-col sm:flex-row items-center justify-between border-b border-white/5 pb-6 gap-4 text-center sm:text-left">
              <div>
                <h2 className="text-base sm:text-lg md:text-xl font-bold text-text-primary tracking-wide uppercase">
                  Planet Parameters
                </h2>
                <p className="text-xs text-text-muted mt-1">
                  Enter physical, orbital, and stellar measurements to evaluate
                </p>
              </div>
              {/* Optional Archiving */}
              {isAuthenticated ? (
                <label className="inline-flex items-center gap-2.5 cursor-pointer text-xs text-text-secondary select-none m-0">
                  <input
                    type="checkbox"
                    checked={shouldStore}
                    onChange={(e) => setShouldStore(e.target.checked)}
                    className="w-4 h-4 rounded border-white/10 bg-white/5 focus:ring-primary accent-primary cursor-pointer outline-none"
                  />
                  Save prediction to my account (submits for ranking review)
                </label>
              ) : (
                <span className="text-xs text-text-muted">
                  Guest mode — sign in to save predictions.
                </span>
              )}
            </div>

            {/* Candidate name */}
            <div className="form-group">
              <label htmlFor="planet_name" className="text-center sm:text-left font-semibold">
                Planet Name
              </label>
              <input
                type="text"
                id="planet_name"
                value={formData.planet_name}
                onChange={(e) => handleInputChange('planet_name', e.target.value)}
                placeholder="e.g. Kepler-452b"
                required
              />
            </div>

            {/* THREE-COLUMN GRID FIELDS — data-driven */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-9 lg:gap-10 pt-2">
              {COLUMN_DEFS.map((col) => (
                <div key={col.label} className="flex flex-col gap-6 sm:gap-7">
                  <div className="text-center pb-3 border-b border-white/10 mb-1">
                    <span className={`text-xs sm:text-sm font-bold uppercase tracking-wider block ${col.colorClass}`}>
                      {col.label}
                    </span>
                  </div>
                  {col.fields.map((f) => (
                    <ValidatedInput
                      key={f.key}
                      field={f.key}
                      label={f.label}
                      value={formData[f.key]}
                      error={fieldErrors[f.key]}
                      touched={!!touchedFields[f.key]}
                      onChange={handleInputChange}
                      onBlur={handleFieldBlur}
                    />
                  ))}
                </div>
              ))}
            </div>

            {/* Inline validation summary when errors block submission */}
            {hasErrors && Object.keys(touchedFields).length > 0 && (
              <div className="validation-summary" role="alert">
                <span className="validation-summary-icon">⚠</span>
                <span>
                  {Object.keys(fieldErrors).length === 1
                    ? '1 field requires attention before submitting.'
                    : `${Object.keys(fieldErrors).length} fields require attention before submitting.`}
                </span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitDisabled}
              className="btn-primary w-full mt-4 shadow-[0_0_20px_rgba(79,140,255,0.25)]"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Analyzing planet...
                </span>
              ) : hasErrors ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-5 w-5 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Fix Validation Errors to Predict
                </span>
              ) : (
                'Predict Habitability'
              )}
            </button>
          </GlassCard>
        </form>

        {/* Prediction Results Board — Sticky layout */}
        <div className="lg:col-span-4 flex flex-col gap-6 w-full lg:sticky lg:top-24 self-start">
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
              className={`flex flex-col gap-7 relative border-t-4 overflow-hidden p-7 sm:p-9 md:p-10 ${result.habitability
                ? 'border-t-success border-success/15'
                : 'border-t-danger border-danger/15'
                }`}
            >
              {/* Subtle dynamic highlight orb */}
              <div
                className={`absolute -top-24 -right-24 w-48 h-48 rounded-full blur-3xl pointer-events-none opacity-20 transition-colors ${result.habitability ? 'bg-success' : 'bg-danger'
                  }`}
              />

              <div className="text-center border-b border-white/5 pb-6">
                <span className="text-[10px] tracking-[0.25em] text-text-secondary uppercase font-bold">
                  Prediction Result
                </span>
                <h3 className="text-xl font-bold text-text-primary mt-3 truncate">
                  {result.planet_name || formData.planet_name}
                </h3>
              </div>

              {/* Habitability Gauge */}
              <HabitabilityGauge probability={result.habitability_probability} size={160} />

              {/* Classification label */}
              <div className="text-center mt-3 flex flex-col gap-3">
                <span
                  className={`text-xl font-bold uppercase tracking-wide ${result.habitability ? 'text-success' : 'text-danger'
                    }`}
                >
                  {result.habitability ? 'Potentially Habitable' : 'Non-Habitable'}
                </span>
                <span className="text-xs text-text-secondary">
                  Probability: {(result.habitability_probability * 100).toFixed(1)}% — Threshold: 50%
                </span>
              </div>

              {/* Warnings (if any) */}
              {result.warnings && result.warnings.length > 0 && (
                <div className="text-[10px] text-warning bg-warning/5 border border-warning/10 p-4 rounded-lg leading-relaxed mt-3">
                  <div className="font-semibold uppercase tracking-wider mb-1.5">⚠️ Notes:</div>
                  <ul className="list-disc pl-4 space-y-0.5">
                    {result.warnings.map((warn, i) => (
                      <li key={i}>{warn}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Storage confirmation / warning */}
              {result.stored === true && (
                <div className="text-xs text-success bg-success/10 border border-success/20 p-3.5 rounded-lg text-center font-medium">
                  ✅ Prediction saved to your account and submitted for moderation review.
                </div>
              )}
              {result.stored === false && (
                <div className="text-xs text-warning bg-warning/10 border border-warning/25 p-3.5 rounded-lg text-center font-medium leading-relaxed">
                  ⚠️ Prediction calculated, but not saved to account: {result.storage_message || 'Planet name already exists in database.'}
                </div>
              )}

              {/* Guest CTA — Sign in to add planet to database */}
              {!isAuthenticated && (
                <div className="p-5 rounded-2xl bg-gradient-to-br from-primary/15 via-space-800/80 to-accent/10 border border-primary/25 flex flex-col items-center gap-3 text-center mt-2 shadow-lg">
                  <div className="w-9 h-9 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary text-base">
                    🪐
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-text-primary">
                      Save to Observatory Database
                    </h4>
                    <p className="text-xs text-text-secondary mt-1 leading-relaxed max-w-xs">
                      Sign in to permanently catalog <strong>{result.planet_name || formData.planet_name}</strong> in the database and submit it for public rankings.
                    </p>
                  </div>
                  <Link
                    to="/login?redirect=/predict"
                    className="btn-primary w-full text-xs py-2.5 px-4 shadow-[0_0_20px_rgba(79,140,255,0.3)] font-semibold justify-center mt-1"
                  >
                    Sign In to Add Planet
                  </Link>
                </div>
              )}

              {/* Next-Step Journey CTAs */}
              <div className="flex flex-col gap-2.5 pt-4 border-t border-white/5">
                <div className="flex gap-2">
                  <Link
                    to="/rankings"
                    className="btn-secondary flex-1 text-center text-xs py-2.5 px-3 border-white/10 bg-white/5 hover:bg-white/10 justify-center"
                  >
                    📊 Rankings
                  </Link>
                  {isAuthenticated && (
                    <Link
                      to="/history"
                      className="btn-secondary flex-1 text-center text-xs py-2.5 px-3 border-white/10 bg-white/5 hover:bg-white/10 justify-center"
                    >
                      📁 My Predictions
                    </Link>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setResult(null);
                    setErrorState(null);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="text-xs text-text-muted hover:text-text-primary py-1.5 transition-colors text-center cursor-pointer"
                >
                  Evaluate Another Candidate ↺
                </button>
              </div>

              {/* Academic Disclaimer */}
              <div className="text-[10px] text-text-muted leading-relaxed border-t border-white/5 pt-4 text-justify select-none" style={{ lineHeight: '1.7' }}>
                <strong>Science Disclaimer:</strong> Predictions are generated by a machine learning model trained on historical exoplanet datasets and should be interpreted as exploratory estimates rather than scientific confirmation of habitability.
              </div>
            </GlassCard>
          )}

          {/* Prompt card when empty */}
          {!result && !errorState && (
            <GlassCard
              hoverable={false}
              variant="raised"
              className="flex flex-col items-center justify-center text-center p-14 min-h-[350px] text-text-muted border-dashed border-white/10"
            >
              <svg className="w-12 h-12 opacity-30 animate-pulse mb-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
              <h4 className="text-sm font-bold text-text-primary tracking-wide uppercase mb-4">
                Ready for Analysis
              </h4>
              <p className="text-xs text-text-secondary max-w-[240px]" style={{ lineHeight: '1.7' }}>
                Enter planet parameters or choose a preset, then click "Predict Habitability" to see results.
              </p>
            </GlassCard>
          )}
        </div>
      </section>

      <ImputationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSelectStrategy={handleSelectStrategy}
        missingInfo={missingInfo}
      />
    </div>
  );
}
