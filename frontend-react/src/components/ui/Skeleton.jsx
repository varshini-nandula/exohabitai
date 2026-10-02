/**
 * Loading skeleton for cards, tables, and text.
 * Usage: <Skeleton width="100%" height="24px" />
 *        <Skeleton variant="text" lines={3} />
 *        <Skeleton variant="card" />
 */
export default function Skeleton({
  variant = 'rect', // 'rect' | 'text' | 'circle' | 'card'
  width,
  height,
  lines = 3,
  className = '',
}) {
  if (variant === 'text') {
    return (
      <div className={`flex flex-col gap-2.5 ${className}`}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="skeleton h-3.5 rounded"
            style={{ width: i === lines - 1 ? '65%' : '100%' }}
          />
        ))}
      </div>
    );
  }

  if (variant === 'circle') {
    return (
      <div
        className={`skeleton rounded-full ${className}`}
        style={{ width: width || '48px', height: height || width || '48px' }}
      />
    );
  }

  if (variant === 'card') {
    return (
      <div className={`glass rounded-2xl border border-white/8 p-6 ${className}`}>
        <div className="skeleton h-4 w-1/3 rounded mb-4" />
        <div className="skeleton h-3.5 w-full rounded mb-2.5" />
        <div className="skeleton h-3.5 w-4/5 rounded mb-2.5" />
        <div className="skeleton h-3.5 w-2/3 rounded" />
      </div>
    );
  }

  // Default rect
  return (
    <div
      className={`skeleton ${className}`}
      style={{ width: width || '100%', height: height || '20px' }}
    />
  );
}
