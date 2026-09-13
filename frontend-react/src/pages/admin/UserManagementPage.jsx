import { useState, useEffect } from 'react';
import { adminAPI } from '../../api/admin';
import GlassCard from '../../components/GlassCard';
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
        setError(res.data?.message || 'Failed to load users.');
      }
    } catch (err) {
      console.error(err);
      setError('Error loading users.');
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

  if (loading && users.length === 0) return <LoadingSpinner message="Loading users..." />;
  if (error) return <ErrorState message={error} onRetry={fetchUsers} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary">Users</h1>
        <p className="text-text-secondary text-sm mt-1">Manage user accounts and roles.</p>
      </div>

      {/* Search */}
      <input
        type="text" placeholder="Search by username or email..."
        value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        className="max-w-md"
      />

      {users.length === 0 ? (
        <GlassCard padding="md" className="text-center text-text-secondary text-sm">No users found.</GlassCard>
      ) : (
        <div className="space-y-4">
          <GlassCard padding="sm" className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Joined</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td className="primary-cell">{u.username}</td>
                      <td>{u.email}</td>
                      <td>
                        <Badge variant={u.role === 'admin' ? 'highlight' : 'neutral'}>{u.role}</Badge>
                      </td>
                      <td className="text-text-muted text-xs">{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</td>
                      <td className="text-right">
                        {u.role === 'user' ? (
                          <button onClick={() => handleRoleChange(u.id, 'admin')} className="btn-ghost text-xs text-primary">
                            Make Admin
                          </button>
                        ) : (
                          <button onClick={() => handleRoleChange(u.id, 'user')} className="btn-ghost text-xs text-warning">
                            Remove Admin
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>

          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={executeRoleChange}
        title={`Change role to "${confirmNewRole}"?`}
        description={confirmNewRole === 'admin'
          ? 'This user will gain full admin access to the platform.'
          : 'This user will lose admin privileges.'}
        confirmLabel="Update Role"
        variant={confirmNewRole === 'admin' ? 'primary' : 'danger'}
        loading={confirmLoading}
      />
    </div>
  );
}
