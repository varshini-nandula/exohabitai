import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export default function Tooltip({ content, position = 'top', children }) {
  const [active, setActive] = useState(false);

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
          tabIndex="-1"
          className="text-text-muted hover:text-primary transition-colors cursor-help inline-flex items-center justify-center p-0.5"
          aria-label="Scientific parameter description"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
      )}

      <AnimatePresence>
        {active && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className={`absolute z-50 w-52 p-2.5 text-xs text-text-primary rounded-lg shadow-lg border border-white/10 backdrop-blur-md bg-space-800 pointer-events-none ${getPositionClasses()}`}
            style={{ boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)' }}
          >
            <div className="font-mono text-left font-normal leading-relaxed text-slate-300">
              {content}
            </div>
            {/* Small arrow */}
            <div
              className={`absolute w-1.5 h-1.5 bg-space-800 border border-white/10 rotate-45 pointer-events-none ${
                position === 'bottom'
                  ? 'bottom-full left-1/2 -translate-x-1/2 translate-y-1/2 border-b-0 border-r-0'
                  : position === 'left'
                  ? 'left-full top-1/2 -translate-y-1/2 -translate-x-1/2 border-t-0 border-r-0'
                  : position === 'right'
                  ? 'right-full top-1/2 -translate-y-1/2 translate-x-1/2 border-b-0 border-l-0'
                  : 'top-full left-1/2 -translate-x-1/2 -translate-y-1/2 border-t-0 border-l-0'
              }`}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
