'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import ProtectedRoute from '../../../components/ProtectedRoute';
import { PERMISSIONS } from '../../../lib/permissions';
import { useRouter } from 'next/navigation';

type ProspectItem = {
  id: number;
  name?: string | null; 
  firstName?: string | null;
  otherName?: string | null;

  email?: string | null;
  phone?: string | null;
  phoneModel?: string | null;
  county?: string | null;
  influencerCode?: string | null;

  // new fields from the API
  influencerName?: string | null;
  promoCode?: string | null;
  promoValue?: number | null;
  promoRedeemed?: boolean | null;
  promoExpiresAt?: string | Date | null;

  createdAt?: string | Date | null;
};

export default function ProspectsPage() {
  const router = useRouter();
  const [items, setItems] = useState<ProspectItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);

  const fetchProspects = useCallback(
    async (showLoading = true) => {
      if (showLoading) setLoading(true);
      else setIsRefreshing(true);
      setError(null);

      try {
        const res = await api.get('api/Leads/GetProspects', {
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
        setError(
          err instanceof Error
            ? err.message
            : typeof err === 'string'
            ? err
            : 'Failed to load prospects'
        );
        if (showLoading) setItems([]);
      } finally {
        if (showLoading) setLoading(false);
        else setIsRefreshing(false);
      }
    },
    [q, page, pageSize]
  );

  useEffect(() => {
    fetchProspects(true);
    const id = setInterval(() => fetchProspects(false), 30000);
    return () => clearInterval(id);
  }, [fetchProspects]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // helper: build a display name using name OR FirstName + OtherName
  function getDisplayName(p: ProspectItem) {
    const explicit = p.name ?? '';
    if (explicit.trim()) return explicit.trim();
    const combined = `${p.firstName ?? ''}${p.otherName ? ' ' + p.otherName : ''}`.trim();
    return combined || '';
  }

  function openConvertForm(p: ProspectItem) {
    // include new influencer / promo fields so approval form can display them
    const params = new URLSearchParams({
      id: String(p.id),
      // pass computed name (FirstName + OtherName) if name isn't present
      name: getDisplayName(p),
      email: p.email ?? '',
      phone: p.phone ?? '',
      phoneModel: p.phoneModel ?? '',
      county: p.county ?? '',
      influencerCode: p.influencerCode ?? '',
      influencerName: p.influencerName ?? '',
      promoCode: p.promoCode ?? '',
      promoValue: p.promoValue != null ? String(p.promoValue) : '',
      promoRedeemed: p.promoRedeemed != null ? String(p.promoRedeemed) : '',
      promoExpiresAt: p.promoExpiresAt ? new Date(p.promoExpiresAt).toISOString() : '',
    });
    router.push(`/dashboard/prospects/approvalForm?${params.toString()}`);
  }

  return (
    <ProtectedRoute requiredPermissions={['adminOnly']} requiredPolicy={PERMISSIONS.POLICY_VIEW_USERS}>
      <div className="p-4 bg-white">
        <div className="d-flex justify-content-between align-items-center">
          <h4 className="mb-0 flex-grow-1"><i className="ri-group-line me-2" />Prospects</h4> 
          <div className='d-flex align-items-center gap-2'>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, email, phone or code"
              className="form-control"
            />
            <button
              onClick={() => {
                setPage(1);
                setQ('');
                fetchProspects(true);
              }}
              className="btn btn-primary"
            >
              Clear
            </button>
            <button
              onClick={() => fetchProspects(true)}
              className="btn btn-primary"
            >
              Refresh
            </button>
            {isRefreshing && <div className="text-sm text-gray-500">Refreshing...</div>}
          </div>
        </div>
        <div className="pt-3 mt-3 border-top">
          {loading ? (
            <div className="text-center p-4">Loading prospects...</div>
          ) : error && (!items || items.length === 0) ? (
            <div className="text-center p-4 text-danger">{error}</div>
          ) : items && items.length > 0 ? (
            <>
              <div className='d-flex justify-content-between align-items-center'>
                <div className="text-sm text-muted flex-grow-1">
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
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>
              
              <div className="overflow-auto mt-3">
                <table className="table table-responsive table-striped">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Phone Model</th>
                      <th>County</th>
                      <th>Influencer Code</th>
                      <th>Influencer</th>
                      <th>Promo</th>
                      <th>Created At</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((p) => (
                      <tr key={p.id}>
                        <td>{getDisplayName(p) || '—'}</td>
                        <td>{p.email ?? '—'}</td>
                        <td>{p.phone ?? '—'}</td>
                        <td>{p.phoneModel ?? '—'}</td>
                        <td>{p.county ?? '—'}</td>
                        <td>{p.influencerCode ?? '—'}</td>
                        <td>{p.influencerName ?? '—'}</td>
                        <td>
                          {p.promoCode ? (
                            <>
                              <span className="fw-medium">{p.promoCode}</span>
                              <div className="text-muted d-flex flex-column">
                                {p.promoValue != null && (
                                  <span>Value: {p.promoValue}</span>
                                )}
                                {p.promoRedeemed != null && (
                                  <span>Redeemed: {p.promoRedeemed ? 'Yes' : 'No'}</span>
                                )}
                                {p.promoExpiresAt && (
                                  <span>Expires: {new Date(p.promoExpiresAt).toLocaleString()}</span>
                                )}
                              </div>
                            </>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>
                          {p.createdAt ? new Date(p.createdAt).toLocaleString() : '—'}
                        </td>
                        <td>
                          <button
                            onClick={() => openConvertForm(p)}
                            className="btn btn-sm btn-dark"
                          >
                            Convert
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 d-flex justify-content-between align-items-center">
                <div className="text-sm text-gray-600">
                  Page {page} / {totalPages}
                </div>
                <div className="d-flex items-center gap-2">
                  <button
                    onClick={() => setPage((s) => Math.max(1, s - 1))}
                    disabled={page <= 1}
                    className="btn btn-sm btn-dark"
                  >
                    <i className="ri-arrow-left-line me-2"></i> Prev
                  </button>
                  <button
                    onClick={() => setPage((s) => Math.min(totalPages, s + 1))}
                    disabled={page >= totalPages}
                    className="btn btn-sm btn-dark"
                  >
                    Next<i className="ri-arrow-right-line ms-2"></i>
                  </button>
                  <button
                    onClick={() => fetchProspects(true)}
                    className="btn btn-sm btn-dark"
                  >
                    Go<i className="ri-loop-right-line ms-2"></i>
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center p-4 text-muted">No prospects found.</div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}