'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import ProtectedRoute from '../../../../components/ProtectedRoute';
import { PERMISSIONS } from '../../../../lib/permissions';

type MerchantItem = {
  id: number;
  businessName?: string | null;
  emailAddress?: string | null;
  phoneNumber?: string | null;
  geoLocation?: string | null;
  createdAt?: string | Date | null;
};

export default function ViewMerchantsPage() {
  const [merchants, setMerchants] = useState<MerchantItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMerchants = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('api/Merchants');
      if (Array.isArray(res.data)) {
        setMerchants(res.data);
      } else {
        setMerchants([]);
        setError('Unexpected response from server');
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to load merchants');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMerchants();
  }, [fetchMerchants]);

  return (
    <ProtectedRoute requiredPermissions={['adminOnly']} requiredPolicy={PERMISSIONS.POLICY_VIEW_USERS}>
      <div className="bg-white p-4">
        <div className="d-flex justify-content-between align-items-center">
          <h4 className="mb-0"><i className="ri-function-line me-2" />Merchants</h4> 
          <Link
              href="/dashboard/merchants/addMerchant"
            >
              <i className="ri-add-line me-2"></i>Add Merchant
            </Link>
        </div>
        <div className="pt-3 mt-3 border-top">
          {loading ? (
            <div className="text-center p-4">Loading merchants...</div>
          ) : error ? (
            <div className="text-center text-danger p-4">{error}</div>
          ) : merchants && merchants.length > 0 ? (
            <table className="table table-striped">
              <thead>
                <tr>
                  <th>Business Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Geo Location</th>
                  <th>Created At</th>
                </tr>
              </thead>
              <tbody>
                {merchants.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td>{m.businessName ?? '—'}</td>
                    <td>{m.emailAddress ?? '—'}</td>
                    <td>{m.phoneNumber ?? '—'}</td>
                    <td>{m.geoLocation ?? '—'}</td>
                    <td>
                      {m.createdAt ? new Date(m.createdAt).toLocaleString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-4 text-center text-muted">No merchants found.</div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}