export default function Pagination({
  page,
  totalPages,
  onPageChange,
  className = '',
}) {
  if (totalPages <= 1) return null;

  return (
    <div className={`flex items-center justify-between font-sans text-sm ${className}`}>
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-text-secondary hover:text-text-primary hover:bg-white/8 disabled:opacity-30 disabled:pointer-events-none transition-colors"
      >
        ← Previous
      </button>
      <span className="text-text-muted">
        Page <span className="text-text-primary font-semibold">{page}</span>{' '}
        of <span className="text-text-primary font-semibold">{totalPages}</span>
      </span>
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-text-secondary hover:text-text-primary hover:bg-white/8 disabled:opacity-30 disabled:pointer-events-none transition-colors"
      >
        Next →
      </button>
    </div>
  );
}
