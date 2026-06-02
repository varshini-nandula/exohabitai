import { motion } from 'framer-motion';

export default function GlassCard({
  children,
  className = '',
  glow = false,
  hoverable = true,
  animate = false,
  delay = 0,
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

  const baseClasses = `glass backdrop-blur-md border border-white/10 rounded-2xl ${paddingClass} transition-all duration-300 ${
    glow ? 'glow-border' : ''
  } ${
    hoverable ? 'hover:bg-white/10 hover:border-white/20 hover:-translate-y-1' : ''
  } ${className}`;

  return (
    <CardComponent className={baseClasses} {...animationProps}>
      {children}
    </CardComponent>
  );
}
