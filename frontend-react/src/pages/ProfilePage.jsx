import { useAuth } from '../hooks/useAuth';
import GlassCard from '../components/GlassCard';

export default function ProfilePage() {
  const { user } = useAuth();

  // Get initials for avatar placeholder
  const getInitials = (name) => {
    if (!name) return 'N';
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="site-container flex-grow flex items-center justify-center py-10 md:py-16">
      <GlassCard
        glow={true}
        hoverable={false}
        animate={true}
        className="w-full max-w-lg border-primary/15 bg-space-800/40 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full filter blur-2xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row items-center gap-6 mb-8 pb-6 border-b border-white/5">
          {/* Avatar Initials Badge */}
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center text-space-900 font-extrabold text-2xl font-mono tracking-wider shadow-lg">
            {getInitials(user?.username)}
          </div>

          <div className="text-center sm:text-left">
            <span className="font-mono text-[9px] tracking-[0.25em] text-accent uppercase font-bold border border-accent/25 px-2 py-0.5 rounded bg-accent/5">
              Authorized Navigator
            </span>
            <h2 className="text-2xl font-bold font-mono text-text-primary tracking-tight mt-2">
              {user?.username || 'Deep Space Navigator'}
            </h2>
            <p className="text-xs text-text-secondary mt-0.5">
              Vessel sector links established.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-5 font-mono text-xs text-text-secondary">
          <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-white/5 border border-white/5">
            <span className="text-[10px] text-text-muted uppercase font-bold">Contact Node</span>
            <span className="text-text-primary text-sm font-semibold">{user?.email || 'telemetry@deepspace.org'}</span>
          </div>

          <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-white/5 border border-white/5">
            <span className="text-[10px] text-text-muted uppercase font-bold">Security Classification Role</span>
            <span className="text-text-primary text-sm font-semibold uppercase">{user?.role || 'Navigator'}</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-white/5 border border-white/5">
              <span className="text-[10px] text-text-muted uppercase font-bold">System Status</span>
              <span className="text-success text-sm font-semibold flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                ONLINE
              </span>
            </div>
            <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-white/5 border border-white/5">
              <span className="text-[10px] text-text-muted uppercase font-bold">Terminal ID</span>
              <span className="text-text-primary text-sm font-semibold">#{user?.id ? user.id.toString().slice(0, 8) : '00000000'}</span>
            </div>
          </div>
        </div>

        <div className="text-[10px] text-text-muted font-mono text-center pt-8">
          SECURITY PROTOCOL ARCHIVE 2.94. FULL MAIN TERMINAL PERMISSIONS APPLIED.
        </div>
      </GlassCard>
    </div>
  );
}
