import { useState, useEffect } from 'react';
import { adminAPI } from '../../api/admin';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorState from '../../components/ErrorState';
import Badge from '../../components/ui/Badge';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Pagination from '../../components/ui/Pagination';
import { useToast } from '../../context/ToastContext';

export default function UserManagementPage() {
  const { showToast } = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [search, setSearch] = useState('');

  // Confirm dialog state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmUserId, setConfirmUserId] = useState(null);
  const [confirmNewRole, setConfirmNewRole] = useState(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await adminAPI.getUsers({ search: search || undefined, page, per_page: 15 });
      if (res.data?.status === 'success') {
        setUsers(res.data.data.users || []);
        setTotalPages(res.data.data.total_pages || 1);
      } else {
        setError(res.data?.message || 'Failed to load user accounts.');
      }
    } catch (err) {
      console.error(err);
      setError('Error loading user accounts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delay = setTimeout(() => fetchUsers(), 300);
    return () => clearTimeout(delay);
  }, [search, page]);

  const handleRoleChange = (userId, newRole) => {
    setConfirmUserId(userId);
    setConfirmNewRole(newRole);
    setConfirmOpen(true);
  };

  const executeRoleChange = async () => {
    setConfirmLoading(true);
    try {
      const res = await adminAPI.updateUserRole(confirmUserId, confirmNewRole);
      if (res.data?.status === 'success') {
        showToast(`User role updated to "${confirmNewRole}".`, 'success');
        fetchUsers();
      } else {
        showToast(res.data?.message || 'Failed to update role.', 'error');
      }
    } catch (err) {
      showToast('Error updating user role.', 'error');
    } finally {
      setConfirmLoading(false);
      setConfirmOpen(false);
    }
  };

  return (
    <div className="space-y-10">
      {/* ── Page Header ────────────────────────────────────────── */}
      <div className="border-b border-white/10 pb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-text-primary">
            User Accounts & Roles
          </h1>
          <p className="text-text-secondary text-sm sm:text-base leading-relaxed max-w-2xl">
            Directory of registered observatory members, researcher privileges, and administrative roles.
          </p>
        </div>
      </div>

      {/* ── Search & Filter Controls ───────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="relative w-full sm:w-88">
          <input
            type="text"
            placeholder="Search by username or email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full text-sm py-3 pl-11 pr-4 rounded-xl bg-space-900/80 border border-white/10 focus:border-primary/50 text-text-primary placeholder:text-text-muted"
          />
          <svg
            className="w-4 h-4 text-text-muted absolute left-4 top-1/2 -translate-y-1/2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* ── Table Content ──────────────────────────────────────── */}
      {loading && users.length === 0 ? (
        <div className="py-20 flex justify-center">
          <LoadingSpinner message="Loading user directory..." />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={fetchUsers} />
      ) : users.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-space-900/40 border border-white/10 flex flex-col items-center justify-center">
          <p className="text-base font-semibold text-text-primary">No users matched your query</p>
          <p className="text-xs text-text-muted mt-1">Try searching with a different username or email address.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl bg-space-900/60 border border-white/10 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="data-table w-full">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.02]">
                    <th className="py-3.5 px-4 text-left text-xs font-bold uppercase tracking-wider text-text-muted">User</th>
                    <th className="py-3.5 px-4 text-left text-xs font-bold uppercase tracking-wider text-text-muted">Email Address</th>
                    <th className="py-3.5 px-4 text-left text-xs font-bold uppercase tracking-wider text-text-muted">Role</th>
                    <th className="py-3.5 px-4 text-left text-xs font-bold uppercase tracking-wider text-text-muted">Joined Date</th>
                    <th className="py-3.5 px-4 text-right text-xs font-bold uppercase tracking-wider text-text-muted">Privilege Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/20 flex items-center justify-center font-bold text-primary text-xs uppercase">
                            {u.username?.[0] || 'U'}
                          </div>
                          <span className="font-bold text-text-primary text-sm">{u.username}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-text-secondary text-sm">{u.email || '—'}</td>
                      <td className="py-4 px-4">
                        <Badge variant={u.role === 'admin' ? 'highlight' : 'neutral'}>
                          {u.role === 'admin' ? 'Administrator' : 'Standard User'}
                        </Badge>
                      </td>
                      <td className="py-4 px-4 text-text-muted text-xs">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="py-4 px-4 text-right">
                        {u.role === 'user' ? (
                          <button
                            onClick={() => handleRoleChange(u.id, 'admin')}
                            className="px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 border border-primary/25 text-xs font-semibold text-primary transition-colors"
                          >
                            Grant Admin
                          </button>
                        ) : (
                          <button
                            onClick={() => handleRoleChange(u.id, 'user')}
                            className="px-3 py-1.5 rounded-lg bg-warning/10 hover:bg-warning/20 border border-warning/25 text-xs font-semibold text-warning transition-colors"
                          >
                            Revoke Admin
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={executeRoleChange}
        title={`Change role to "${confirmNewRole}"?`}
        description={
          confirmNewRole === 'admin'
            ? 'This user will be granted full administrative and operational access to ExoHabitAI.'
            : 'This user will be demoted to standard observatory access privileges.'
        }
        confirmLabel={confirmNewRole === 'admin' ? 'Grant Admin Access' : 'Revoke Admin Privileges'}
        variant={confirmNewRole === 'admin' ? 'primary' : 'danger'}
        loading={confirmLoading}
      />
    </div>
  );
}
