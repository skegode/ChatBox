'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import ProtectedRoute from '../../../../components/ProtectedRoute';
import { PERMISSIONS } from '../../../../lib/permissions';

export default function AddMerchantPage() {
  const [form, setForm] = useState({
    businessName: '',
    emailAddress: '',
    phoneNumber: '',
    geoLocation: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await api.post('api/Merchants', {
        businessName: form.businessName,
        emailAddress: form.emailAddress,
        phoneNumber: form.phoneNumber,
        geoLocation: form.geoLocation,
      });
      setSuccess('Merchant added successfully!');
      setForm({ businessName: '', emailAddress: '', phoneNumber: '', geoLocation: '' });
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to add merchant');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute requiredPermissions={['adminOnly']} requiredPolicy={PERMISSIONS.POLICY_VIEW_USERS}>
      <div className="p-4">
        <div className="d-flex justify-content-between align-items-center">
          <h4 className="mb-0"><i className="ri-function-add-line me-2" />New Merchant</h4> 
          <Link
              href="/dashboard/merchants/viewMerchants"
            >
              <i className="ri-arrow-left-line me-2"></i>Merchants
            </Link>
        </div>
        <hr />
        {error && <div className="alert alert-danger my-2">{error}</div>}
        {success && <div className="alert alert-success my-2">{success}</div>}
        <form className="row" onSubmit={handleSubmit}>
          <div className='mb-4 col-md-4'>
            <label htmlFor="BusinessName">Business Name</label>
            <input
              id='BusinessName'
              name="businessName"
              value={form.businessName}
              onChange={handleChange}
              placeholder="Enter Business Name"
              className="form-control"
              required
            />
          </div>
          <div className='mb-4 col-md-4'>
            <label htmlFor="EmailAddress">Email Address</label>
            <input
              id='EmailAddress'
              name="emailAddress"
              value={form.emailAddress}
              onChange={handleChange}
              placeholder="Enter Email Address"
              className="form-control"
              required
            />
          </div>
          <div className='mb-4 col-md-4'>
            <label htmlFor="PhoneNumber">Phone Number</label>
            <input
              id='PhoneNumber'
              name="phoneNumber"
              value={form.phoneNumber}
              onChange={handleChange}
              placeholder="Enter Phone Number"
              className="form-control"
              required
            />
          </div>
          <div className='mb-4 col-md-4'>
            <label htmlFor="GeoLocation">Geo Location</label>
            <input
              id='GeoLocation'
              name="geoLocation"
              value={form.geoLocation}
              onChange={handleChange}
              placeholder="Enter Geo Location"
              className="form-control"
              required
            />
          </div>
          <div className='mb-4 col-md-8 align-self-end text-end'>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? 'Adding...' : 'Add Merchant'}
            </button>
          </div>
        </form>
      </div>
    </ProtectedRoute>
  );
}