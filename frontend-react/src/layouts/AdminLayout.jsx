import { useState } from 'react';
import { NavLink, Link, Outlet } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navSections = [
    {
      label: 'Overview',
      items: [
        { name: 'Dashboard', path: '/admin', end: true, icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z' },
      ],
    },
    {
      label: 'Content',
      items: [
        { name: 'Submissions', path: '/admin/moderation', icon: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 002 2h1.5a3 3 0 013 3v2.8M10 21h4a2 2 0 002-2v-3a2 2 0 00-2-2h-3a2 2 0 01-2-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 012 2v2a2 2 0 002 2z' },
        { name: 'Users', path: '/admin/users', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
      ],
    },
    {
      label: 'Machine Learning',
      items: [
        { name: 'Models', path: '/admin/models', icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
        { name: 'Datasets', path: '/admin/datasets', icon: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4' },
        { name: 'Training', path: '/admin/training', icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15' },
        { name: 'Audit Logs', path: '/admin/logs', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
      ],
    },
  ];

  const activeClass = 'flex items-center gap-3 px-3 py-2.5 text-sm font-semibold rounded-lg bg-primary/10 text-primary transition-all duration-200';
  const inactiveClass = 'flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg text-text-secondary hover:text-text-primary hover:bg-white/5 transition-all duration-200';

  return (
    <div className="flex min-h-screen bg-space-950/20 text-text-primary">
      {/* Mobile Top Header */}
      <div className="fixed top-16 left-0 right-0 h-12 bg-space-900/95 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-4 z-30 md:hidden">
        <span className="font-semibold text-sm tracking-wide bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Admin
        </span>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 text-text-secondary hover:text-text-primary focus:outline-none"
          aria-label="Toggle admin navigation"
          aria-expanded={sidebarOpen}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            className="fixed inset-0 bg-space-900/70 backdrop-blur-sm z-35 md:hidden"
            onClick={() => setSidebarOpen(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {/* Left Sidebar */}
      <aside
        className={`fixed top-16 bottom-0 left-0 w-60 bg-space-900/95 md:bg-space-900/60 border-r border-white/5 backdrop-blur-md flex flex-col z-40 transition-transform duration-300 md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Sidebar header (desktop only) */}
        <div className="hidden md:flex items-center gap-2 px-5 h-14 border-b border-white/5 flex-shrink-0">
          <svg className="w-4.5 h-4.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span className="font-semibold text-sm text-text-primary tracking-wide">Admin</span>
        </div>

        {/* Nav list */}
        <nav className="flex-grow flex flex-col gap-0.5 p-3 mt-12 md:mt-0 overflow-y-auto">
          {navSections.map((section, sIdx) => (
            <div key={section.label} className={sIdx > 0 ? 'mt-5' : ''}>
              <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider px-3 mb-1.5 block">
                {section.label}
              </span>
              {section.items.map((item) => (
                <NavLink
                  key={item.name}
                  to={item.path}
                  end={item.end}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) => (isActive ? activeClass : inactiveClass)}
                >
                  <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
                  </svg>
                  <span>{item.name}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* Back link */}
        <div className="border-t border-white/5 p-3 flex-shrink-0">
          <Link
            to="/"
            className="flex items-center gap-3 px-3 py-2.5 text-sm text-text-muted hover:text-text-primary hover:bg-white/5 transition-all rounded-lg"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to App
          </Link>
        </div>
      </aside>

      {/* Main Content Panel */}
      <div className="flex-grow md:pl-60 min-h-screen pt-28 md:pt-20 pb-12 flex flex-col">
        <div className="flex-grow flex flex-col gap-8 w-full px-5 md:px-10 lg:px-12">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
