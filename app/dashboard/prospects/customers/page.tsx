'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import ProtectedRoute from '../../../../components/ProtectedRoute';
import { PERMISSIONS } from '../../../../lib/permissions';

type ConvertedCustomer = {
  id: number;
  leadId?: number;
  firstName?: string;
  otherName?: string;
  email?: string;
  phone?: string;
  merchantName?: string;
  influencerName?: string;
  devicePrice?: number;
  financedAmount?: number;
  imei1?: string;
  imei2?: string;
  color?: string;
  memory?: string;
  phoneState?: string;
  createdAt?: string;
};

export default function CustomersPage() {
  // use the ConvertedCustomer type explicitly (nullable initial state like merchants page)
  const [items, setItems] = useState<ConvertedCustomer[] | null>(null);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [pageSize] = useState<number>(25);
  const [q, setQ] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const load = async (p: number = page, query: string = q) => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, unknown> = { page: p, pageSize };
      if (query && String(query).trim() !== '') {
        params.q = query;
      }

      const res = await api.get('/api/Leads/GetConvertedCustomers', { params });

      // explicitly type expected response shape and map to ConvertedCustomer[]
      const data = res.data as { items?: ConvertedCustomer[]; total?: number } | null;
      if (data && typeof data === 'object') {
        setItems(Array.isArray(data.items) ? data.items : []);
        setTotal(typeof data.total === 'number' ? data.total : 0);
        setPage(p);
      } else {
        setItems([]);
        setTotal(0);
      }
    } catch (err: unknown) {
      setError('Failed to load customers.');
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(1, '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    load(1, q);
  };

  const gotoPage = (p: number) => {
    if (p < 1) return;
    const maxPage = Math.max(1, Math.ceil(total / pageSize));
    if (p > maxPage) return;
    load(p, q);
  };

    return (
    <ProtectedRoute requiredPermissions={['adminOnly']} requiredPolicy={PERMISSIONS.POLICY_VIEW_USERS}>
      <div className="w-100 overflow-hidden position-relative">
        {/* Fixed Header */}
        <div className="p-3 p-lg-4 border-bottom user-chat-topbar">
          <div className="d-flex justify-content-between align-items-center">
            <h4 className="mb-0 flex-grow-1"><i className="ri-group-line me-2" />Customers</h4>
            <form onSubmit={onSearch} className="d-flex">
              <div className="input-group">
                <input type="text" className="form-control" value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search by name, phone, email, IMEI..." />
                <div className="input-group-append">
                  <button className="btn btn-primary" type="submit">Search</button>
                </div>
              </div>
            </form>
            <Link
              href="/dashboard/prospects/customers"
              className="btn btn-primary ms-2"
            >
              Refresh
            </Link>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="chat-conversation p-3 p-lg-4" style={{ height: 'calc(100vh - 140px)', overflowY: 'auto' }}>
          {loading ? (
            <div className="text-center p-4">Loading...</div>
          ) : error ? (
            <div className="text-center p-4 text-danger">{error}</div>
          ) : (
            <>
              <div className="table-responsive">
                <table className="table table-striped">
                  <thead className="table-light sticky-top">
                    <tr>
                      <th>Id</th>
                      <th>LeadId</th>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Merchant</th>
                      <th>Influencer</th>
                      <th>DevicePrice</th>
                      <th>FinancedAmount</th>
                      <th>IMEI1</th>
                      <th>IMEI2</th>
                      <th>Color</th>
                      <th>Memory</th>
                      <th>PhoneState</th>
                      <th>CreatedAt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(!items || items.length === 0) ? (
                      <tr>
                        <td colSpan={14} className="text-center text-muted">No customers found</td>
                      </tr>
                    ) : (
                      items.map((it, idx) => (
                        <tr key={it.id ?? idx}>
                          <td>{it.id}</td>
                          <td>{it.leadId ?? ''}</td>
                          <td>{`${it.firstName ?? ''} ${it.otherName ?? ''}`.trim() || '—'}</td>
                          <td>{it.email ?? '—'}</td>
                          <td>{it.phone ?? '—'}</td>
                          <td>{it.merchantName ?? ''}</td>
                          <td>{it.influencerName ?? ''}</td>
                          <td>{it.devicePrice ?? ''}</td>
                          <td>{it.financedAmount ?? ''}</td>
                          <td>{it.imei1 ?? '—'}</td>
                          <td>{it.imei2 ?? '—'}</td>
                          <td>{it.color ?? '—'}</td>
                          <td>{it.memory ?? '—'}</td>
                          <td>{it.phoneState ?? '—'}</td>
                          <td>{it.createdAt ? new Date(it.createdAt).toLocaleString() : '—'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 d-flex justify-content-between align-items-center">
                <div className="text-muted">Page: {page} | Total: {total}</div>
                <div className="d-flex gap-2 align-items-center">
                  <button
                    onClick={() => gotoPage(page - 1)}
                    disabled={page <= 1}
                    className="btn btn-sm btn-dark"
                  >
                    Prev
                  </button>
                  <button
                    onClick={() => gotoPage(page + 1)}
                    disabled={page * pageSize >= total}
                    className="btn btn-sm btn-dark"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}