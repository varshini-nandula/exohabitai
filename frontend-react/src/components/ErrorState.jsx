import GlassCard from './GlassCard';

export default function ErrorState({
  variant = 'generic',
  title,
  message,
  onRetry,
  className = '',
}) {
  // Render specific SVG icons based on error variant
  const getIcon = () => {
    switch (variant) {
      case 'offline':
        return (
          <svg className="w-16 h-16 text-danger animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-3.536 4.978 4.978 0 011.414-3.536m0 0L5.636 5.636m3.536 9.9L5.636 18.364M12 12v.01" />
          </svg>
        );
      case 'rate-limit':
        return (
          <svg className="w-16 h-16 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'validation':
        return (
          <svg className="w-16 h-16 text-highlight" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        );
      case 'network':
      default:
        return (
          <svg className="w-16 h-16 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        );
    }
  };

  const defaultTitles = {
    offline: 'Observatory Disconnected',
    'rate-limit': 'Telemetry Rate Limit Exceeded',
    validation: 'Physical Constraint Breach',
    network: 'Telemetry Link Failure',
    generic: 'System Error Encountered',
  };

  const defaultMessages = {
    offline: 'Unable to establish contact with the ExoHabitAI computational mainframe. Please check if the backend server is running.',
    'rate-limit': 'Too many telemetry analysis requests. The satellite dish is cooling down. Please standby before retrying.',
    validation: 'The planetary parameters provided breach astrophysics constraints. Please verify the planetary mass, radius, and temperature fields.',
    network: 'Deep space communication relay returned a network timeout. Please verify your connection.',
    generic: 'An unexpected telemetry subsystem anomaly has occurred. Please check console telemetry or retry later.',
  };

  return (
    <GlassCard
      glow={true}
      hoverable={false}
      animate={true}
      variant="raised"
      className={`flex flex-col items-center justify-center text-center p-14 max-w-lg mx-auto my-8 border-danger/25 ${className}`}
    >
      <div className="mb-8">{getIcon()}</div>
      <h3 className="text-lg font-bold font-mono text-text-primary tracking-tight mb-4">
        {title || defaultTitles[variant]}
      </h3>
      <p className="text-sm text-text-secondary mb-10 leading-relaxed max-w-sm" style={{ lineHeight: '1.7' }}>
        {message || defaultMessages[variant]}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="btn-primary flex items-center gap-2 border border-primary/40"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.253 8H18" />
          </svg>
          Re-establish Telemetry Link
        </button>
      )}
    </GlassCard>
  );
}
