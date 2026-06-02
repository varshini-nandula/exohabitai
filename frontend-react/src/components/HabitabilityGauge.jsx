import { motion } from 'framer-motion';

export default function HabitabilityGauge({ probability, size = 180 }) {
  // Convert 0.0 - 1.0 probability to percentage
  const pct = Math.min(Math.max(probability * 100, 0), 100);

  const radius = 55;
  const strokeWidth = 8;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (pct / 100) * circumference;

  // Determine color based on probability threshold
  const getColor = (p) => {
    if (p < 30) return '#EF4444'; // Red (Danger)
    if (p < 50) return '#F59E0B'; // Orange/Yellow (Warning)
    if (p < 75) return '#4F8CFF'; // Blue (Primary / Kepler-like)
    return '#22C55E'; // Emerald Green (Habitable)
  };

  const color = getColor(pct);

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className="relative" style={{ width: size, height: size }}>
        {/* Glow effect matching current color */}
        <div
          className="absolute inset-0 rounded-full opacity-10 blur-xl transition-all duration-700"
          style={{ backgroundColor: color }}
        />

        <svg
          className="w-full h-full transform -rotate-90"
          viewBox="0 0 130 130"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Background track circle */}
          <circle
            className="stroke-space-600 fill-transparent"
            cx="65"
            cy="65"
            r={radius}
            strokeWidth={strokeWidth}
          />
          {/* Progress circle */}
          <motion.circle
            className="fill-transparent transition-all duration-700"
            cx="65"
            cy="65"
            r={radius}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
            strokeLinecap="round"
            style={{
              stroke: color,
              filter: `drop-shadow(0px 0px 4px ${color}80)`,
            }}
          />
        </svg>

        {/* Center overlay label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <motion.span
            className="text-4xl font-bold font-mono tracking-tight text-text-primary"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            {pct.toFixed(1)}
            <span className="text-lg text-text-secondary">%</span>
          </motion.span>
          <span className="text-[10px] uppercase font-mono tracking-widest text-text-muted mt-1">
            Habitability
          </span>
        </div>
      </div>
    </div>
  );
}
