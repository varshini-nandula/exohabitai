import { forwardRef } from 'react';

const Input = forwardRef(function Input(
  {
    label,
    hint,
    error,
    id,
    className = '',
    containerClassName = '',
    ...props
  },
  ref
) {
  const fieldId = id || props.name;

  return (
    <div className={`form-group ${containerClassName}`}>
      {label && (
        <label htmlFor={fieldId}>{label}</label>
      )}
      <input
        ref={ref}
        id={fieldId}
        className={`${error ? 'field-error' : ''} ${className}`}
        aria-invalid={!!error}
        aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
        {...props}
      />
      {error && (
        <span id={`${fieldId}-error`} className="field-error-msg" role="alert">
          {error}
        </span>
      )}
      {hint && !error && (
        <span id={`${fieldId}-hint`} className="field-hint">
          {hint}
        </span>
      )}
    </div>
  );
});

export default Input;
