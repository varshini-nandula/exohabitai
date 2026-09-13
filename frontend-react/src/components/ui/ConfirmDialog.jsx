import { useState } from 'react';
import Modal from './Modal';
import Button from './Button';

/**
 * Confirmation dialog built on Modal. Replaces native confirm() and prompt().
 * Supports optional text input for rejection reasons.
 */
export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger', // 'danger' | 'primary' | 'success'
  loading = false,
  withInput = false,
  inputLabel = '',
  inputPlaceholder = '',
}) {
  const [inputValue, setInputValue] = useState('');

  const handleConfirm = () => {
    onConfirm(withInput ? inputValue : undefined);
    setInputValue('');
  };

  const handleClose = () => {
    setInputValue('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title} description={description} size="sm">
      {withInput && (
        <div className="mb-6">
          {inputLabel && (
            <label className="text-sm text-text-secondary mb-2 block">{inputLabel}</label>
          )}
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={inputPlaceholder}
            className="w-full"
            autoFocus
          />
        </div>
      )}

      <div className="flex items-center justify-end gap-3 pt-2">
        <Button variant="ghost" onClick={handleClose} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button variant={variant} onClick={handleConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
