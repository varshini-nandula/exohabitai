import { Link } from 'react-router-dom';

/**
 * Breadcrumb navigation for hierarchical pages.
 * Items: [{ label: 'Admin', to: '/admin' }, { label: 'Users' }]
 * Last item has no link (current page).
 */
export default function Breadcrumb({ items = [], className = '' }) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className={`text-sm ${className}`}>
      <ol className="flex items-center gap-1.5 flex-wrap">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={index} className="flex items-center gap-1.5">
              {index > 0 && (
                <svg className="w-3.5 h-3.5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              )}
              {isLast || !item.to ? (
                <span className={`${isLast ? 'text-text-primary font-medium' : 'text-text-muted'}`}>
                  {item.label}
                </span>
              ) : (
                <Link
                  to={item.to}
                  className="text-text-muted hover:text-text-primary transition-colors"
                >
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
