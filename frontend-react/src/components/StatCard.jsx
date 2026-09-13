import { useEffect, useState } from 'react';
import GlassCard from './GlassCard';

export default function StatCard({
  icon,
  label,
  title,
  value,
  description,
  suffix = '',
  decimals = 0,
  glow = false,
  delay = 0,
  highlight = false,
  trend,
}) {
  const [displayValue, setDisplayValue] = useState(0);

  // Support both 'label' and 'title' props for backward compat
  const displayLabel = label || title || '';

  useEffect(() => {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
      setDisplayValue(value);
      return;
    }

    let currentStep = 0;
    const duration = 1200;
    const stepTime = 16;
    const steps = Math.ceil(duration / stepTime);
    const increment = numValue / steps;

    const timer = setInterval(() => {
      currentStep++;
      if (currentStep >= steps) {
        setDisplayValue(numValue);
        clearInterval(timer);
      } else {
        const next = parseFloat((increment * currentStep).toFixed(decimals));
        setDisplayValue(next > numValue ? numValue : next);
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, [value, decimals]);

  const formattedValue = typeof displayValue === 'number'
    ? displayValue.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    })
    : displayValue;

  return (
    <GlassCard
      glow={glow}
      hoverable={true}
      animate={true}
      delay={delay}
      padding="md"
      className={`flex flex-col gap-4 min-w-[140px] flex-1 ${highlight ? 'border-warning/20' : ''}`}
    >
      <div className="flex items-center justify-between gap-3 text-text-secondary">
        <span className="text-xs uppercase tracking-wider font-semibold leading-tight">
          {displayLabel}
        </span>
        {icon && <div className="text-primary text-lg">{icon}</div>}
      </div>
      <div className="flex items-baseline gap-1.5 mt-auto">
        <span className="text-2xl font-bold font-mono text-text-primary tracking-tight">
          {formattedValue}
        </span>
        {suffix && (
          <span className="text-xs font-semibold text-accent">
            {suffix}
          </span>
        )}
      </div>
      {(description || trend) && (
        <div className="flex items-center justify-between text-xs text-text-muted">
          {description && <span>{description}</span>}
          {trend && (
            <span className={`font-semibold ${trend > 0 ? 'text-success' : trend < 0 ? 'text-danger' : 'text-text-muted'}`}>
              {trend > 0 ? '↑' : trend < 0 ? '↓' : '→'} {Math.abs(trend)}%
            </span>
          )}
        </div>
      )}
    </GlassCard>
  );
}
