import { useState, useEffect } from 'react';
import { adminAPI } from '../../api/admin';
import { useAuth } from '../../hooks/useAuth';
import GlassCard from '../../components/GlassCard';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorState from '../../components/ErrorState';

export default function UserManagementPage() {
  const { user: currentAdmin } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('all'); // 'all' | 'admin' | 'user'
  const [status, setStatus] = useState('all'); // 'all' | 'active' | 'inactive'
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = {
        page,
        per_page: 15,
        search: search || undefined,
        role: role === 'all' ? undefined : role,
        is_active: status === 'all' ? undefined : (status === 'active' ? 'true' : 'false'),
      };

      const res = await adminAPI.getUsers(params);
      if (res.data?.status === 'success') {
        setUsers(res.data.data.users);
        setTotalPages(res.data.data.total_pages || 1);
      } else {
        setError(res.data?.message || 'Failed to retrieve user registry.');
      }
    } catch (err) {
      console.error(err);
      setError('An error occurred while communicating with user registry database.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    fetchUsers();
  }, [role, status]);

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchUsers();
    }, 500);
    return () => clearTimeout(delayDebounce);
  }, [search, page]);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
    }
  };

  const handleToggleActive = async (user) => {
    if (user.id === currentAdmin?.id) {
      alert("Self deactivation is blocked. You cannot deactivate your own account.");
      return;
    }

    const actionText = user.is_active ? 'deactivate' : 'activate';
    if (!confirm(`Are you sure you want to ${actionText} user account '${user.username}'?`)) {
      return;
    }

    try {
      const res = user.is_active 
        ? await adminAPI.deactivateUser(user.id)
        : await adminAPI.activateUser(user.id);
      
      if (res.data?.status === 'success') {
        fetchUsers();
      } else {
        alert(res.data?.message || `Failed to ${actionText} user account.`);
      }
    } catch (err) {
      console.error(err);
      alert(`Error trying to update account status.`);
    }
  };

  const handleRoleChange = async (user) => {
    if (user.id === currentAdmin?.id) {
      alert("Self demotion is blocked. You cannot demote your own account.");
      return;
    }

    const newRole = user.role === 'admin' ? 'user' : 'admin';
    const actionText = newRole === 'admin' ? 'promote to Administrator' : 'demote to regular User';
    
    if (!confirm(`Are you sure you want to ${actionText} account '${user.username}'?`)) {
      return;
    }

    try {
      const res = newRole === 'admin'
        ? await adminAPI.promoteUser(user.id)
        : await adminAPI.demoteUser(user.id);

      if (res.data?.status === 'success') {
        fetchUsers();
      } else {
        alert(res.data?.message || 'Failed to update user role.');
      }
    } catch (err) {
      console.error(err);
      alert('Error updating user role.');
    }
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent font-mono">
          USER CONFIGURATION
        </h1>
        <p className="text-text-secondary font-mono text-sm mt-1">
          Manage user credentials, roles (Administrator, Researcher/User), and account states.
        </p>
      </div>

      {/* Filter Bar */}
      <GlassCard className="p-4 flex flex-col md:flex-row gap-4 items-center">
        {/* Search */}
        <div className="w-full md:flex-grow">
          <input
            type="text"
            placeholder="Search by username or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg bg-space-900 border border-white/10 text-sm font-mono text-text-primary focus:outline-none focus:border-primary/50 transition-colors"
          />
        </div>

        {/* Dropdowns */}
        <div className="w-full md:w-auto flex flex-wrap gap-4 font-mono text-sm">
          {/* Role Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-text-muted">Role:</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="bg-space-900 border border-white/10 text-text-primary rounded px-3 py-2 focus:outline-none"
            >
              <option value="all">All</option>
              <option value="admin">Admin</option>
              <option value="user">User</option>
            </select>
          </div>

          {/* Status Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-text-muted">Status:</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="bg-space-900 border border-white/10 text-text-primary rounded px-3 py-2 focus:outline-none"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </GlassCard>

      {/* User Table */}
      {loading && users.length === 0 ? (
        <LoadingSpinner message="Querying platform users..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchUsers} />
      ) : users.length === 0 ? (
        <GlassCard className="p-8 text-center text-text-secondary font-mono text-sm">
          No users match the search filters.
        </GlassCard>
      ) : (
        <div className="space-y-4">
          <GlassCard className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm font-mono">
                <thead>
                  <tr className="border-b border-white/5 text-text-muted text-xs uppercase tracking-wider">
                    <th className="p-4 font-semibold">Username</th>
                    <th className="p-4 font-semibold">Email</th>
                    <th className="p-4 font-semibold">Role</th>
                    <th className="p-4 font-semibold">Status</th>
                    <th className="p-4 font-semibold">Submissions</th>
                    <th className="p-4 font-semibold">Last Login</th>
                    <th className="p-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {users.map((u) => {
                    const isSelf = u.id === currentAdmin?.id;
                    return (
                      <tr key={u.id} className="hover:bg-white/5 transition-colors">
                        <td className="p-4 font-bold text-text-primary">
                          {u.username} {isSelf && <span className="text-accent text-xs font-normal ml-1">(you)</span>}
                        </td>
                        <td className="p-4 text-text-secondary">{u.email}</td>
                        <td className="p-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              u.role === 'admin' ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-white/10 text-text-secondary'
                            }`}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className="p-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              u.is_active ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'
                            }`}
                          >
                            {u.is_active ? 'active' : 'suspended'}
                          </span>
                        </td>
                        <td className="p-4 text-text-primary font-semibold">{u.submission_count ?? 0}</td>
                        <td className="p-4 text-text-muted text-xs">
                          {u.last_login_at ? new Date(u.last_login_at).toLocaleString() : 'Never'}
                        </td>
                        <td className="p-4 text-right flex justify-end gap-2">
                          <button
                            disabled={isSelf}
                            onClick={() => handleToggleActive(u)}
                            className={`px-2.5 py-1 text-xs font-semibold font-mono rounded transition-colors ${
                              isSelf
                                ? 'bg-white/5 text-text-muted pointer-events-none opacity-30'
                                : u.is_active
                                ? 'bg-danger/10 text-danger border border-danger/25 hover:bg-danger/20'
                                : 'bg-success/10 text-success border border-success/25 hover:bg-success/20'
                            }`}
                          >
                            {u.is_active ? 'Suspend' : 'Activate'}
                          </button>
                          <button
                            disabled={isSelf}
                            onClick={() => handleRoleChange(u)}
                            className={`px-2.5 py-1 text-xs font-semibold font-mono rounded transition-colors ${
                              isSelf
                                ? 'bg-white/5 text-text-muted pointer-events-none opacity-30'
                                : u.role === 'admin'
                                ? 'bg-white/5 text-text-secondary border border-white/10 hover:bg-white/10'
                                : 'bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20'
                            }`}
                          >
                            {u.role === 'admin' ? 'Demote' : 'Promote'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </GlassCard>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center px-4 font-mono text-sm">
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 1}
                className="px-3 py-1.5 rounded bg-white/5 border border-white/10 text-text-secondary hover:text-text-primary disabled:opacity-30 disabled:pointer-events-none transition-colors"
              >
                &larr; Previous
              </button>
              <span className="text-text-muted">
                Page <span className="text-text-primary font-semibold">{page}</span> of{' '}
                <span className="text-text-primary font-semibold">{totalPages}</span>
              </span>
              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={page === totalPages}
                className="px-3 py-1.5 rounded bg-white/5 border border-white/10 text-text-secondary hover:text-text-primary disabled:opacity-30 disabled:pointer-events-none transition-colors"
              >
                Next &rarr;
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
