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
    <div className="site-container flex-grow flex items-center justify-center py-12 md:py-20">
      <GlassCard
        glow={true}
        hoverable={false}
        animate={true}
        variant="raised"
        className="w-full max-w-lg border-primary/15 relative overflow-hidden p-10"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full filter blur-2xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row items-center gap-8 mb-10 pb-8 border-b border-white/5">
          {/* Avatar Initials Badge */}
          <div className="w-24 h-24 rounded-2xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center text-space-900 font-extrabold text-2xl font-mono tracking-wider shadow-lg shrink-0">
            {getInitials(user?.username)}
          </div>

          <div className="text-center sm:text-left">
            <span className="font-mono text-[9px] tracking-[0.25em] text-accent uppercase font-bold border border-accent/25 px-2.5 py-1 rounded bg-accent/5">
              Authorized Navigator
            </span>
            <h2 className="text-2xl font-bold font-mono text-text-primary tracking-tight mt-3">
              {user?.username || 'Deep Space Navigator'}
            </h2>
            <p className="text-xs text-text-secondary mt-1.5" style={{ lineHeight: '1.6' }}>
              Vessel sector links established.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-5 font-mono text-xs text-text-secondary">
          <div className="flex flex-col gap-2.5 p-5 rounded-xl bg-white/5 border border-white/5">
            <span className="text-[10px] text-text-muted uppercase font-bold">Contact Node</span>
            <span className="text-text-primary text-sm font-semibold">{user?.email || 'telemetry@deepspace.org'}</span>
          </div>

          <div className="flex flex-col gap-2.5 p-5 rounded-xl bg-white/5 border border-white/5">
            <span className="text-[10px] text-text-muted uppercase font-bold">Security Classification Role</span>
            <span className="text-text-primary text-sm font-semibold uppercase">{user?.role || 'Navigator'}</span>
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div className="flex flex-col gap-2.5 p-5 rounded-xl bg-white/5 border border-white/5">
              <span className="text-[10px] text-text-muted uppercase font-bold">System Status</span>
              <span className="text-success text-sm font-semibold flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                ONLINE
              </span>
            </div>
            <div className="flex flex-col gap-2.5 p-5 rounded-xl bg-white/5 border border-white/5">
              <span className="text-[10px] text-text-muted uppercase font-bold">Terminal ID</span>
              <span className="text-text-primary text-sm font-semibold">#{user?.id ? user.id.toString().slice(0, 8) : '00000000'}</span>
            </div>
          </div>
        </div>

        <div className="text-[10px] text-text-muted font-mono text-center pt-10 border-t border-white/5 mt-8">
          SECURITY PROTOCOL ARCHIVE 2.94. FULL MAIN TERMINAL PERMISSIONS APPLIED.
        </div>
      </GlassCard>
    </div>
  );
}
