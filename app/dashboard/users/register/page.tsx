// app/(auth)/signup/page.tsx
// used by Admin to Register New users
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import Input from '../../../../components/ui/Input';
import ErrorMessage from '../../../../components/ui/ErrorMessage';
import api from '../../../../lib/api';
import ProtectedRoute from '../../../../components/ProtectedRoute';
import { PERMISSIONS } from '../../../../lib/permissions';

export default function RegisterPage() {
  const [firstName, setFirstName] = useState('');
  const [otherName, setOtherName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [roleId, setRoleId] = useState<number>(1);
  const [roles, setRoles] = useState<{ id: number; name: string }[]>([]);
  const [departments, setDepartments] = useState<{ id: number; name: string }[]>([]);
  const [departmentId, setDepartmentId] = useState<number>(0); // 0 = none
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Fetch roles on mount
  useEffect(() => {
    api.get('/api/Auth/roles')
      .then((res) => {
        setRoles(
          (res.data || []).map((role: unknown) => ({
            id: (role as { id: number }).id,
            name: (role as { name: string }).name
          }))
        );
      })
      .catch(() => {
        setRoles([{ id: 1, name: 'User' }]);
      });
  }, []);

  // Fetch departments on mount
  useEffect(() => {
    api.get('/api/Auth/departments')
      .then((res) => {
        setDepartments(
          (res.data || []).map((d: unknown) => ({
            id: (d as { id: number }).id,
            name: (d as { name: string }).name
          }))
        );
      })
      .catch(() => {
        setDepartments([]);
      });
  }, []);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        router.push('/dashboard/users');
      }, 2000); // 2 seconds delay
      return () => clearTimeout(timer);
    }
  }, [success, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!firstName || !phone || !password || !confirmPassword) {
      setError('First Name, Phone Number and Password are required');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await api.post('/api/Auth/register', {
        firstName,
        otherName: otherName || undefined,
        phoneNumber: phone,
        password,
        roleID: roleId,
        departmentID: departmentId // send department selection (0 = none)
      });

      // Show success message
      setSuccess('Account created successfully! Redirecting to users page...');

      // Form is reset on success
      setFirstName('');
      setOtherName('');
      setPhone('');
      setPassword('');
      setConfirmPassword('');
      setRoleId(1);
      setDepartmentId(0);
    } catch (err: unknown) {
      const errorMessage = (err as { errorMessage?: string }).errorMessage || 'Failed to sign up';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute requiredPolicy={PERMISSIONS.POLICY_ADMIN_ONLY}>
      <div className="bg-white p-4">
        <div className="d-flex justify-content-between align-items-center">
          <h4 className="mb-0"><i className="ri-group-line me-2" />New User</h4> 
          <Link
              href="/dashboard/users"
            >
              <i className="ri-arrow-left-line me-2"></i>Users
            </Link>
        </div>
        <hr />
        {error && <ErrorMessage message={error} />}
        {success && (
            <div className="alert alert-success my-2" role="alert">
              {success}
            </div>
          )}
        <form onSubmit={handleSubmit} className="row">
            <div className='mb-4 col-md-4'>
              <label htmlFor="FirstName">First Name</label>
              <Input
                id="FirstName"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Enter your first name"
                className="form-control"
                autoComplete="given-name"
              />
            </div>
            <div className='mb-4 col-md-4'>
              <label htmlFor="OtherName">Other Name (Optional)</label>
              <Input
                id="OtherName"
                type="text"
                value={otherName}
                onChange={(e) => setOtherName(e.target.value)}
                placeholder="Enter your other name"
                className="form-control"
                autoComplete="additional-name"
              />
            </div>
            <div className='mb-4 col-md-4'>
              <label htmlFor="phone">Phone Number</label>
              <Input
                id="phone"
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Enter your phone number"
                className="form-control"
                autoComplete="tel"
              />
            </div>
            <div className='mb-4 col-md-4'>
              <label htmlFor="department">Department (optional)</label>
              <select
                id="department"
                value={departmentId}
                onChange={e => setDepartmentId(Number(e.target.value))}
                className="form-control"
              >
                <option value={0}>-- No Department --</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            <div className='mb-4 col-md-4'>
              <label htmlFor="role">Role</label>
              <select
                id="role"
                value={roleId}
                onChange={e => setRoleId(Number(e.target.value))}
                className="form-control"
                required
              >
                {roles.map(role => (
                  <option key={role.id} value={role.id}>{role.name}</option>
                ))}
              </select>
            </div>
            <div className='mb-4 col-md-4'>
              <label htmlFor="password">Password</label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="form-control"
                autoComplete="new-password"
              />
            </div>
            <div className='mb-4 col-md-4'>
              <label htmlFor="confirmPassword">Confirm Password</label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                className="form-control"
                autoComplete="new-password"
              />
            </div>
            <div className='mb-4 col-md-8 align-self-end text-end'>
              <Button
                type="submit"
                className="btn btn-primary"
                disabled={loading || !!success}
              >
                {loading ? 'Registering...' : 'Register'}
              </Button>
            </div>
          </form>
      </div>
    </ProtectedRoute>
  );
}