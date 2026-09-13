import { useState, useRef, useEffect } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import Starfield from '../components/Starfield';

export default function MainLayout({ children }) {
  const { isAuthenticated, user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const navigate = useNavigate();
  const userMenuRef = useRef(null);

  const handleLogout = async () => {
    try {
      await logout();
      setMobileMenuOpen(false);
      setUserMenuOpen(false);
      navigate('/');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  // Close user dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);

  const navItems = [
    { to: '/', label: 'Home', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', end: true },
    { to: '/predict', label: 'Predict', icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z' },
    { to: '/rankings', label: 'Rankings', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
    { to: '/about', label: 'About', icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  ];

  const activeClassName = ({ isActive }) =>
    `text-sm font-medium transition-all py-1.5 px-3 rounded-lg inline-flex items-center gap-2 ${
      isActive
        ? 'text-primary bg-primary/8'
        : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
    }`;

  const mobileActiveClassName = ({ isActive }) =>
    `text-base font-medium transition-colors py-3 px-4 rounded-lg flex items-center gap-3 ${
      isActive
        ? 'text-primary bg-primary/10'
        : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
    }`;

  return (
    <div className="min-h-screen flex flex-col relative text-text-primary overflow-x-hidden">
      {/* Skip Navigation */}
      <a href="#main-content" className="skip-nav">
        Skip to main content
      </a>

      {/* Space Background */}
      <Starfield speed={0.08} count={80} />

      {/* Sticky Header Nav */}
      <header className="sticky top-0 z-40 w-full border-b border-white/5 backdrop-blur-md bg-space-900/60 transition-all duration-300">
        <div className="site-container h-16 flex items-center justify-between">
          {/* Logo & Brand */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="relative w-8 h-8 flex items-center justify-center rounded-lg bg-gradient-to-tr from-primary to-accent overflow-hidden group-hover:scale-105 transition-transform">
              <div className="absolute inset-0.5 rounded-md bg-space-900 flex items-center justify-center">
                <div className="w-2.5 h-2.5 rounded-full bg-accent animate-pulse" />
              </div>
            </div>
            <span className="font-bold text-lg tracking-wide bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent group-hover:opacity-90 transition-opacity">
              ExoHabitAI
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={activeClassName}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
                </svg>
                {item.label}
              </NavLink>
            ))}

            {isAuthenticated && (
              <NavLink to="/add-planet" className={activeClassName}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                </svg>
                Add Planet
              </NavLink>
            )}

            {/* User area */}
            {isAuthenticated ? (
              <div className="relative border-l border-white/10 pl-4 ml-3" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 group py-1"
                  aria-label="User menu"
                  aria-expanded={userMenuOpen}
                >
                  <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center font-bold text-primary uppercase text-xs group-hover:bg-primary/30 transition-colors">
                    {user?.username?.[0] || 'U'}
                  </div>
                  <span className="text-sm text-text-secondary font-medium hidden lg:block">
                    {user?.username}
                  </span>
                  <svg
                    className={`w-3 h-3 text-text-muted transition-transform ${userMenuOpen ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Dropdown */}
                <AnimatePresence>
                  {userMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -4, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4, scale: 0.97 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-full mt-2 w-56 glass-strong rounded-xl border border-white/10 py-2 shadow-xl shadow-black/30 z-50"
                    >
                      {/* User info */}
                      <div className="px-4 py-3 border-b border-white/5">
                        <p className="text-sm font-semibold text-text-primary">{user?.username}</p>
                        <p className="text-xs text-text-muted mt-0.5">{user?.email}</p>
                      </div>

                      {/* Account section */}
                      <div className="py-1">
                        <span className="px-4 py-1.5 text-[11px] font-semibold text-text-muted uppercase tracking-wider block">Account</span>
                        <Link
                          to="/profile"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-3 px-4 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-white/5 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          Profile
                        </Link>
                        <Link
                          to="/history"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-3 px-4 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-white/5 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          My Predictions
                        </Link>
                      </div>

                      {/* Admin section */}
                      {user?.role === 'admin' && (
                        <div className="py-1 border-t border-white/5">
                          <Link
                            to="/admin"
                            onClick={() => setUserMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-2 text-sm text-accent hover:text-text-primary hover:bg-white/5 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                            Admin Panel
                          </Link>
                        </div>
                      )}

                      {/* Logout */}
                      <div className="border-t border-white/5 mt-1 pt-1">
                        <button
                          onClick={handleLogout}
                          className="flex items-center gap-3 px-4 py-2 text-sm text-danger/80 hover:text-danger hover:bg-danger/5 transition-colors w-full text-left"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                          Sign Out
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <div className="flex items-center gap-3 border-l border-white/10 pl-4 ml-3">
                <Link
                  to="/login"
                  className="text-sm font-medium transition-colors py-1.5 px-3 text-text-secondary hover:text-text-primary rounded-lg hover:bg-white/5"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="btn-primary text-sm py-1.5 px-4"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </nav>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-text-secondary hover:text-text-primary focus:outline-none"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* Mobile Sidebar Navigation */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-30 md:hidden flex">
            {/* Overlay */}
            <motion.div
              className="fixed inset-0 bg-space-900/80 backdrop-blur-sm"
              onClick={() => setMobileMenuOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              aria-hidden="true"
            />
            {/* Sidebar */}
            <motion.nav
              className="relative flex flex-col w-4/5 max-w-sm h-full bg-space-800 border-r border-white/10 p-6 pt-20 overflow-y-auto"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            >
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={mobileActiveClassName}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
                  </svg>
                  {item.label}
                </NavLink>
              ))}

              {isAuthenticated && (
                <NavLink
                  to="/add-planet"
                  className={mobileActiveClassName}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Planet
                </NavLink>
              )}

              {isAuthenticated ? (
                <div className="mt-8 pt-6 border-t border-white/5">
                  <div className="flex items-center gap-3 px-4 mb-4">
                    <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary uppercase text-sm">
                      {user?.username?.[0] || 'U'}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-semibold text-text-primary truncate">{user?.username}</span>
                      <span className="text-xs text-text-muted truncate">{user?.email}</span>
                    </div>
                  </div>
                  <NavLink to="/profile" className={mobileActiveClassName} onClick={() => setMobileMenuOpen(false)}>
                    Profile
                  </NavLink>
                  <NavLink to="/history" className={mobileActiveClassName} onClick={() => setMobileMenuOpen(false)}>
                    My Predictions
                  </NavLink>
                  {user?.role === 'admin' && (
                    <NavLink to="/admin" className={mobileActiveClassName} onClick={() => setMobileMenuOpen(false)}>
                      Admin Panel
                    </NavLink>
                  )}
                  <button
                    onClick={handleLogout}
                    className="w-full btn-danger justify-start mt-4"
                  >
                    Sign Out
                  </button>
                </div>
              ) : (
                <div className="mt-auto pt-6 border-t border-white/5 flex flex-col gap-3">
                  <Link to="/login" className="btn-secondary w-full justify-center" onClick={() => setMobileMenuOpen(false)}>
                    Sign In
                  </Link>
                  <Link to="/register" className="btn-primary w-full justify-center" onClick={() => setMobileMenuOpen(false)}>
                    Sign Up
                  </Link>
                </div>
              )}
            </motion.nav>
          </div>
        )}
      </AnimatePresence>

      {/* Main Body Content */}
      <main id="main-content" className="flex-grow flex flex-col w-full relative z-10">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-6 backdrop-blur-sm bg-space-950/20 text-center relative z-10">
        <div className="site-container flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-text-muted">
            &copy; {new Date().getFullYear()} ExoHabitAI &mdash; Exoplanet Habitability Prediction Platform
          </p>
          <div className="flex items-center gap-4 text-xs text-text-muted">
            <Link to="/about" className="hover:text-text-secondary transition-colors">About</Link>
            <span className="opacity-30">|</span>
            <Link to="/rankings" className="hover:text-text-secondary transition-colors">Rankings</Link>
            <span className="opacity-30">|</span>
            <Link to="/predict" className="hover:text-text-secondary transition-colors">Predict</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
