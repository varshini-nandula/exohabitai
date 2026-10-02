import { useState, useRef, useEffect } from 'react';
import { NavLink, Link, Outlet, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import Starfield from '../components/Starfield';

export default function AdminLayout() {
  const [isHovered, setIsHovered] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const userMenuRef = useRef(null);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  // Close user dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const adminNavItems = [
    {
      name: 'Dashboard',
      path: '/admin',
      end: true,
      icon: (
        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      ),
    },
    {
      name: 'Moderation',
      path: '/admin/moderation',
      icon: (
        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
    },
    {
      name: 'Users',
      path: '/admin/users',
      icon: (
        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
    },
    {
      name: 'Models',
      path: '/admin/models',
      icon: (
        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      name: 'Datasets',
      path: '/admin/datasets',
      icon: (
        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
        </svg>
      ),
    },
    {
      name: 'Training',
      path: '/admin/training',
      icon: (
        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      ),
    },
    {
      name: 'Audit Logs',
      path: '/admin/logs',
      icon: (
        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="min-h-screen w-screen flex bg-space-950 text-text-primary overflow-x-hidden relative">
      {/* Skip Navigation */}
      <a href="#admin-main-content" className="skip-nav">
        Skip to main content
      </a>

      {/* Deep Space Starfield Background */}
      <Starfield speed={0.03} count={35} />

      {/* ── 1. Left Sidebar Navigation (Hover-Expanded) ───────────── */}
      <aside
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`fixed left-0 top-0 bottom-0 z-50 flex flex-col justify-between bg-[#080d1e] border-r border-white/10 backdrop-blur-2xl transition-all duration-300 ease-in-out shadow-2xl ${
          isHovered ? 'w-56' : 'w-14'
        }`}
      >
        {/* Top: Single-line Logo Lockup */}
        <div>
          <div className="h-14 px-3 border-b border-white/10 flex items-center overflow-hidden">
            <Link to="/admin" className="flex items-center gap-2.5 group min-w-0">
              <div className="w-7.5 h-7.5 rounded-lg bg-gradient-to-tr from-primary to-accent flex items-center justify-center p-0.5 shadow-md shadow-primary/20 shrink-0 group-hover:scale-105 transition-transform">
                <div className="w-full h-full bg-space-900 rounded-[6px] flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                </div>
              </div>
              <span
                className={`font-bold text-sm tracking-tight text-white truncate group-hover:text-primary-light transition-all duration-200 ${
                  isHovered ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-3 pointer-events-none hidden'
                }`}
              >
                ExoHabit
              </span>
            </Link>
          </div>

          {/* Navigation Links with Compact Vertical Spacing */}
          <nav className="py-2.5 px-2 flex flex-col gap-1">
            {adminNavItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center h-9 rounded-lg transition-all duration-200 group relative ${
                    isHovered
                      ? 'w-full px-2.5 gap-2.5 justify-start'
                      : 'w-9 mx-auto justify-center'
                  } ${
                    isActive
                      ? 'bg-primary/15 text-primary border border-primary/30 font-semibold shadow-[0_0_12px_rgba(79,140,255,0.18)]'
                      : 'text-text-secondary hover:text-white hover:bg-white/[0.06] border border-transparent'
                  }`
                }
                title={!isHovered ? item.name : undefined}
              >
                <div className="w-4 h-4 shrink-0 flex items-center justify-center">
                  {item.icon}
                </div>
                {isHovered && (
                  <span className="text-[13px] font-medium tracking-wide whitespace-nowrap animate-fadeIn">
                    {item.name}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Bottom: Minimal Status Indicator */}
        <div className="p-2.5 border-t border-white/10 flex items-center">
          {!isHovered ? (
            <div className="w-full flex justify-center" title="System Online">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
            </div>
          ) : (
            <div className="flex items-center gap-2 px-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
              <span className="text-[11px] font-medium text-text-muted">System Online</span>
            </div>
          )}
        </div>
      </aside>

      {/* ── 2. Main Content Canvas ────────────────────────────────── */}
      <div className="flex-1 min-w-0 pl-14 flex flex-col transition-all duration-300">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-40 w-full h-14 flex-shrink-0 border-b border-white/10 bg-[#050914]/80 backdrop-blur-xl">
          <div className="site-container h-full flex items-center justify-between gap-4">
            {/* Left Header Breadcrumb / Title Indicator */}
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-xs font-mono uppercase tracking-widest text-text-muted">Observatory Admin</span>
              <span className="text-white/20">/</span>
              <span className="text-xs font-semibold text-text-secondary">Operations Hub</span>
            </div>

            {/* Right: Exit to App & Admin Profile Dropdown */}
            <div className="flex items-center gap-3 sm:gap-4 ml-auto">
              {/* Exit to Public App Button */}
              <Link
                to="/"
                className="btn-secondary flex items-center gap-2 px-4 py-2.5 text-sm font-semibold flex-shrink-0 cursor-pointer shadow-sm"
                title="Return to public observatory application"
              >
                <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span>Exit to App</span>
              </Link>

              {/* Admin User Profile Dropdown (Exact match to MainLayout navbar dropdown style) */}
              <div className="relative border-l border-white/10 pl-3 sm:pl-4 ml-1" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2.5 group py-1.5 px-3.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-white/20 transition-all cursor-pointer shadow-sm"
                  aria-label="Admin user menu"
                  aria-expanded={userMenuOpen}
                >
                  <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-primary to-accent flex items-center justify-center font-extrabold text-space-900 uppercase text-xs shadow-sm shrink-0">
                    {user?.username?.[0] || 'A'}
                  </div>
                  <span className="text-sm text-text-primary font-medium hidden sm:block">
                    {user?.username || 'admin'}
                  </span>
                  <svg
                    className={`w-3.5 h-3.5 text-text-muted transition-transform duration-200 ${userMenuOpen ? 'rotate-180 text-primary' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Dropdown Menu - Exact MainLayout Cosmic Card Style */}
                <AnimatePresence>
                  {userMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -10, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.96 }}
                      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                      className="absolute right-0 top-full mt-3 w-80 rounded-3xl border border-white/15 shadow-2xl z-50 flex flex-col"
                      style={{
                        padding: '22px 20px 18px 20px',
                        background: 'linear-gradient(145deg, rgba(16, 22, 40, 0.96) 0%, rgba(5, 8, 22, 0.98) 100%)',
                        boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8), 0 0 35px rgba(249, 115, 22, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                        backdropFilter: 'blur(28px)',
                        WebkitBackdropFilter: 'blur(28px)',
                      }}
                    >
                      {/* Ambient glowing radial flare contained inside rounded mask */}
                      <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
                        <div
                          className="absolute -top-12 -left-12 w-40 h-40 rounded-full opacity-40 blur-2xl"
                          style={{
                            background: 'radial-gradient(circle, rgba(249, 115, 22, 0.6) 0%, rgba(79, 140, 255, 0.3) 60%, transparent 100%)',
                          }}
                        />
                      </div>

                      {/* Integrated User Header with generous inset */}
                      <div
                        className="relative z-10 flex items-center gap-3.5"
                        style={{
                          padding: '0 8px 16px 8px',
                          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                          marginBottom: '16px',
                        }}
                      >
                        <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-primary to-accent flex items-center justify-center font-extrabold text-space-900 uppercase text-sm shrink-0 shadow-md">
                          {user?.username?.[0] || 'A'}
                        </div>
                        <div className="min-w-0 flex-grow">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white tracking-tight truncate">{user?.username || 'admin'}</span>
                            <span className="px-2 py-0.5 text-[9px] font-bold rounded-md bg-accent/20 text-accent border border-accent/35 uppercase tracking-wider shrink-0">
                              Admin
                            </span>
                          </div>
                          <p className="text-xs text-text-muted truncate" style={{ marginTop: '4px' }}>{user?.email || 'admin@exohabit.ai'}</p>
                        </div>
                      </div>

                      {/* Navigation Items (Profile & Sign Out) - Clean list */}
                      <div className="relative z-10 flex flex-col" style={{ gap: '6px' }}>
                        {/* 1. Profile / Dashboard */}
                        <Link
                          to="/dashboard"
                          onClick={() => setUserMenuOpen(false)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '14px',
                            padding: '10px 14px',
                            borderRadius: '12px',
                          }}
                          className="text-[15px] font-medium text-text-secondary hover:text-white hover:bg-white/[0.08] transition-all cursor-pointer"
                        >
                          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          <span>User Dashboard & Profile</span>
                        </Link>

                        {/* 2. Admin Operations */}
                        <Link
                          to="/admin"
                          onClick={() => setUserMenuOpen(false)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '14px',
                            padding: '10px 14px',
                            borderRadius: '12px',
                          }}
                          className="text-[15px] font-medium text-accent hover:text-accent hover:bg-accent/10 transition-all cursor-pointer"
                        >
                          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                          </svg>
                          <span>Admin Operations</span>
                        </Link>

                        {/* 3. Sign Out */}
                        <button
                          onClick={() => {
                            setUserMenuOpen(false);
                            handleLogout();
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '14px',
                            padding: '10px 14px',
                            borderRadius: '12px',
                          }}
                          className="text-[15px] font-medium text-danger hover:text-danger-light hover:bg-danger/10 transition-all w-full text-left cursor-pointer group"
                        >
                          <svg className="w-5 h-5 text-danger shrink-0 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                          <span>Sign Out</span>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </header>

        {/* Main Body Page Content */}
        <main id="admin-main-content" tabIndex={-1} className="flex-1 min-w-0 overflow-y-auto bg-space-950/40 relative outline-none">
          <div className="site-container section-padding">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
