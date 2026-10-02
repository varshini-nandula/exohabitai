import { useState, useId } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export default function Tooltip({ content, position = 'top', children }) {
  const [active, setActive] = useState(false);
  const tooltipId = useId();

  const showTooltip = () => setActive(true);
  const hideTooltip = () => setActive(false);

  const getPositionClasses = () => {
    switch (position) {
      case 'bottom':
        return 'top-full left-1/2 -translate-x-1/2 mt-2';
      case 'left':
        return 'right-full top-1/2 -translate-y-1/2 mr-2';
      case 'right':
        return 'left-full top-1/2 -translate-y-1/2 ml-2';
      case 'top':
      default:
        return 'bottom-full left-1/2 -translate-x-1/2 mb-2';
    }
  };

  return (
    <div
      className="relative inline-block"
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
    >
      {children || (
        <button
          type="button"
          tabIndex="0"
          className="text-text-muted hover:text-primary transition-colors cursor-help inline-flex items-center justify-center p-0.5"
          aria-label="More information"
          aria-describedby={active ? tooltipId : undefined}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
      )}

      <AnimatePresence>
        {active && (
          <motion.div
            id={tooltipId}
            role="tooltip"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className={`absolute z-50 w-52 p-2.5 text-xs text-text-primary rounded-lg shadow-lg border border-white/10 backdrop-blur-md bg-space-800 pointer-events-none ${getPositionClasses()}`}
            style={{ boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)' }}
          >
            <div className="text-left font-normal leading-relaxed text-slate-300">
              {content}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
