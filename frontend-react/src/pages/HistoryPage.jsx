import EmptyState from '../components/EmptyState';

export default function HistoryPage() {
  const telescopeIcon = (
    <svg className="w-16 h-16 opacity-40 animate-pulse text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );

  return (
    <div className="site-container flex-grow flex items-center justify-center py-10 md:py-16">
      <EmptyState
        icon={telescopeIcon}
        title="Prediction History System"
        description="The predictive history audit logs and telemetry databases will be integrated in a future mainframe update. Stay tuned!"
        className="w-full max-w-md border-primary/10 bg-space-800/20"
      />
    </div>
  );
}
