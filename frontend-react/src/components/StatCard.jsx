import { useEffect, useState } from 'react';
import GlassCard from './GlassCard';

export default function StatCard({
  icon,
  label,
  value,
  suffix = '',
  decimals = 0,
  glow = false,
  delay = 0,
}) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    // Parse value as number for counting animation
    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
      setDisplayValue(value);
      return;
    }

    let start = 0;
    const duration = 1200; // ms
    const stepTime = 16; // ~60fps
    const steps = Math.ceil(duration / stepTime);
    const increment = numValue / steps;
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      if (currentStep >= steps) {
        setDisplayValue(numValue);
        clearInterval(timer);
      } else {
        setDisplayValue((prev) => {
          const next = parseFloat((start + increment * currentStep).toFixed(decimals));
          return next > numValue ? numValue : next;
        });
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, [value, decimals]);

  // Format helper for display
  const formattedValue = typeof displayValue === 'number'
    ? displayValue.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    })
    : displayValue;

  return (
    <GlassCard glow={glow} hoverable={true} animate={true} delay={delay} className="flex flex-col gap-5 min-w-[140px] flex-1 p-7">
      <div className="flex items-center justify-between gap-3 text-text-secondary">
        <span className="text-[10px] uppercase tracking-wider font-semibold font-mono leading-tight">{label}</span>
        {icon && <div className="text-primary text-lg">{icon}</div>}
      </div>
      <div className="flex items-baseline gap-1.5 mt-auto">
        <span className="text-2xl font-bold font-mono text-text-primary tracking-tight">
          {formattedValue}
        </span>
        {suffix && (
          <span className="text-xs font-semibold text-accent font-mono">
            {suffix}
          </span>
        )}
      </div>
    </GlassCard>
  );
}
