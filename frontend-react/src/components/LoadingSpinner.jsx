export default function LoadingSpinner({ message = 'Loading...', size = 'md' }) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12">
      <div className={`${sizeClasses[size]} relative`}>
        <div className="absolute inset-0 rounded-full border-2 border-white/10" />
        <div
          className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary"
          style={{ animation: 'orbit 1s linear infinite' }}
        />
        <div
          className="absolute inset-1.5 rounded-full border-2 border-transparent border-t-accent"
          style={{ animation: 'orbit 1.5s linear infinite reverse' }}
        />
      </div>
      {message && (
        <p className="text-sm text-text-secondary animate-pulse">{message}</p>
      )}
    </div>
  );
}
