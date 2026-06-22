import { motion, AnimatePresence } from 'framer-motion';
import GlassCard from './GlassCard';

// The 30 features the pipeline expects
const PIPELINE_EXPECTED = [
  'P_MASS', 'P_RADIUS', 'P_PERIOD', 'P_SEMI_MAJOR_AXIS', 'P_ECCENTRICITY',
  'P_INCLINATION', 'S_MAG', 'S_DISTANCE', 'S_TEMPERATURE', 'S_MASS',
  'S_RADIUS', 'S_METALLICITY', 'S_AGE', 'S_LOG_LUM', 'S_LOG_G',
  'P_ESCAPE', 'P_POTENTIAL', 'P_GRAVITY', 'P_DENSITY', 'P_HILL_SPHERE',
  'P_DISTANCE', 'P_PERIASTRON', 'P_APASTRON', 'P_FLUX', 'P_TEMP_EQUIL',
  'P_TEMP_SURF', 'P_TYPE', 'S_TYPE_TEMP', 'S_LUMINOSITY', 'Derived_S_TYPE',
];

// Features the backend can auto-derive from basic inputs
const AUTO_DERIVABLE = [
  'P_FLUX', 'P_TEMP_EQUIL', 'P_GRAVITY', 'P_ESCAPE', 'P_POTENTIAL',
  'P_DISTANCE', 'P_PERIASTRON', 'P_APASTRON', 'S_LOG_LUM',
  'P_TYPE', 'S_TYPE_TEMP', 'Derived_S_TYPE',
];

// Human-readable labels for features
const FEATURE_LABELS = {
  P_ECCENTRICITY: 'Orbital Eccentricity',
  P_INCLINATION: 'Orbital Inclination',
  S_MAG: 'Star Apparent Magnitude',
  S_DISTANCE: 'Star Distance (parsecs)',
  S_MASS: 'Star Mass',
  S_RADIUS: 'Star Radius',
  S_AGE: 'Star Age',
  S_LOG_LUM: 'Log Luminosity',
  S_LOG_G: 'Star Surface Gravity (log g)',
  P_ESCAPE: 'Escape Velocity',
  P_POTENTIAL: 'Gravitational Potential',
  P_GRAVITY: 'Surface Gravity',
  P_HILL_SPHERE: 'Hill Sphere',
  P_DISTANCE: 'Orbital Distance',
  P_PERIASTRON: 'Periastron Distance',
  P_APASTRON: 'Apastron Distance',
  P_FLUX: 'Stellar Flux',
  P_TEMP_EQUIL: 'Equilibrium Temperature',
  P_TYPE: 'Planet Type',
  S_TYPE_TEMP: 'Star Spectral Type',
  Derived_S_TYPE: 'Derived Star Type',
};

/**
 * Compute which features are missing from the user's form input.
 * Returns { derivable, needsStrategy, totalMissing }
 */
export function computeMissingFeatures(formData) {
  const userProvided = new Set(
    Object.keys(formData).filter(
      (k) => k !== 'planet_name' && formData[k] !== '' && formData[k] != null
    )
  );

  const allMissing = PIPELINE_EXPECTED.filter((f) => !userProvided.has(f));
  const derivable = allMissing.filter((f) => AUTO_DERIVABLE.includes(f));
  const needsStrategy = allMissing.filter((f) => !AUTO_DERIVABLE.includes(f));

  return {
    derivable,
    needsStrategy,
    totalMissing: allMissing.length,
    totalExpected: PIPELINE_EXPECTED.length,
    providedCount: userProvided.size,
  };
}

const STRATEGIES = [
  {
    key: 'earth',
    icon: '🌍',
    label: 'Earth-like Defaults',
    description:
      'Fill missing parameters with Earth and Solar system baseline values. Best for evaluating Earth-like planets.',
    colorClass: 'text-success',
    borderClass: 'border-success/20 hover:border-success/50',
    bgClass: 'hover:bg-success/5',
  },
  {
    key: 'non_habitable',
    icon: '📊',
    label: 'Dataset Averages',
    description:
      'Use median values from the exoplanet catalog. Biased toward typical (non-habitable) planet characteristics.',
    colorClass: 'text-warning',
    borderClass: 'border-warning/20 hover:border-warning/50',
    bgClass: 'hover:bg-warning/5',
  },
  {
    key: 'zeros',
    icon: '0️⃣',
    label: 'Fill with Zeros',
    description:
      'Set all missing numeric features to zero. Use with caution — produces physically unrealistic inputs.',
    colorClass: 'text-highlight',
    borderClass: 'border-highlight/20 hover:border-highlight/50',
    bgClass: 'hover:bg-highlight/5',
  },
];

export default function ImputationModal({
  isOpen,
  onClose,
  onSelectStrategy,
  missingInfo,
}) {
  if (!missingInfo) return null;

  const { derivable, needsStrategy, totalExpected, providedCount } = missingInfo;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-space-900/80 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Modal Content */}
          <motion.div
            className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            initial={{ opacity: 0, y: 30, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <GlassCard
              glow={true}
              hoverable={false}
              variant="raised"
              className="p-0 border-warning/20 overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-start gap-5 p-8 pb-0">
                <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-warning/10 border border-warning/20 flex items-center justify-center">
                  <svg
                    className="w-7 h-7 text-warning"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold font-mono text-text-primary tracking-tight">
                    Incomplete Telemetry Data
                  </h3>
                  <p className="text-sm text-text-secondary mt-2 leading-relaxed">
                    You left{' '}
                    <span className="text-primary font-semibold">
                      {needsStrategy.length}
                    </span>{' '}
                    telemetry features unfilled. Choose a strategy to fill these missing parameters.
                  </p>
                </div>
              </div>

              {/* Feature breakdown */}
              <div className="px-8 pt-6 pb-2 space-y-4">
                {/* Auto-derivable */}
                {derivable.length > 0 && (
                  <div className="p-4 rounded-xl bg-success/5 border border-success/10">
                    <div className="flex items-center gap-2 mb-2">
                      <svg
                        className="w-4 h-4 text-success"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <span className="text-xs font-mono font-bold text-success uppercase tracking-wider">
                        {derivable.length} Features Auto-Calculated
                      </span>
                    </div>
                    <p className="text-[11px] text-text-secondary leading-relaxed">
                      These will be derived from your inputs using astrophysical
                      formulas:{' '}
                      <span className="text-text-muted">
                        {derivable
                          .map((f) => FEATURE_LABELS[f] || f)
                          .join(', ')}
                      </span>
                    </p>
                  </div>
                )}

                {/* Needs strategy */}
                {needsStrategy.length > 0 && (
                  <div className="p-4 rounded-xl bg-warning/5 border border-warning/10">
                    <div className="flex items-center gap-2 mb-2">
                      <svg
                        className="w-4 h-4 text-warning"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                      </svg>
                      <span className="text-xs font-mono font-bold text-warning uppercase tracking-wider">
                        {needsStrategy.length} Features Need Filling
                      </span>
                    </div>
                    <p className="text-[11px] text-text-secondary leading-relaxed">
                      Cannot be derived from your inputs:{' '}
                      <span className="text-text-muted">
                        {needsStrategy
                          .map((f) => FEATURE_LABELS[f] || f)
                          .join(', ')}
                      </span>
                    </p>
                  </div>
                )}
              </div>

              {/* Strategy Selection */}
              <div className="p-8 pt-4">
                <span className="block text-xs font-mono font-bold text-text-secondary uppercase tracking-wider mb-4">
                  Choose Fill Strategy
                </span>

                <div className="space-y-3">
                  {STRATEGIES.map((strategy) => (
                    <button
                      key={strategy.key}
                      onClick={() => onSelectStrategy(strategy.key)}
                      className={`w-full text-left p-5 rounded-xl border transition-all duration-200 cursor-pointer group
                        ${strategy.borderClass} ${strategy.bgClass}
                        bg-transparent`}
                    >
                      <div className="flex items-start gap-4">
                        <span className="text-2xl flex-shrink-0 mt-0.5">
                          {strategy.icon}
                        </span>
                        <div className="flex-1 min-w-0">
                          <span
                            className={`text-sm font-bold font-mono block ${strategy.colorClass}`}
                          >
                            {strategy.label}
                          </span>
                          <span className="text-xs text-text-secondary mt-1 block leading-relaxed">
                            {strategy.description}
                          </span>
                        </div>
                        <svg
                          className={`w-5 h-5 flex-shrink-0 mt-1 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity ${strategy.colorClass}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13 7l5 5m0 0l-5 5m5-5H6"
                          />
                        </svg>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div className="px-8 pb-8 pt-0 flex items-center justify-between border-t border-white/5 mt-2 pt-5">
                <button
                  onClick={onClose}
                  className="btn-ghost text-text-muted hover:text-text-primary text-xs font-mono"
                >
                  ← Cancel & Edit Parameters
                </button>
                <span className="text-[10px] text-text-muted font-mono">
                  Strategy affects unfilled features only
                </span>
              </div>
            </GlassCard>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
