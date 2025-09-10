
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
  dateCreated?: string | Date | null;
  role?: string | null;
  department?: string | null;
};

export default function UsersPage() {
  const [users, setUsers] = useState<UserItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <ProtectedRoute requiredPermissions={['adminOnly']} requiredPolicy={PERMISSIONS.POLICY_VIEW_USERS}>
      <div className="bg-white p-4">
        <div className="d-flex justify-content-between align-items-center">
          <h4 className="mb-0"><i className="ri-group-line me-2" />Users</h4> 
          <button
              onClick={() => fetchUsers(true)}
              className="btn btn-primary"
            >
              Refresh
            </button>
            {isRefreshing && <div className="text-sm text-gray-500">Refreshing...</div>}
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
                  <th>Role</th>
                  <th>Department</th>
                  <th>Date Created</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      {(u.firstName || '') + (u.otherName ? ` ${u.otherName}` : '')}
                    </td>
                    <td>{u.phoneNumber ?? '—'}</td>
                    <td>{u.role ?? '—'}</td>
                    <td>{u.department ?? '—'}</td>
                    <td>
                      {u.dateCreated ? formatDate(new Date(u.dateCreated)) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-4 text-center text-muted">No users found.</div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
