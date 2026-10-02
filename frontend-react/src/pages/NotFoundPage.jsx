import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import GlassCard from '../components/GlassCard';
import Starfield from '../components/Starfield';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 relative text-text-primary overflow-hidden">
      {/* Background Starfield */}
      <Starfield speed={0.06} count={70} />

      {/* Decorative Glow Orbs */}
      <div className="absolute top-1/4 -left-20 w-80 h-80 bg-primary/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-accent/15 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-xl z-10 my-12"
      >
        <GlassCard
          glow={true}
          variant="raised"
          padding="lg"
          className="text-center flex flex-col items-center gap-6 border-white/10"
        >
          {/* Visual 404 Badge */}
          <div className="relative">
            <span className="font-mono text-7xl sm:text-8xl font-black bg-gradient-to-r from-primary via-accent to-[#2dd4bf] bg-clip-text text-transparent select-none">
              404
            </span>
            <div className="absolute -top-2 -right-3 text-2xl animate-bounce">
              🪐
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-text-primary">
              Coordinates Uncharted
            </h1>
            <p className="text-text-secondary text-sm sm:text-base max-w-md mx-auto leading-relaxed">
              The planetary coordinates you navigated to do not exist in the catalog or have drifted outside detectable orbit.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto pt-2">
            <Link
              to="/"
              className="btn-primary flex items-center justify-center gap-2 px-6 py-3"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span>Return to Observatory</span>
            </Link>

            <Link
              to="/predict"
              className="btn-secondary flex items-center justify-center gap-2 px-6 py-3 border-white/10 hover:border-accent/40"
            >
              <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <span>Analyze a Planet</span>
            </Link>
          </div>

          <div className="pt-4 border-t border-white/5 w-full flex justify-center gap-6 text-xs text-text-muted">
            <Link to="/rankings" className="hover:text-text-primary transition-colors">
              Public Rankings
            </Link>
            <span>•</span>
            <Link to="/about" className="hover:text-text-primary transition-colors">
              Research Documentation
            </Link>
            <span>•</span>
            <Link to="/admin" className="hover:text-text-primary transition-colors">
              Operations Console
            </Link>
          </div>
        </GlassCard>
      </motion.div>
    </div>
  );
}
