import Breadcrumb from './Breadcrumb';

/**
 * Consistent page header used across all pages.
 * Replaces ad-hoc page-header divs with a unified component.
 */
export default function PageHeader({
  eyebrow,
  eyebrowColor = 'text-primary',
  title,
  description,
  breadcrumbs,
  actions,
  centered = true,
  className = '',
}) {
  return (
    <div className={`${centered ? 'page-header' : 'mb-8'} ${className}`}>
      {breadcrumbs && (
        <div className={`mb-4 ${centered ? 'flex justify-center' : ''}`}>
          <Breadcrumb items={breadcrumbs} />
        </div>
      )}

      <div className={`${!centered ? 'flex items-start justify-between gap-4 flex-wrap' : ''}`}>
        <div className={centered ? '' : 'flex-1 min-w-0'}>
          {eyebrow && (
            <span className={`page-eyebrow ${eyebrowColor}`}>
              {eyebrow}
            </span>
          )}
          {title && <h1>{title}</h1>}
          {description && <p>{description}</p>}
        </div>

        {actions && (
          <div className="flex items-center gap-3 mt-3 lg:mt-0 flex-shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
