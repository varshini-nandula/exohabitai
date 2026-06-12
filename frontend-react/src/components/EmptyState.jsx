import GlassCard from './GlassCard';

export default function EmptyState({
  icon,
  title = 'No Astronomical Data Found',
  description = 'Our telescopes scanned this coordinates sector but found no matches. Try adjusting your exploration parameters.',
  actionLabel,
  onAction,
  className = '',
}) {
  return (
    <GlassCard
      hoverable={false}
      animate={true}
      variant="raised"
      className={`flex flex-col items-center justify-center text-center p-10 max-w-lg mx-auto my-8 ${className}`}
    >
      <div className="mb-6 text-text-muted">
        {icon || (
          <svg className="w-12 h-12 opacity-40 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
          </svg>
        )}
      </div>
      <h3 className="text-lg font-bold font-mono text-text-primary tracking-tight mb-3">
        {title}
      </h3>
      <p className="text-sm text-text-secondary mb-8 leading-relaxed max-w-sm" style={{ lineHeight: '1.7' }}>
        {description}
      </p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="btn-secondary text-xs px-5 py-2.5 border border-white/10"
        >
          {actionLabel}
        </button>
      )}
    </GlassCard>
  );
}
