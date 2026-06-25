import { useState } from 'react';
import { NavLink, Link, Outlet } from 'react-router-dom';

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navItems = [
    {
      name: 'Overview',
      path: '/admin',
      end: true,
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z" />
        </svg>
      ),
    },
    {
      name: 'Planet Moderation',
      path: '/admin/moderation',
      end: false,
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 002 2h1.5a3 3 0 013 3v2.8M10 21h4a2 2 0 002-2v-3a2 2 0 00-2-2h-3a2 2 0 01-2-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 012 2v2a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      name: 'Users',
      path: '/admin/users',
      end: false,
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
    },
    {
      name: 'Models',
      path: '/admin/models',
      end: false,
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ];

  const activeClass = 'flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-lg bg-primary/10 border-l-4 border-primary text-primary transition-all font-mono duration-200';
  const inactiveClass = 'flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-lg text-text-secondary hover:text-text-primary hover:bg-white/5 transition-all font-mono duration-200';

  return (
    <div className="flex min-h-screen bg-space-950/20 text-text-primary">
      {/* Mobile Top Header */}
      <div className="fixed top-16 left-0 right-0 h-14 bg-space-900 border-b border-white/5 flex items-center justify-between px-4 z-30 md:hidden">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm tracking-wider font-mono bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            CONTROL PLANE
          </span>
        </div>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 text-text-secondary hover:text-text-primary focus:outline-none"
          aria-label="Toggle admin navigation menu"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* Left Sidebar */}
      <aside
        className={`fixed top-16 bottom-0 left-0 w-64 bg-space-900/90 md:bg-space-900/60 border-r border-white/5 backdrop-blur-md flex flex-col p-4 z-40 transition-transform duration-300 md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="hidden md:flex flex-col mb-8 px-2">
          <h2 className="font-bold text-xs uppercase tracking-widest text-text-muted font-mono">
            Admin Suite
          </h2>
          <span className="text-sm font-semibold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent font-mono mt-1">
            CONTROL PLANE
          </span>
        </div>

        {/* Nav list */}
        <nav className="flex-grow flex flex-col gap-1 mt-14 md:mt-0">
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              end={item.end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => (isActive ? activeClass : inactiveClass)}
            >
              {item.icon}
              <span>{item.name}</span>
            </NavLink>
          ))}
        </nav>

        {/* Back link */}
        <div className="border-t border-white/5 pt-4">
          <Link
            to="/"
            className="flex items-center gap-3 px-4 py-2.5 text-xs text-text-muted hover:text-text-primary hover:bg-white/5 transition-all font-mono rounded-lg"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Exit Control Plane
          </Link>
        </div>
      </aside>

      {/* Main Right Content Panel */}
      <div className="flex-grow md:pl-64 min-h-screen pt-30 md:pt-20 pb-12 flex flex-col">
        <div className="site-container flex-grow flex flex-col gap-8 w-full max-w-full">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
