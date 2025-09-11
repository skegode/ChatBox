'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils/formatDate';
import ProtectedRoute from '../../../components/ProtectedRoute';
import { PERMISSIONS } from '../../../lib/permissions';


type UserItem = {
  id: number;
  firstName?: string | null;
  otherName?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
  dateCreated?: string | Date | null;
  role?: string | null;
  department?: string | null;
};

export default function UsersPage() {
  const [users, setUsers] = useState<UserItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // editing modal state
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const fetchUsers = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
    } else {
      setIsRefreshing(true);
    }
    setError(null);

    try {
      const res = await api.get('api/Users');
      if (Array.isArray(res.data)) {
        setUsers(res.data);
      } else {
        setUsers([]);
        setError('Unexpected response from server');
      }
    } catch (err: unknown) {
      console.error('Failed to load users', err);
      // api.ts enhances errors with useful props
      const msg = (err as { errorMessage?: string }).errorMessage || (err as { message?: string }).message || 'Failed to load users';
      setError(msg);
      if (!(err as { isApiError?: boolean }).isApiError && (err as { response?: { status?: number } }).response?.status === 401) {
        setError('Authentication required. Please sign in.');
      }
      // keep previous users on silent refresh failure
      if (showLoading) setUsers([]);
    } finally {
      if (showLoading) setLoading(false);
      else setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers(true);
    const id = setInterval(() => fetchUsers(false), 30000);
    return () => clearInterval(id);
  }, [fetchUsers]);

  const openEdit = (u: UserItem) => {
    setEditingUser(u);
    setEditPhone(u.phoneNumber ?? '');
    setEditEmail(u.email ?? '');
    setEditError(null);
  };

  const closeEdit = () => {
    setEditingUser(null);
    setEditPhone('');
    setEditEmail('');
    setEditError(null);
    setEditLoading(false);
  };

  const submitEdit = async () => {
    if (!editingUser) return;
    setEditLoading(true);
    setEditError(null);
    try {
      const payload = {
        phoneNumber: editPhone,
        email: editEmail,
      };
      const res = await api.put(`api/Users/${editingUser.id}`, payload);
      // update local list (optimistic)
      setUsers((prev) =>
        prev
          ? prev.map((u) => (u.id === editingUser.id ? { ...u, phoneNumber: editPhone, email: editEmail } : u))
          : prev
      );
      closeEdit();
    } catch (err: unknown) {
      console.error('Failed to update user', err);
      const msg = (err as { errorMessage?: string }).errorMessage || (err as { message?: string }).message || 'Failed to update user';
      setEditError(msg);
    } finally {
      setEditLoading(false);
    }
  };

  return (
    <ProtectedRoute requiredPermissions={['adminOnly']} requiredPolicy={PERMISSIONS.POLICY_VIEW_USERS}>
      <div className="bg-white p-4">
        <div className="d-flex justify-content-between align-items-center">
          <h4 className="mb-0"><i className="ri-group-line me-2" />Users</h4> 
          <div className="d-flex align-items-center">
            <button onClick={() => fetchUsers(true)} className="btn btn-primary me-3">Refresh</button>
            {isRefreshing && <div className="text-sm text-gray-500">Refreshing...</div>}
          </div>
        </div>
        <div className="pt-3 mt-3 border-top">
          {loading ? (
            <div className="text-center p-4">Loading users...</div>
          ) : error && (!users || users.length === 0) ? (
            <div className="text-center text-danger p-4">{error}</div>
          ) : users && users.length > 0 ? (
            <table className="table table-striped">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone No:</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Department</th>
                  <th>Date Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>{(u.firstName || '') + (u.otherName ? ` ${u.otherName}` : '')}</td>
                    <td>{u.phoneNumber ?? '—'}</td>
                    <td>{u.email ?? '—'}</td>
                    <td>{u.role ?? '—'}</td>
                    <td>{u.department ?? '—'}</td>
                    <td>{u.dateCreated ? formatDate(new Date(u.dateCreated)) : '—'}</td>
                    <td>
                      <button className="btn btn-sm btn-outline-secondary me-2" onClick={() => openEdit(u)}>Edit</button>
                      <Link href={`/dashboard/users/${u.id}`} className="btn btn-sm btn-outline-primary">View</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-4 text-center text-muted">No users found.</div>
          )}
        </div>

        {/* Edit modal */}
        {editingUser && (
          <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style={{ zIndex: 1050, background: 'rgba(0,0,0,0.4)' }}>
            <div className="bg-white rounded shadow" style={{ width: 540, maxWidth: '95%' }}>
              <div className="p-3 border-bottom d-flex justify-content-between align-items-center">
                <h5 className="mb-0">Edit user</h5>
                <button className="btn-close" onClick={closeEdit} />
              </div>
              <div className="p-3">
                {editError && <div className="alert alert-danger">{editError}</div>}
                <div className="mb-3">
                  <label className="form-label">Phone number</label>
                  <input type="text" className="form-control" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
                </div>
                <div className="mb-3">
                  <label className="form-label">Email</label>
                  <input type="email" className="form-control" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
                </div>
                <div className="d-flex justify-content-end">
                  <button className="btn btn-secondary me-2" onClick={closeEdit} disabled={editLoading}>Cancel</button>
                  <button className="btn btn-primary" onClick={submitEdit} disabled={editLoading}>
                    {editLoading ? 'Saving...' : 'Save changes'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
