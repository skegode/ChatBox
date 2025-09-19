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

  // track expanded promo cells by prospect id
  const [expandedPromoIds, setExpandedPromoIds] = useState<Set<number>>(new Set());

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

  function togglePromo(id: number) {
    setExpandedPromoIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <ProtectedRoute requiredPermissions={['adminOnly']} requiredPolicy={PERMISSIONS.POLICY_VIEW_USERS}>
      <div className="p-4 bg-white">
        <div className="d-flex justify-content-between align-items-center">
          <h4 className="mb-0 flex-grow-1" style={{fontSize: '1rem'}}><i className="ri-group-line me-2" />Prospects</h4> 
          <div className='d-flex align-items-center gap-2'>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, email, phone or code"
              className="form-control"
              style={{fontSize: '0.85rem'}}
            />
            <button
              onClick={() => {
                setPage(1);
                setQ('');
                fetchProspects(true);
              }}
              className="btn btn-primary"
              style={{fontSize: '0.85rem'}}
            >
              Clear
            </button>
            <button
              onClick={() => fetchProspects(true)}
              className="btn btn-primary"
              style={{fontSize: '0.85rem'}}
            >
              Refresh
            </button>
            {isRefreshing && <div className="text-sm text-gray-500" style={{fontSize: '0.8rem'}}>Refreshing...</div>}
          </div>
        </div>
        <div className="pt-3 mt-3 border-top">
          {loading ? (
            <div className="text-center p-4" style={{fontSize: '0.9rem'}}>Loading prospects...</div>
          ) : error && (!items || items.length === 0) ? (
            <div className="text-center p-4 text-danger" style={{fontSize: '0.9rem'}}>{error}</div>
          ) : items && items.length > 0 ? (
            <>
              <div className='d-flex justify-content-between align-items-center'>
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
              
              <div className="overflow-auto mt-3">
                <table className="table table-responsive table-striped" style={{fontSize: '0.85rem'}}>
                  <thead>
                    <tr>
                      <th style={{fontSize: '0.85rem'}}>Name</th>
                      <th style={{fontSize: '0.85rem'}}>Email</th>
                      <th style={{fontSize: '0.85rem'}}>Phone</th>
                      <th style={{fontSize: '0.85rem'}}>Phone Model</th>
                      <th style={{fontSize: '0.85rem'}}>County</th>
                      <th style={{fontSize: '0.85rem'}}>Influencer Code</th>
                      <th style={{fontSize: '0.85rem'}}>Influencer</th>
                      <th style={{fontSize: '0.85rem'}}>Promo</th>
                      <th style={{fontSize: '0.85rem'}}>Created At</th>
                      <th style={{fontSize: '0.85rem'}}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((p) => (
                      <tr key={p.id} style={{verticalAlign: 'middle'}}>
                        <td style={{fontSize: '0.9rem'}}>{getDisplayName(p) || '—'}</td>
                        <td style={{fontSize: '0.85rem'}}>{p.email ?? '—'}</td>
                        <td style={{fontSize: '0.85rem'}}>{p.phone ?? '—'}</td>
                        <td style={{fontSize: '0.85rem'}}>{p.phoneModel ?? '—'}</td>
                        <td style={{fontSize: '0.85rem'}}>{p.county ?? '—'}</td>
                        <td style={{fontSize: '0.85rem'}}>{p.influencerCode ?? '—'}</td>
                        <td style={{fontSize: '0.85rem'}}>{p.influencerName ?? '—'}</td>
                        <td style={{width: 220, maxWidth: 220, paddingTop: 8, paddingBottom: 8}}>
                          {p.promoCode ? (
                            <div>
                              <div
                                onClick={() => togglePromo(p.id)}
                                style={{
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 8,
                                  userSelect: 'none'
                                }}
                                title={p.promoCode}
                                aria-expanded={expandedPromoIds.has(p.id)}
                              >
                                <span
                                  style={{
                                    display: 'inline-block',
                                    maxWidth: 140,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    fontWeight: 600,
                                    fontSize: '0.9rem'
                                  }}
                                >
                                  {p.promoCode}
                                </span>
                                <small className="text-muted" style={{fontSize: '0.75rem'}}>
                                  {expandedPromoIds.has(p.id) ? 'Hide' : 'Details'}
                                </small>
                              </div>

                              {expandedPromoIds.has(p.id) && (
                                <div style={{marginTop: 6, fontSize: '0.78rem', color: '#6c757d', lineHeight: 1.25}}>
                                  {p.promoValue != null && (
                                    <div>Value: {p.promoValue}</div>
                                  )}
                                  {p.promoRedeemed != null && (
                                    <div>Redeemed: {p.promoRedeemed ? 'Yes' : 'No'}</div>
                                  )}
                                  {p.promoExpiresAt && (
                                    <div>Expires: {new Date(p.promoExpiresAt).toLocaleString()}</div>
                                  )}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span style={{fontSize: '0.85rem'}}>—</span>
                          )}
                        </td>
                        <td style={{fontSize: '0.85rem'}}>
                          {p.createdAt ? new Date(p.createdAt).toLocaleString() : '—'}
                        </td>
                        <td>
                          <button
                            onClick={() => openConvertForm(p)}
                            className="btn btn-sm btn-dark"
                            style={{fontSize: '0.8rem', padding: '0.25rem 0.5rem'}}
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
                    onClick={() => fetchProspects(true)}
                    className="btn btn-sm btn-dark"
                    style={{fontSize: '0.85rem'}}
                  >
                    Go<i className="ri-loop-right-line ms-2"></i>
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center p-4 text-muted" style={{fontSize: '0.9rem'}}>No prospects found.</div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}