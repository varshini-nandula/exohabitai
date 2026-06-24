import { useState, useRef, useEffect } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
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

  const handleContributeData = () => {
    if (isAuthenticated) {
      navigate('/add-planet');
    } else {
      navigate('/login?redirect=%2Fadd-planet');
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

  const activeClassName = ({ isActive }) =>
    `text-sm font-semibold transition-colors py-2 px-2 relative font-mono inline-flex items-center ${
      isActive
        ? 'text-primary after:absolute after:bottom-0 after:left-2 after:right-2 after:h-0.5 after:bg-primary after:rounded'
        : 'text-text-secondary hover:text-text-primary'
    }`;

  const mobileActiveClassName = ({ isActive }) =>
    `text-lg font-semibold transition-colors py-3 px-4 font-mono rounded-lg ${
      isActive
        ? 'text-primary bg-primary/10 border-l-4 border-primary'
        : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
    }`;

  return (
    <div className="min-h-screen flex flex-col relative text-text-primary overflow-x-hidden">
      {/* Space Background */}
      <Starfield speed={0.08} count={80} />

      {/* Sticky Header Nav */}
      <header className="sticky top-0 z-40 w-full border-b border-white/5 backdrop-blur-md bg-space-900/60 transition-all duration-300">
        <div className="site-container h-16 flex items-center justify-between">
          {/* Logo & Brand */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className="relative w-8 h-8 flex items-center justify-center rounded-lg bg-gradient-to-tr from-primary to-accent overflow-hidden group-hover:scale-105 transition-transform">
              {/* Outer Ring */}
              <div className="absolute inset-0.5 rounded-md bg-space-900 flex items-center justify-center">
                <div className="w-2.5 h-2.5 rounded-full bg-accent animate-pulse" />
              </div>
            </div>
            <span className="font-bold text-lg font-mono tracking-wider bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent group-hover:opacity-90 transition-opacity">
              EXOHABITAI
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            <NavLink to="/" className={activeClassName}>
              HOME
            </NavLink>
            <NavLink to="/predict" className={activeClassName}>
              PREDICT
            </NavLink>
            <NavLink to="/rankings" className={activeClassName}>
              RANKINGS
            </NavLink>
            <NavLink to="/about" className={activeClassName}>
              ABOUT
            </NavLink>
            <button
              onClick={handleContributeData}
              className="text-sm font-semibold transition-colors py-2 px-2 relative font-mono inline-flex items-center text-text-secondary hover:text-text-primary"
            >
              CONTRIBUTE DATA
            </button>

            {/* User area */}
            {isAuthenticated && (
              <div className="relative border-l border-white/10 pl-6 ml-2" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 group"
                  aria-label="User menu"
                >
                  <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center font-bold text-primary font-mono uppercase text-xs group-hover:bg-primary/30 transition-colors">
                    {user?.username?.[0] || 'U'}
                  </div>
                  <svg
                    className={`w-3 h-3 text-text-muted transition-transform ${userMenuOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Dropdown */}
                {userMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-56 glass-strong rounded-xl border border-white/10 py-2 shadow-xl shadow-black/30 z-50">
                    {/* User info */}
                    <div className="px-4 py-3 border-b border-white/5">
                      <p className="text-sm font-semibold text-text-primary font-mono">{user?.username}</p>
                      <p className="text-xs text-text-muted mt-0.5">{user?.email}</p>
                    </div>

                    <Link
                      to="/profile"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-text-secondary hover:text-text-primary hover:bg-white/5 transition-colors font-mono"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Profile
                    </Link>
                    <Link
                      to="/add-planet"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-text-secondary hover:text-text-primary hover:bg-white/5 transition-colors font-mono"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                      </svg>
                      Add Planet
                    </Link>
                    <Link
                      to="/history"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-text-secondary hover:text-text-primary hover:bg-white/5 transition-colors font-mono"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      History
                    </Link>

                    <div className="border-t border-white/5 mt-1 pt-1">
                      <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-danger/80 hover:text-danger hover:bg-danger/5 transition-colors font-mono w-full text-left"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </nav>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-text-secondary hover:text-text-primary focus:outline-none"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* Mobile Sidebar Navigation */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-30 md:hidden flex">
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-space-900/80 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          {/* Sidebar */}
          <nav className="relative flex flex-col w-4/5 max-w-sm h-full bg-space-800 border-r border-white/10 p-6 pt-20 overflow-y-auto">
            <NavLink to="/" className={mobileActiveClassName} onClick={() => setMobileMenuOpen(false)}>
              HOME
            </NavLink>
            <NavLink to="/predict" className={mobileActiveClassName} onClick={() => setMobileMenuOpen(false)}>
              PREDICT
            </NavLink>
            <NavLink to="/rankings" className={mobileActiveClassName} onClick={() => setMobileMenuOpen(false)}>
              RANKINGS
            </NavLink>
            <NavLink to="/about" className={mobileActiveClassName} onClick={() => setMobileMenuOpen(false)}>
              ABOUT
            </NavLink>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                handleContributeData();
              }}
              className="text-lg font-semibold transition-colors py-3 px-4 font-mono rounded-lg text-text-secondary hover:text-text-primary hover:bg-white/5 text-left"
            >
              CONTRIBUTE DATA
            </button>

            {isAuthenticated ? (
              <>
                <div className="mt-8 pt-6 border-t border-white/5">
                  <div className="flex items-center gap-3 px-4 mb-4">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary font-mono uppercase">
                      {user?.username?.[0] || 'U'}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-text-primary">{user?.username}</span>
                      <span className="text-xs text-text-muted">{user?.email}</span>
                    </div>
                  </div>
                  <NavLink to="/profile" className={mobileActiveClassName} onClick={() => setMobileMenuOpen(false)}>
                    PROFILE
                  </NavLink>
                  <NavLink to="/add-planet" className={mobileActiveClassName} onClick={() => setMobileMenuOpen(false)}>
                    ADD PLANET
                  </NavLink>
                  <NavLink to="/history" className={mobileActiveClassName} onClick={() => setMobileMenuOpen(false)}>
                    HISTORY
                  </NavLink>
                  <button
                    onClick={handleLogout}
                    className="w-full btn-secondary text-danger hover:bg-danger/10 border-danger/20 justify-start mt-4"
                  >
                    Logout
                  </button>
                </div>
              </>
            ) : (
              <div className="mt-auto pt-6 border-t border-white/5 flex flex-col gap-3">
                <Link
                  to="/login"
                  className="btn-secondary w-full"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="btn-primary w-full shadow-[0_0_15px_rgba(79,140,255,0.2)]"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Register
                </Link>
              </div>
            )}
          </nav>
        </div>
      )}

      {/* Main Body Content */}
      <main className="flex-grow flex flex-col w-full relative z-10">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-6 backdrop-blur-sm bg-space-950/20 text-center text-xs text-text-muted relative z-10">
        <div className="site-container flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="font-mono">
            &copy; {new Date().getFullYear()} EXOHABITAI. DEEP SPACE OBSERVATORY ANALYTICS MAIN INFRASTRUCTURE.
          </p>
          <div className="flex items-center gap-4 text-[10px] tracking-widest font-mono uppercase">
            <span className="text-accent">Mainframe Active</span>
            <span className="text-text-muted">|</span>
            <span className="text-primary">ML Prediction System</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
