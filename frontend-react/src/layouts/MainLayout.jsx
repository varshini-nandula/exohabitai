import { useState, useRef, useEffect } from 'react';
import { Link, NavLink, useNavigate, Outlet } from 'react-router-dom';
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
      <header className="sticky top-0 z-40 w-full border-b border-white/5 backdrop-blur-md bg-space-900/70 transition-all duration-300">
        <div className="site-container h-20 flex items-center justify-between">
          {/* Logo & Brand */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="relative w-9 h-9 flex items-center justify-center rounded-xl bg-gradient-to-tr from-primary to-accent overflow-hidden group-hover:scale-105 transition-transform shadow-md">
              <div className="absolute inset-0.5 rounded-lg bg-space-900 flex items-center justify-center">
                <div className="w-2.5 h-2.5 rounded-full bg-accent animate-pulse" />
              </div>
            </div>
            <span className="font-bold text-xl tracking-wide bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent group-hover:opacity-90 transition-opacity">
              ExoHabitAI
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1.5">
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={activeClassName}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
                </svg>
                {item.label}
              </NavLink>
            ))}

            {/* User area */}
            {isAuthenticated ? (
              <div className="relative border-l border-white/10 pl-4 ml-3" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2.5 group py-1.5 px-2.5 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
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
                    className={`w-3.5 h-3.5 text-text-muted transition-transform ${userMenuOpen ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Dropdown */}
                <AnimatePresence>
                  {userMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.96 }}
                      transition={{ duration: 0.18, ease: 'easeOut' }}
                      className="absolute right-0 top-full mt-3.5 w-72 glass-strong rounded-2xl border border-white/15 p-4 shadow-2xl shadow-black/80 z-50 backdrop-blur-2xl bg-space-900/95 flex flex-col gap-3"
                    >
                      {/* User info header card */}
                      <div className="p-3.5 sm:p-4 rounded-xl bg-white/[0.04] border border-white/10 flex items-center gap-3.5 shadow-sm">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center font-extrabold text-space-900 uppercase text-base shrink-0 shadow-md">
                          {user?.username?.[0] || 'U'}
                        </div>
                        <div className="min-w-0 flex-grow">
                          <p className="text-sm font-bold text-text-primary truncate">{user?.username || 'Astronomer'}</p>
                          <p className="text-xs text-text-muted truncate mt-0.5">{user?.email || 'No email provided'}</p>
                        </div>
                      </div>

                      {/* Account section */}
                      <div className="flex flex-col gap-1.5">
                        <span className="px-3 pt-1 pb-0.5 text-[10px] font-bold text-text-muted uppercase tracking-wider block">
                          Account
                        </span>
                        <Link
                          to="/dashboard"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-white/10 rounded-xl transition-all"
                        >
                          <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                          </svg>
                          Dashboard
                        </Link>
                      </div>

                      {/* Admin section */}
                      {user?.role === 'admin' && (
                        <div className="flex flex-col gap-1.5 border-t border-white/10 pt-2.5">
                          <span className="px-3 pt-1 pb-0.5 text-[10px] font-bold text-accent uppercase tracking-wider block">
                            Administration
                          </span>
                          <Link
                            to="/admin"
                            onClick={() => setUserMenuOpen(false)}
                            className="flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium text-accent hover:text-white hover:bg-accent/15 rounded-xl transition-all"
                          >
                            <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                            Admin Panel
                          </Link>
                        </div>
                      )}

                      {/* Logout */}
                      <div className="border-t border-white/10 pt-2.5">
                        <button
                          onClick={handleLogout}
                          className="flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium text-danger/90 hover:text-danger hover:bg-danger/10 border border-transparent hover:border-danger/20 transition-all w-full text-left rounded-xl cursor-pointer"
                        >
                          <svg className="w-4 h-4 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
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
              <div className="flex items-center border-l border-white/10 pl-4 ml-3">
                <Link
                  to="/login"
                  className="btn-primary text-sm py-2 px-5 font-semibold shadow-[0_0_15px_rgba(79,140,255,0.2)]"
                >
                  Sign In
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

              {isAuthenticated ? (
                <div className="mt-8 pt-6 border-t border-white/10 flex flex-col gap-3">
                  <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-white/[0.04] border border-white/10 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center font-bold text-space-900 uppercase text-sm shrink-0 shadow-md">
                      {user?.username?.[0] || 'U'}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-bold text-text-primary truncate">{user?.username}</span>
                      <span className="text-xs text-text-muted truncate mt-0.5">{user?.email}</span>
                    </div>
                  </div>
                  <NavLink to="/dashboard" className={mobileActiveClassName} onClick={() => setMobileMenuOpen(false)}>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                    Dashboard
                  </NavLink>
                  {user?.role === 'admin' && (
                    <NavLink to="/admin" className={mobileActiveClassName} onClick={() => setMobileMenuOpen(false)}>
                      <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                      Admin Panel
                    </NavLink>
                  )}
                  <button
                    onClick={handleLogout}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '10px',
                      padding: '13px 24px',
                      borderRadius: '9999px',
                      backgroundColor: 'rgba(239, 68, 68, 0.15)',
                      border: '1px solid rgba(239, 68, 68, 0.35)',
                      color: '#EF4444',
                      fontWeight: 600,
                      fontSize: '0.875rem',
                      cursor: 'pointer',
                      width: '100%',
                      marginTop: '8px',
                      boxSizing: 'border-box',
                    }}
                    className="hover:bg-danger/25 hover:border-danger/50 transition-all"
                  >
                    <svg className="w-4 h-4 text-danger shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    <span>Sign Out</span>
                  </button>
                </div>
              ) : (
                <div className="mt-auto pt-6 border-t border-white/5 flex flex-col gap-3">
                  <Link to="/login" className="btn-primary w-full justify-center py-3 font-semibold text-sm" onClick={() => setMobileMenuOpen(false)}>
                    Sign In
                  </Link>
                </div>
              )}
            </motion.nav>
          </div>
        )}
      </AnimatePresence>

      {/* Main Body Content */}
      <main id="main-content" className="flex-grow flex flex-col w-full relative z-10">
        {children || <Outlet />}
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
