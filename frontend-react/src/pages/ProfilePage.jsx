import { useAuth } from '../hooks/useAuth';
import GlassCard from '../components/GlassCard';

export default function ProfilePage() {
  const { user } = useAuth();

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="site-container flex-grow flex items-center justify-center py-12 md:py-20">
      <GlassCard
        glow={true}
        hoverable={false}
        animate={true}
        variant="raised"
        padding="lg"
        className="w-full max-w-lg relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full filter blur-2xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row items-center gap-8 mb-10 pb-8 border-b border-white/5">
          {/* Avatar */}
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center text-space-900 font-extrabold text-xl tracking-wider shadow-lg shrink-0">
            {getInitials(user?.username)}
          </div>

          <div className="text-center sm:text-left">
            <h2 className="text-2xl font-bold text-text-primary tracking-tight">
              {user?.username || 'User'}
            </h2>
            <p className="text-sm text-text-secondary mt-1">
              Your account details and settings.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 p-5 rounded-xl bg-white/4 border border-white/5">
            <span className="text-xs text-text-muted uppercase font-semibold tracking-wider">Email</span>
            <span className="text-text-primary text-sm font-medium">{user?.email || 'Not provided'}</span>
          </div>

          <div className="flex flex-col gap-2 p-5 rounded-xl bg-white/4 border border-white/5">
            <span className="text-xs text-text-muted uppercase font-semibold tracking-wider">Account Role</span>
            <span className="text-text-primary text-sm font-medium capitalize">{user?.role || 'User'}</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2 p-5 rounded-xl bg-white/4 border border-white/5">
              <span className="text-xs text-text-muted uppercase font-semibold tracking-wider">Status</span>
              <span className="text-success text-sm font-medium flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" aria-hidden="true" />
                Active
              </span>
            </div>
            <div className="flex flex-col gap-2 p-5 rounded-xl bg-white/4 border border-white/5">
              <span className="text-xs text-text-muted uppercase font-semibold tracking-wider">User ID</span>
              <span className="text-text-primary text-sm font-mono font-medium">#{user?.id ? user.id.toString().slice(0, 8) : '00000000'}</span>
            </div>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
