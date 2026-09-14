import { useState, useRef, useEffect } from 'react';
import { NavLink, Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import Starfield from '../components/Starfield';

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
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

  // Close mobile sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const navSections = [
    {
      label: 'OVERVIEW',
      items: [
        {
          name: 'Dashboard',
          path: '/admin',
          end: true,
          icon: (
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          ),
        },
      ],
    },
    {
      label: 'MODERATION & USERS',
      items: [
        {
          name: 'Submissions',
          path: '/admin/moderation',
          icon: (
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          ),
        },
        {
          name: 'Users',
          path: '/admin/users',
          icon: (
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ),
        },
      ],
    },
    {
      label: 'MACHINE LEARNING',
      items: [
        {
          name: 'Models',
          path: '/admin/models',
          icon: (
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          ),
        },
        {
          name: 'Datasets',
          path: '/admin/datasets',
          icon: (
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
            </svg>
          ),
        },
        {
          name: 'Training',
          path: '/admin/training',
          icon: (
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          ),
        },
        {
          name: 'Audit Logs',
          path: '/admin/logs',
          icon: (
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          ),
        },
      ],
    },
  ];

  const getNavLinkClass = ({ isActive }) =>
    `flex items-center gap-4 px-5 py-7 transition-all duration-200 text-[16px] ${isActive
      ? 'bg-[#0d1b3e] text-[#4f8cff] font-semibold border-l-[3px] border-[#4f8cff]'
      : 'text-[#7a8fa8] hover:text-white font-medium hover:bg-white/[0.05] border-l-[3px] border-transparent'
    }`;

  // Close sidebar on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSidebarOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col bg-space-950 text-text-primary overflow-hidden relative">
      {/* Subtle Deep Space Starfield */}
      <Starfield speed={0.03} count={35} />

      {/* ── Slide-Out Sidebar Drawer & Backdrop (Opens ONLY on Hamburger Click) ── */}
      <AnimatePresence>
        {sidebarOpen && (
          <div className="fixed inset-0 z-50 flex">
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 bg-black/75 backdrop-blur-sm cursor-pointer"
              onClick={() => setSidebarOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              aria-hidden="true"
            />

            {/* Slide-in Drawer */}
            <motion.aside
              className="relative flex flex-col w-80 max-w-[85vw] h-full bg-[#050914] border-r border-white/10 p-6 overflow-y-auto justify-between shadow-2xl z-10"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 300 }}
            >
              <div>
                {/* Drawer Header with Logo & Close Button */}
                <div className="flex items-center justify-between pb-6 mb-6 border-b border-white/10">
                  <Link
                    to="/admin"
                    onClick={() => setSidebarOpen(false)}
                    className="flex items-center gap-3 group"
                  >
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center p-0.5 shadow-md shadow-primary/20 group-hover:scale-105 transition-transform">
                      <div className="w-full h-full bg-space-900 rounded-[8px] flex items-center justify-center">
                        <div className="w-2.5 h-2.5 rounded-full bg-accent animate-pulse" />
                      </div>
                    </div>
                    <div>
                      <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent block">
                        ExoHabitAI
                      </span>
                      <span className="inline-block text-[9px] uppercase font-bold tracking-widest px-2 py-0.5 rounded bg-accent/15 text-accent border border-accent/25 mt-0.5">
                        Operations Console
                      </span>
                    </div>
                  </Link>

                  <button
                    onClick={() => setSidebarOpen(false)}
                    className="p-2 text-text-muted hover:text-text-primary hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
                    aria-label="Close admin navigation"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Drawer Navigation Links */}
                <nav className="space-y-8">
                  {navSections.map((section) => (
                    <div key={section.label}>
                      <span className="text-[11px] font-bold text-[#64748b] uppercase tracking-[0.18em] px-4 mb-2.5 block">
                        {section.label}
                      </span>
                      <div className="space-y-1">
                        {section.items.map((item) => (
                          <NavLink
                            key={item.name}
                            to={item.path}
                            end={item.end}
                            className={getNavLinkClass}
                            onClick={() => setSidebarOpen(false)}
                          >
                            <span className="flex-shrink-0">{item.icon}</span>
                            <span>{item.name}</span>
                          </NavLink>
                        ))}
                      </div>
                    </div>
                  ))}
                </nav>
              </div>

              {/* Drawer Footer */}
              <div className="pt-6 border-t border-white/10 space-y-3 mt-8">
                <Link
                  to="/"
                  onClick={() => setSidebarOpen(false)}
                  className="flex items-center gap-3 px-3 py-2 text-[14px] font-semibold text-[#8a9bb5] hover:text-white transition-colors rounded-xl hover:bg-white/5"
                >
                  <svg className="w-4 h-4 text-[#8a9bb5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  <span>Back to Public App</span>
                </Link>
                <div className="px-3 text-[11px] text-[#64748b] flex items-center justify-between">
                  <span>ML Engine</span>
                  <span className="font-mono font-bold text-[#2dd4bf]">v1.0 • RF</span>
                </div>
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* ── 2. Top Navigation Bar with Hamburger Button ──────────── */}
      <header className="h-18 flex-shrink-0 border-b border-white/10 bg-[#050914]/90 backdrop-blur-xl flex items-center justify-between px-6 sm:px-10 lg:px-16 z-30">
        {/* Left: Brand Identity + Hamburger Trigger Button beside it */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Brand Logo & Console Badge */}
          <Link to="/admin" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center p-0.5 shadow-md shadow-primary/20 group-hover:scale-105 transition-transform">
              <div className="w-full h-full bg-space-900 rounded-[8px] flex items-center justify-center">
                <div className="w-2.5 h-2.5 rounded-full bg-accent animate-pulse" />
              </div>
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent block">
                ExoHabitAI
              </span>
              <span className="hidden sm:inline-block text-[9px] uppercase font-bold tracking-widest px-2 py-0.5 rounded bg-accent/15 text-accent border border-accent/25">
                Operations Console
              </span>
            </div>
          </Link>

          {/* Hamburger Trigger Button (Beside the brand green dot logo) */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex items-center justify-center p-2 sm:p-2.5 rounded-xl bg-white/[0.05] hover:bg-white/10 text-text-primary border border-white/10 hover:border-primary/40 transition-all duration-200 cursor-pointer group shadow-sm ml-1 sm:ml-2"
            aria-label="Open navigation menu"
            title="Open navigation menu"
          >
            <svg className="w-5 h-5 sm:w-5.5 sm:h-5.5 text-[#4f8cff] group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>

        {/* Right: Telemetry Status, Exit link, Profile Dropdown */}
        <div className="flex items-center gap-3 sm:gap-5">
          {/* Telemetry Status Pill */}
          <div className="hidden md:flex items-center gap-2 px-3.5 py-1 rounded-full bg-success/10 border border-success/25 text-xs font-medium text-success">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span>Systems Nominal</span>
          </div>

          {/* Exit to Public App */}
          <Link
            to="/"
            className="flex items-center gap-2 text-xs sm:text-sm font-medium text-text-secondary hover:text-text-primary px-3.5 py-1.5 rounded-xl hover:bg-white/5 transition-colors border border-white/10"
            title="Return to public observatory application"
          >
            <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="hidden sm:inline">Exit to App</span>
          </Link>

          {/* Admin User Profile Dropdown */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2.5 p-1.5 px-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] transition-colors border border-white/10 cursor-pointer"
              aria-label="Admin user menu"
              aria-expanded={userMenuOpen}
            >
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-accent to-primary flex items-center justify-center font-bold text-space-950 uppercase text-xs">
                {user?.username?.[0] || 'A'}
              </div>
              <div className="hidden md:flex flex-col text-left pr-1">
                <span className="text-xs font-semibold text-text-primary leading-tight">
                  {user?.username || 'admin'}
                </span>
                <span className="text-[10px] text-accent font-medium leading-none">
                  Administrator
                </span>
              </div>
              <svg
                className={`w-3.5 h-3.5 text-text-muted transition-transform hidden sm:block ${userMenuOpen ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown Menu */}
            <AnimatePresence>
              {userMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-2 w-56 rounded-2xl bg-[#050914] border border-white/15 p-2 shadow-2xl shadow-black/80 backdrop-blur-xl z-50"
                >
                  <div className="p-3 rounded-xl bg-white/[0.04] border border-white/5 mb-1.5">
                    <p className="text-xs font-bold text-text-primary truncate">{user?.username}</p>
                    <p className="text-[11px] text-text-muted truncate mt-0.5">{user?.email}</p>
                    <span className="inline-block mt-1.5 text-[9px] uppercase font-bold px-2 py-0.5 rounded bg-accent/20 text-accent">
                      Admin Access
                    </span>
                  </div>

                  <Link
                    to="/profile"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-white/5 rounded-lg transition-colors"
                  >
                    <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Profile Settings
                  </Link>

                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-danger hover:bg-danger/10 rounded-lg transition-colors mt-1 border-t border-white/5 cursor-pointer"
                  >
                    <svg className="w-4 h-4 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Sign Out
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* ── 3. Scrollable Page Content Canvas ─────────────────────── */}
      <main className="flex-1 min-w-0 overflow-y-auto bg-space-950/40 relative">
        <div className="site-container section-padding">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
