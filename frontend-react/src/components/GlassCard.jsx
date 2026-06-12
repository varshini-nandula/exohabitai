import { motion } from 'framer-motion';

export default function GlassCard({
  children,
  className = '',
  glow = false,
  hoverable = true,
  animate = false,
  delay = 0,
  variant = 'default', // 'default' | 'raised' | 'inset'
}) {
  const CardComponent = animate ? motion.div : 'div';

  const animationProps = animate
    ? {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.5, delay },
      }
    : {};

  const hasPadding = className.split(' ').some(c => c.startsWith('p-') || c.startsWith('px-') || c.startsWith('py-'));
  const paddingClass = hasPadding ? '' : 'p-6';

  // Variant-specific classes
  const variantClass = variant === 'raised'
    ? 'surface-raised'
    : variant === 'inset'
    ? 'surface-inset'
    : '';

  const baseClasses = `glass backdrop-blur-md border border-white/10 rounded-2xl ${paddingClass} transition-all duration-200 ${
    glow ? 'glow-border' : ''
  } ${
    hoverable ? 'hover:bg-white/[0.07] hover:border-white/15 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20' : ''
  } ${variantClass} ${className}`;

  return (
    <CardComponent className={baseClasses} {...animationProps}>
      {children}
    </CardComponent>
  );
}
