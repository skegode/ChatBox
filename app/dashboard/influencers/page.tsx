'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import ProtectedRoute from '../../../components/ProtectedRoute';
import { PERMISSIONS } from '../../../lib/permissions';

type InfluencerItem = {
  id: number;
  firstName?: string | null;
  otherName?: string | null;
  alias?: string | null;
  emailAddress?: string | null;
  phoneNumber?: string | null;
  urlLink?: string | null; // added urlLink returned by API
  createdAt?: string | Date | null;
};

export default function InfluencersPage() {
  const [items, setItems] = useState<InfluencerItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);

  const fetchInfluencers = useCallback(
    async (showLoading = true) => {
      if (showLoading) setLoading(true);
      else setIsRefreshing(true);
      setError(null);

      try {
        const res = await api.get('/api/Influencers', {
          params: {
            q: q || undefined,
            page,
            pageSize,
          },
        });

        const data = res.data;
        if (data && Array.isArray(data.items)) {
          setItems(data.items);
          setTotal(typeof data.total === 'number' ? data.total : 0);
        } else {
          setItems([]);
          setTotal(0);
          setError('Unexpected response from server');
        }
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('Failed to load influencers');
        }
        if (showLoading) setItems([]);
      } finally {
        if (showLoading) setLoading(false);
        else setIsRefreshing(false);
      }
    },
    [q, page, pageSize]
  );

  useEffect(() => {
    fetchInfluencers(true);
    const id = setInterval(() => fetchInfluencers(false), 30000);
    return () => clearInterval(id);
  }, [fetchInfluencers]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <ProtectedRoute requiredPermissions={['adminOnly']} requiredPolicy={PERMISSIONS.POLICY_VIEW_USERS}>
      <div className="w-100 overflow-hidden position-relative">
        {/* Fixed Header */}
        <div className="p-3 p-lg-4 border-bottom user-chat-topbar">
          <div className="d-flex justify-content-between align-items-center">
            <h4 className="mb-0 flex-grow-1"><i className="ri-group-line me-2" />Influencers</h4> 
            <div className='d-flex align-items-center gap-2'>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Name, Alias, Email or Phone"
                className="form-control"
                style={{fontSize: '0.85rem'}}
              />
              <button
                onClick={() => {
                  setPage(1);
                  setQ('');
                  fetchInfluencers(true);
                }}
                className="btn btn-primary"
                style={{fontSize: '0.85rem'}}
              >
                Clear
              </button>
              <button
                onClick={() => fetchInfluencers(true)}
                className="btn btn-primary"
                style={{fontSize: '0.85rem'}}
              >
                Refresh
              </button>
              {isRefreshing && <div className="text-sm text-gray-500" style={{fontSize: '0.8rem'}}>Refreshing...</div>}
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="chat-conversation p-3 p-lg-4" style={{ height: 'calc(100vh - 140px)', overflowY: 'auto' }}>
          {loading ? (
            <div className="text-center p-4" style={{fontSize: '0.9rem'}}>Loading influencers...</div>
          ) : error && (!items || items.length === 0) ? (
            <div className="text-center p-4 text-danger" style={{fontSize: '0.9rem'}}>{error}</div>
          ) : items && items.length > 0 ? (
            <>
              <div className='d-flex justify-content-between align-items-center mb-3'>
                <div className="text-sm text-muted flex-grow-1" style={{fontSize: '0.85rem'}}>
                  Showing page {page} of {totalPages} — {total} total
                </div>
                <div>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                    className="form-control dropdown"
                    style={{fontSize: '0.85rem'}}
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>

              <div className="table-responsive">
                <table className="table table-striped" style={{fontSize: '0.85rem'}}>
                  <thead className="table-light sticky-top">
                    <tr>
                      <th>Name</th>
                      <th>Alias</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Url Link</th>
                      <th>Created At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it) => (
                      <tr key={it.id}>
                        <td>{`${it.firstName ?? ''}${it.otherName ? ' ' + it.otherName : ''}`.trim() || '—'}</td>
                        <td>{it.alias ?? '—'}</td>
                        <td>{it.emailAddress ?? '—'}</td>
                        <td>{it.phoneNumber ?? '—'}</td>
                        <td>{it.urlLink ?? '—'}</td>
                        <td>
                          {it.createdAt ? new Date(it.createdAt).toLocaleString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 d-flex justify-content-between align-items-center">
                <div className="text-sm text-gray-600" style={{fontSize: '0.85rem'}}>
                  Page {page} / {totalPages}
                </div>
                <div className="d-flex items-center gap-2">
                  <button
                    onClick={() => setPage((s) => Math.max(1, s - 1))}
                    disabled={page <= 1}
                    className="btn btn-sm btn-dark"
                    style={{fontSize: '0.85rem'}}
                  >
                    <i className="ri-arrow-left-line me-2"></i> Prev
                  </button>
                  <button
                    onClick={() => setPage((s) => Math.min(totalPages, s + 1))}
                    disabled={page >= totalPages}
                    className="btn btn-sm btn-dark"
                    style={{fontSize: '0.85rem'}}
                  >
                    Next<i className="ri-arrow-right-line ms-2"></i>
                  </button>
                  <button
                    onClick={() => fetchInfluencers(true)}
                    className="btn btn-sm btn-dark"
                    style={{fontSize: '0.85rem'}}
                  >
                    Go<i className="ri-loop-right-line ms-2"></i>
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center p-4 text-muted" style={{fontSize: '0.9rem'}}>No influencers found.</div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}