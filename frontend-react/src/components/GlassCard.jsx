import { motion } from 'framer-motion';

const paddingSizes = {
  none: 'card-pad-none',
  xs: 'card-pad-xs',
  sm: 'card-pad-sm',
  md: 'card-pad-md',
  lg: 'card-pad-lg',
  xl: 'card-pad-xl',
};

export default function GlassCard({
  children,
  className = '',
  glow = false,
  hoverable = true,
  animate = false,
  delay = 0,
  variant = 'default', // 'default' | 'raised' | 'inset'
  padding = 'md', // 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'none'
  as: Tag,
}) {
  const CardComponent = animate ? motion.div : (Tag || 'div');
  const isMotion = animate;

  const animationProps = isMotion
    ? {
      initial: { opacity: 0, y: 20 },
      animate: { opacity: 1, y: 0 },
      transition: { duration: 0.5, delay },
    }
    : {};

  const paddingClass = padding === 'none' ? 'card-pad-none' : (paddingSizes[padding] || 'card-pad-md');

  const variantClass = variant === 'raised'
    ? 'surface-raised'
    : variant === 'inset'
      ? 'surface-inset'
      : '';

  const baseClasses = `glass backdrop-blur-md border border-white/10 rounded-2xl ${paddingClass} transition-all duration-200 ${glow ? 'glow-border' : ''
    } ${hoverable ? 'hover:bg-white/[0.07] hover:border-white/15 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20' : ''
    } ${variantClass} ${className}`;

  if (isMotion) {
    return (
      <motion.div className={baseClasses} {...animationProps}>
        {children}
      </motion.div>
    );
  }

  const Element = Tag || 'div';
  return (
    <Element className={baseClasses}>
      {children}
    </Element>
  );
}
