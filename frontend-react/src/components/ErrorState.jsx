import GlassCard from './GlassCard';

export default function ErrorState({
  variant = 'generic',
  title,
  message,
  onRetry,
  className = '',
}) {
  const getIcon = () => {
    switch (variant) {
      case 'offline':
        return (
          <svg className="w-14 h-14 text-danger animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-3.536 4.978 4.978 0 011.414-3.536m0 0L5.636 5.636m3.536 9.9L5.636 18.364M12 12v.01" />
          </svg>
        );
      case 'rate-limit':
        return (
          <svg className="w-14 h-14 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'validation':
        return (
          <svg className="w-14 h-14 text-highlight" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        );
      default:
        return (
          <svg className="w-14 h-14 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        );
    }
  };

  const defaultTitles = {
    offline: 'Server Unreachable',
    'rate-limit': 'Too Many Requests',
    validation: 'Invalid Input',
    network: 'Connection Error',
    generic: 'Something Went Wrong',
  };

  const defaultMessages = {
    offline: 'Unable to connect to the server. Please check that the backend is running and try again.',
    'rate-limit': 'You\'ve made too many requests. Please wait a moment before trying again.',
    validation: 'Some of the values you entered are outside valid ranges. Please check your input and try again.',
    network: 'A network error occurred. Please verify your connection and try again.',
    generic: 'An unexpected error occurred. Please try again or contact support if the issue persists.',
  };

  return (
    <GlassCard
      glow={true}
      hoverable={false}
      animate={true}
      variant="raised"
      padding="lg"
      className={`flex flex-col items-center justify-center text-center max-w-lg mx-auto my-8 border-danger/25 ${className}`}
    >
      <div className="mb-6">{getIcon()}</div>
      <h3 className="text-lg font-bold text-text-primary tracking-tight mb-3">
        {title || defaultTitles[variant]}
      </h3>
      <p className="text-sm text-text-secondary mb-8 leading-relaxed max-w-sm" style={{ lineHeight: '1.7' }}>
        {message || defaultMessages[variant]}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="btn-primary flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.253 8H18" />
          </svg>
          Try Again
        </button>
      )}
    </GlassCard>
  );
}
