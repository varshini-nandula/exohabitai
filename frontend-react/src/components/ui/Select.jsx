import { forwardRef } from 'react';

const Select = forwardRef(function Select(
  {
    label,
    hint,
    error,
    id,
    options = [],
    placeholder,
    className = '',
    containerClassName = '',
    ...props
  },
  ref
) {
  const fieldId = id || props.name;

  return (
    <div className={`form-group ${containerClassName}`}>
      {label && <label htmlFor={fieldId}>{label}</label>}
      <select
        ref={ref}
        id={fieldId}
        className={`${error ? 'field-error' : ''} ${className}`}
        aria-invalid={!!error}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => {
          const value = typeof opt === 'object' ? opt.value : opt;
          const text = typeof opt === 'object' ? opt.label : opt;
          return (
            <option key={value} value={value}>
              {text}
            </option>
          );
        })}
      </select>
      {error && (
        <span className="field-error-msg" role="alert">{error}</span>
      )}
      {hint && !error && (
        <span className="field-hint">{hint}</span>
      )}
    </div>
  );
});

export default Select;
