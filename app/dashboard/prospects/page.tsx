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
  firstName: string;
  otherName: string | null;
  email: string;
  phone: string;
  phoneModel: string;
  county: string;
  influencerCode: string | null;
  influencerName: string;
  referralSource: 'Merchant' | 'Client' | 'Unknown';
  referrerName: string;
  merchantCode?: string | null;
  referrerPhone?: string | null;
  referrerId: number | null;
  promoCode: string | null;
  promoValue: number | null;
  promoRedeemed: boolean | null;
  promoExpiresAt: string | null;
  createdAt: string;
  status: string;
};

export default function ProspectsPage() {
  const router = useRouter();
  const [items, setItems] = useState<ProspectItem[] | null>(null);
  const [statusUpdating, setStatusUpdating] = useState<{ [id: number]: boolean }>({});
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [countyFilter, setCountyFilter] = useState('');
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
        const res = await api.get('/api/Leads/GetProspects', {
          params: {
            q: q || undefined,
            page,
            pageSize,
          },
        });

        const data = res.data;
        if (data && Array.isArray(data.items)) {
          // Ensure prospects with no status show as "New"
          const normalized = data.items.map((it: any) => ({ ...it, status: it.status || 'New' }));
          setItems(normalized);
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
      // Leave influencerCode blank for client referrals (clientreferral API)
      influencerCode: p.referralSource === 'Client' ? '' : p.influencerCode ?? '',
      influencerName: p.influencerName ?? '',
      promoCode: p.promoCode ?? '',
      promoValue: p.promoValue != null ? String(p.promoValue) : '',
      promoRedeemed: p.promoRedeemed != null ? String(p.promoRedeemed) : '',
      promoExpiresAt: p.promoExpiresAt ? new Date(p.promoExpiresAt).toISOString() : '',
    });
    router.push(`/dashboard/prospects/approvalForm?${params.toString()}`);
  }

  function openDetail(p: ProspectItem) {
    // navigate to new detail page
    router.push(`/dashboard/prospects/${p.id}`);
  }

  function statusDotColor(status?: string) {
    const s = (status || '').toLowerCase();
    if (s.includes('progress')) return '#f59e0b'; // yellow
    if (s.includes('new')) return '#60a5fa'; // blue
    if (s.includes('closed') || s.includes('completed') || s.includes('converted')) return '#10b981'; // green
    if (s.includes('unknown') || s.includes('unknown')) return '#8b5cf6'; // purple
    return '#94a3b8';
  }

  function renderStatusBadge(status?: string) {
    const label = status || 'Unknown';
    const color = statusDotColor(status);
    return (
      <span style={{ display: 'inline-block', padding: '6px 12px', borderRadius: 999, background: `${color}22`, color, fontWeight: 700, fontSize: '0.85rem' }}>{label}</span>
    );
  }

  function togglePromo(id: number) {
    setExpandedPromoIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

    // Handler to update status
    const handleStatusChange = async (id: number, newStatus: string) => {
      setStatusUpdating((prev) => ({ ...prev, [id]: true }));
      try {
        const res = await api.patch('/api/Leads/UpdateProspectStatus', { LeadId: id, Status: newStatus });
        const updated = res?.data;
        setItems((prev) =>
          prev
            ? prev.map((item) =>
                item.id === id
                  ? { ...item, status: (updated && (updated.Status || (updated.status as string))) || newStatus }
                  : item
              )
            : prev
        );
      } catch (err) {
        alert('Failed to update status');
      } finally {
        setStatusUpdating((prev) => ({ ...prev, [id]: false }));
      }
    };

    // Filter out duplicate prospects by id
    const uniqueItems = items
      ? items.filter((item, index, self) =>
          index === self.findIndex((t) => t.id === item.id)
        )
      : [];

    return (
    <ProtectedRoute requiredPermissions={['adminOnly']} requiredPolicy={PERMISSIONS.POLICY_VIEW_USERS}>
      <div className="w-100 overflow-hidden position-relative">
        {/* Fixed Header */}
        <div className="p-3 p-lg-4 border-bottom user-chat-topbar">
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
        </div>

        {/* Scrollable Content */}
        <div className="chat-conversation p-3 p-lg-4" style={{ height: 'calc(100vh - 140px)', overflowY: 'auto' }}>
          {loading ? (
            <div className="text-center p-4" style={{fontSize: '0.9rem'}}>Loading prospects...</div>
          ) : error && (!items || items.length === 0) ? (
            <div className="text-center p-4 text-danger" style={{fontSize: '0.9rem'}}>{error}</div>
          ) : items && items.length > 0 ? (
            <>
              <div className='d-flex justify-content-between align-items-center mb-3' style={{ gap: 12 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flex: 1 }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <i className="ri-search-line" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                    <input
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Search name, email, phone or code"
                      className="form-control"
                      style={{ paddingLeft: 36 }}
                    />
                  </div>
                  <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="form-control" style={{ width: 160 }}>
                    <option value="">All statuses</option>
                    <option value="New">New</option>
                    <option value="Contacted">Contacted</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Follow Up">Follow Up</option>
                    <option value="Closed">Closed</option>
                  </select>
                  <input value={countyFilter} onChange={(e) => setCountyFilter(e.target.value)} placeholder="County" className="form-control" style={{ width: 140 }} />
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>Showing {Math.min((page-1)*pageSize+1,total)}–{Math.min(page*pageSize,total)} of {total}</div>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                    className="form-control dropdown"
                    style={{width: 90}}
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>
              
              <style>{`
                .prospect-row td{ padding-top:12px; padding-bottom:12px; }
                .prospect-row:hover{ background: #f9fafb; }
                .prospects-table tbody tr:nth-child(even){ background: #fafafa; }
                .prospects-table thead { position: sticky; top: 0; z-index: 2; background: white; }
                .prospect-initial { width:36px; height:36px; display:inline-flex; align-items:center; justify-content:center; border-radius:999px; background:#e6eefc; color:#174ea6; font-weight:700; margin-right:8px }
              `}</style>

              <div className="table-responsive">
                <table className="table table-striped" style={{fontSize: '0.85rem'}}>
                  <thead className="table-light sticky-top">
                    <tr>
                      <th style={{fontSize: '0.9rem'}}>Name</th>
                      <th style={{fontSize: '0.85rem'}}>Email</th>
                      <th style={{fontSize: '0.85rem'}}>Phone</th>
                      <th style={{fontSize: '0.85rem'}}>County</th>
                      <th style={{fontSize: '0.85rem'}}>Influencer</th>
                      <th style={{fontSize: '0.85rem'}}>Referral Source</th>
                      <th style={{fontSize: '0.85rem'}}>Status</th>
                      <th style={{fontSize: '0.85rem'}}>Promo</th>
                      <th style={{fontSize: '0.85rem'}}>Created At</th>
                      <th style={{fontSize: '0.85rem'}}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uniqueItems
                      .filter(p => (statusFilter ? p.status === statusFilter : true))
                      .filter(p => (countyFilter ? (p.county || '').toLowerCase().includes(countyFilter.toLowerCase()) : true))
                      .map((p) => (
                      <tr key={p.id} className="prospect-row" style={{verticalAlign: 'middle'}}>
                        <td style={{fontSize: '0.95rem'}}>
                          <span className="prospect-initial">{(getDisplayName(p) || p.email || '').charAt(0).toUpperCase()}</span>
                          <div style={{ display: 'inline-block', verticalAlign: 'middle' }}>
                            <div style={{ fontWeight: 700 }}>{getDisplayName(p)}</div>
                            <div style={{ color: '#6b7280', fontSize: '0.85rem' }}>{p.email ?? ''}</div>
                          </div>
                        </td>
                        <td style={{fontSize: '0.85rem'}}>{p.email ?? ''}</td>
                        <td style={{fontSize: '0.85rem'}}>{p.phone ?? ''}</td>
                        <td style={{fontSize: '0.85rem'}}>{p.county ?? ''}</td>
                        <td style={{fontSize: '0.85rem'}}>{p.influencerName ?? ''}</td>
                        <td style={{fontSize: '0.85rem'}}>
                          {p.referralSource ? (
                            <span style={{ display: 'inline-block', background: p.referralSource.toLowerCase().includes('merchant') ? '#e0f7fa' : p.referralSource.toLowerCase().includes('client') ? '#e3f2fd' : '#f3e5f5', color: p.referralSource.toLowerCase().includes('merchant') ? '#00796b' : p.referralSource.toLowerCase().includes('client') ? '#1565c0' : '#6a1b9a', borderRadius: '12px', padding: '2px 10px', fontWeight: 600, fontSize: '0.8em' }}>
                              {p.referralSource.charAt(0).toUpperCase() + p.referralSource.slice(1).toLowerCase()}
                            </span>
                          ) : null}
                        </td>
                        <td style={{fontSize: '0.85rem'}}>{renderStatusBadge(p.status)}</td>
                        <td style={{width: 220, maxWidth: 220, paddingTop: 8, paddingBottom: 8}}>
                          {p.promoCode ? (
                            <div>
                              <div onClick={() => togglePromo(p.id)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, userSelect: 'none' }} title={p.promoCode} aria-expanded={expandedPromoIds.has(p.id)}>
                                <span style={{ display: 'inline-block', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600, fontSize: '0.9rem' }}>{p.promoCode}</span>
                                <small className="text-muted" style={{fontSize: '0.75rem'}}>{expandedPromoIds.has(p.id) ? 'Hide' : 'Details'}</small>
                              </div>
                              {expandedPromoIds.has(p.id) && (
                                <div style={{marginTop: 6, fontSize: '0.78rem', color: '#6c757d', lineHeight: 1.25}}>
                                  {p.promoValue != null && (<div>Value: {p.promoValue}</div>)}
                                  {p.promoRedeemed != null && (<div>Redeemed: {p.promoRedeemed ? 'Yes' : 'No'}</div>)}
                                  {p.promoExpiresAt && (<div>Expires: {new Date(p.promoExpiresAt).toLocaleString()}</div>)}
                                </div>
                              )}
                            </div>
                          ) : (<span style={{fontSize: '0.85rem'}}></span>)}
                        </td>
                        <td style={{fontSize: '0.85rem', color: '#6b7280'}}>{p.createdAt ? new Date(p.createdAt).toLocaleString() : ''}</td>
                        <td>
                          <button onClick={() => openConvertForm(p)} className="btn btn-sm btn-outline-secondary" style={{fontSize: '0.8rem', padding: '0.25rem 0.5rem'}} title="Convert"><i className="ri-refresh-line"></i></button>
                          <button onClick={() => openDetail(p)} className="btn btn-sm btn-outline-primary ms-2" style={{fontSize: '0.8rem', padding: '0.25rem 0.5rem'}} title="View"><i className="ri-eye-line"></i></button>
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