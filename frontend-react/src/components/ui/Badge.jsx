const variantMap = {
  success: 'badge badge-success',
  warning: 'badge badge-warning',
  danger: 'badge badge-danger',
  info: 'badge badge-info',
  neutral: 'badge badge-neutral',
  highlight: 'badge badge-highlight',
};

export default function Badge({ children, variant = 'neutral', dot = false, className = '' }) {
  return (
    <span className={`${variantMap[variant] || variantMap.neutral} ${className}`}>
      {dot && (
        <span
          className={`inline-block w-1.5 h-1.5 rounded-full ${
            variant === 'success' ? 'bg-success' :
            variant === 'warning' ? 'bg-warning' :
            variant === 'danger' ? 'bg-danger' :
            variant === 'info' ? 'bg-primary' :
            'bg-text-muted'
          }`}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}
