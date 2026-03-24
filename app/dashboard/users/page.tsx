'use client';

import React, { useEffect, useState, useCallback } from 'react';
// ...existing code...
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

type Role = {
  id: number;
  name: string | null;
  accessRights: string | null;
};

type Department = {
  id: number;
  name: string | null;
};


export default function UsersPage() {
  // delete modal state
  const [deletingUser, setDeletingUser] = useState<UserItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const openDelete = (u: UserItem) => {
    setDeletingUser(u);
    setDeleteError(null);
  };

  const closeDelete = () => {
    setDeletingUser(null);
    setDeleteError(null);
    setDeleteLoading(false);
  };

  const confirmDelete = async () => {
    if (!deletingUser) return;
    setDeleteLoading(true);
    setDeleteError(null);
    const deleteUrl = `/api/Users/${deletingUser.id}`;
    console.log(`🗑️ Attempting DELETE via proxy: ${deleteUrl} (User ID: ${deletingUser.id}, Name: ${deletingUser.firstName} ${deletingUser.otherName || ''})`);
    try {
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
      const res = await fetch(deleteUrl, {
        method: 'DELETE',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          'Accept': 'application/json',
        },
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw { statusCode: res.status, errorMessage: errData?.error || `Delete failed (${res.status})`, responseData: errData };
      }
      console.log(`✅ DELETE successful: Status ${res.status}`);
      setUsers((prev) => prev ? prev.filter((u) => u.id !== deletingUser.id) : prev);
      closeDelete();
    } catch (err: unknown) {
      const status = (err as { statusCode?: number }).statusCode;
      const responseData = (err as { responseData?: unknown }).responseData;
      console.error(`❌ DELETE failed: Status ${status}`, { url: deleteUrl, responseData, err });
      const msg = (err as { errorMessage?: string }).errorMessage || (err as { message?: string }).message || 'Failed to delete user';
      setDeleteError(`${msg} (HTTP ${status || 'unknown'})`);
    } finally {
      setDeleteLoading(false);
    }
  };

  const [users, setUsers] = useState<UserItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // editing modal state
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [editFirstName, setEditFirstName] = useState('');
  const [editOtherName, setEditOtherName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRoleId, setEditRoleId] = useState<number | null>(null);
  const [editDepartmentId, setEditDepartmentId] = useState<number | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  
  // roles and departments data
  const [roles, setRoles] = useState<Role[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loadingDropdowns, setLoadingDropdowns] = useState(false);

  const fetchUsers = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
    } else {
      setIsRefreshing(true);
    }
    setError(null);

    try {
      const res = await api.get('/api/Users');
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

  const fetchRolesAndDepartments = useCallback(async () => {
    setLoadingDropdowns(true);
    try {
      const [rolesRes, deptsRes] = await Promise.all([
        api.get('/api/Users/roles'),
        api.get('/api/Users/departments')
      ]);
      
      if (Array.isArray(rolesRes.data)) {
        setRoles(rolesRes.data);
      }
      
      if (Array.isArray(deptsRes.data)) {
        setDepartments(deptsRes.data);
      }
    } catch (err) {
      console.error('Failed to load dropdown data', err);
    } finally {
      setLoadingDropdowns(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers(true);
    fetchRolesAndDepartments();
    const id = setInterval(() => fetchUsers(false), 30000);
    return () => clearInterval(id);
  }, [fetchUsers, fetchRolesAndDepartments]);

  const openEdit = (u: UserItem) => {
    setEditingUser(u);
    setEditFirstName(u.firstName ?? '');
    setEditOtherName(u.otherName ?? '');
    setEditPhone(u.phoneNumber ?? '');
    setEditEmail(u.email ?? '');
    
    // Find role ID based on role name
    const roleObj = roles.find(r => r.name === u.role);
    setEditRoleId(roleObj?.id ?? null);
    
    // Find department ID based on department name
    const deptObj = departments.find(d => d.name === u.department);
    setEditDepartmentId(deptObj?.id ?? null);
    
    setEditError(null);
  };

  const closeEdit = () => {
    setEditingUser(null);
    setEditFirstName('');
    setEditOtherName('');
    setEditPhone('');
    setEditEmail('');
    setEditRoleId(null);
    setEditDepartmentId(null);
    setEditError(null);
    setEditLoading(false);
  };

  const submitEdit = async () => {
    if (!editingUser) return;
    setEditLoading(true);
    setEditError(null);
    try {
      const payload = {
        firstName: editFirstName,
        otherName: editOtherName,
        phoneNumber: editPhone,
        email: editEmail,
        roleID: editRoleId,
        departmentID: editDepartmentId
      };
      const res = await api.put(`/api/Users/${editingUser.id}`, payload);
      
      // Find role and department names from their IDs for the optimistic update
      const roleName = roles.find(r => r.id === editRoleId)?.name ?? null;
      const deptName = departments.find(d => d.id === editDepartmentId)?.name ?? null;
      
      // update local list (optimistic)
      setUsers((prev) =>
        prev
          ? prev.map((u) => (u.id === editingUser.id ? { 
              ...u, 
              firstName: editFirstName,
              otherName: editOtherName,
              phoneNumber: editPhone, 
              email: editEmail,
              role: roleName,
              department: deptName
            } : u))
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
      <div className="w-100 overflow-hidden position-relative">
        {/* Fixed Header */}
        <div className="p-3 p-lg-4 border-bottom user-chat-topbar">
          <div className="d-flex justify-content-between align-items-center">
            <h4 className="mb-0"><i className="ri-group-line me-2" />Users</h4> 
            <div className="d-flex align-items-center">
              <Link href="/dashboard/users/register" className="btn btn-success me-2">
                <i className="ri-user-add-line me-1"></i>New User
              </Link>
              <button onClick={() => fetchUsers(true)} className="btn btn-primary me-3">Refresh</button>
              {isRefreshing && <div className="text-sm text-gray-500">Refreshing...</div>}
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="chat-conversation p-3 p-lg-4" style={{ height: 'calc(100vh - 140px)', overflowY: 'auto' }}>
          {loading ? (
            <div className="text-center p-4">Loading users...</div>
          ) : error && (!users || users.length === 0) ? (
            <div className="text-center text-danger p-4">{error}</div>
          ) : users && users.length > 0 ? (
            <div className="table-responsive">
              <table className="table table-striped">
                <thead className="table-light sticky-top">
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
                        <Link href={`/dashboard/users/${u.id}`} className="btn btn-sm btn-outline-primary me-2">View</Link>
                        <button className="btn btn-sm btn-outline-danger" onClick={() => openDelete(u)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-4 text-center text-muted">No users found.</div>
          )}
        </div>

        {/* Delete modal */}
        {deletingUser && (
          <>
            <div className="modal-backdrop fade show"></div>
            <div className="modal fade show" style={{ display: 'block' }} tabIndex={-1} role="dialog">
              <div className="modal-dialog" role="document">
                <div className="modal-content">
                  <div className="modal-header">
                    <h5 className="modal-title">Delete user</h5>
                    <button className="btn-close" onClick={closeDelete} />
                  </div>
                  <div className="modal-body">
                    {deleteError && <div className="alert alert-danger">{deleteError}</div>}
                    <p>Are you sure you want to delete user <strong>{(deletingUser.firstName || '') + (deletingUser.otherName ? ` ${deletingUser.otherName}` : '')}</strong>?</p>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={closeDelete} disabled={deleteLoading}>Cancel</button>
                    <button type="button" className="btn btn-danger" onClick={confirmDelete} disabled={deleteLoading}>
                      {deleteLoading ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Edit modal - same as before */}
        {editingUser && (
          <>
            <div className="modal-backdrop fade show"></div>
            <div className="modal fade show" style={{ display: 'block' }} tabIndex={-1} role="dialog">
              <div className="modal-dialog" role="document">
                <div className="modal-content">
                  <div className="modal-header">
                    <h5 className="modal-title">Edit user</h5>
                    <button className="btn-close" onClick={closeEdit} />
                  </div>
                  <div className="modal-body">
                    {editError && <div className="alert alert-danger">{editError}</div>}
                    <div className="mb-3">
                      <label className="form-label">First Name</label>
                      <input type="text" className="form-control" value={editFirstName} onChange={(e) => setEditFirstName(e.target.value)} />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Other Name</label>
                      <input type="text" className="form-control" value={editOtherName} onChange={(e) => setEditOtherName(e.target.value)} />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Phone number</label>
                      <input type="text" className="form-control" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Email</label>
                      <input type="email" className="form-control" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Role</label>
                      <select 
                        className="form-select" 
                        value={editRoleId || ''} 
                        onChange={(e) => setEditRoleId(e.target.value ? Number(e.target.value) : null)}
                        disabled={loadingDropdowns}
                      >
                        <option value="">Select Role</option>
                        {roles.map(role => (
                          <option key={role.id} value={role.id}>{role.name}</option>
                        ))}
                      </select>
                      {loadingDropdowns && <small className="text-muted">Loading roles...</small>}
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Department</label>
                      <select 
                        className="form-select" 
                        value={editDepartmentId || ''} 
                        onChange={(e) => setEditDepartmentId(e.target.value ? Number(e.target.value) : null)}
                        disabled={loadingDropdowns}
                      >
                        <option value="">Select Department</option>
                        {departments.map(dept => (
                          <option key={dept.id} value={dept.id}>{dept.name}</option>
                        ))}
                      </select>
                      {loadingDropdowns && <small className="text-muted">Loading departments...</small>}
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button className="btn btn-secondary me-2" onClick={closeEdit} disabled={editLoading}>Cancel</button>
                    <button className="btn btn-primary" onClick={submitEdit} disabled={editLoading}>
                      {editLoading ? 'Saving...' : 'Save changes'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </ProtectedRoute>
  );
}
