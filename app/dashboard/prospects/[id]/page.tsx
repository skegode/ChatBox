"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";

type Prospect = {
  id: number;
  firstName?: string;
  otherName?: string | null;
  email?: string;
  phone?: string;
  phoneModel?: string;
  county?: string;
  influencerCode?: string | null;
  influencerName?: string | null;
  referralSource?: string | null;
  referrerName?: string | null;
  merchantCode?: string | null;
  referrerPhone?: string | null;
  status?: string;
  promoCode?: string | null;
  promoValue?: number | null;
  promoRedeemed?: boolean | null;
  promoExpiresAt?: string | null;
  createdAt?: string;
};

type StatusEntry = { status: string; note?: string; at: string };

function getLocalHistoryKey(id: number) {
  return `prospect_status_history_${id}`;
}

function loadHistory(id: number): StatusEntry[] {
  try {
    const v = localStorage.getItem(getLocalHistoryKey(id));
    if (!v) return [];
    return JSON.parse(v) as StatusEntry[];
  } catch {
    return [];
  }
}

function saveHistory(id: number, entries: StatusEntry[]) {
  localStorage.setItem(getLocalHistoryKey(id), JSON.stringify(entries));
}

function statusDotColor(status?: string) {
  const s = (status || '').toLowerCase();
  if (s.includes('progress')) return '#f59e0b'; // yellow
  if (s.includes('new')) return '#60a5fa'; // blue
  if (s.includes('closed') || s.includes('completed') || s.includes('converted')) return '#10b981'; // green
  if (s.includes('rejected')) return '#ef4444'; // red
  return '#94a3b8'; // gray
}

function renderStatusBadge(status?: string) {
  const label = status || '—';
  const color = statusDotColor(status);
  return (
    <span style={{ display: 'inline-block', padding: '6px 12px', borderRadius: 999, background: `${color}22`, color, fontWeight: 700 }}>
      {label}
    </span>
  );
}

export default function ProspectDetail({ params }: any) {
  const router = useRouter();
  // `params` may be a Promise in the current Next.js runtime for client components.
  // Unwrap it with `React.use()` before accessing properties to avoid sync-access warnings.
  const resolvedParams = React.use(params as any) as any;
  const id = Number(resolvedParams?.id || 0);
  const [prospect, setProspect] = useState<Prospect | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<StatusEntry[]>([]);

  useEffect(() => {
    if (!id) return;
    setHistory(loadHistory(id));

    async function fetchOne() {
      setLoading(true);
      try {
        // Try to fetch via GetProspects and find matching id
        const res = await api.get('/api/Leads/GetProspects', { params: { page: 1, pageSize: 1, q: undefined } });
        // If backend provides single-get endpoint later, replace this call
        // Fallback: fetch list and find item (inefficient but works)
        const listRes = await api.get('/api/Leads/GetProspects', { params: { page: 1, pageSize: 1000 } });
        const items = listRes.data?.items || [];
        const found = items.find((x: any) => Number(x.id) === id);
        if (found) {
          setProspect(found);
          setStatus(found.status || "New");
        } else {
          setProspect(null);
        }
      } catch (err) {
        setProspect(null);
      } finally {
        setLoading(false);
      }
    }
    fetchOne();
  }, [id]);

  if (!id) return <div className="p-4">Invalid prospect id</div>;

  const handleUpdate = async () => {
    if (!status) {
      alert('Please choose a status');
      return;
    }
    setSaving(true);
    try {
      const res = await api.patch('/api/Leads/UpdateProspectStatus', { LeadId: id, Status: status, Note: note });
      const updated = res?.data;
      if (updated) setProspect(updated);

      const entry: StatusEntry = { status, note: note || undefined, at: new Date().toISOString() };
      const next = [entry, ...history].slice(0, 50);
      setHistory(next);
      saveHistory(id, next);
      setNote("");
      alert('Status updated');
    } catch (err) {
      alert('Failed to update status');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4">
      <button className="btn btn-link mb-3" onClick={() => router.push('/dashboard/prospects')}>← Back to prospects</button>
      {loading ? (
        <div>Loading...</div>
      ) : !prospect ? (
        <div>Prospect not found</div>
      ) : (
        <div style={{ background: '#f5f7fa', padding: 20, borderRadius: 8 }}>
          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 60%', minWidth: 300 }}>
              <div className="card p-3 mb-3" style={{ borderRadius: 8, boxShadow: '0 6px 18px rgba(15,23,42,0.06)' }}>
                <h2 style={{ marginTop: 0, fontSize: 22, fontWeight: 700 }}>{prospect.firstName} {prospect.otherName ?? ''}</h2>
                <div style={{ display: 'flex', gap: 16, marginTop: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                  <div style={{ color: '#6b7280' }}><i className="ri-mail-line me-1"></i><div style={{ fontSize: 12 }}>Email</div><div style={{ fontWeight: 600, color: '#111827' }}>{prospect.email || '—'}</div></div>
                  <div style={{ color: '#6b7280' }}><i className="ri-phone-line me-1"></i><div style={{ fontSize: 12 }}>Phone</div><div style={{ fontWeight: 600, color: '#111827' }}>{prospect.phone || '—'}</div></div>
                  <div style={{ color: '#6b7280' }}><i className="ri-map-pin-line me-1"></i><div style={{ fontSize: 12 }}>County</div><div style={{ fontWeight: 600, color: '#111827' }}>{prospect.county || '—'}</div></div>
                </div>
                <div style={{ borderTop: '1px solid #eef2f7', paddingTop: 12 }}>
                  <label className="form-label" style={{ fontWeight: 600, color: '#374151' }}>Current status</label>
                  <div style={{ margin: '8px 0' }}>{renderStatusBadge(prospect.status || 'New')}</div>

                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 12 }}>
                    <select className="form-select" value={status} onChange={(e) => setStatus(e.target.value)} style={{ flex: '0 0 220px' }}>
                      <option value="">Select status</option>
                      <option value="New">New</option>
                      <option value="Contacted">Contacted</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Follow Up">Follow Up</option>
                      <option value="Closed">Closed</option>
                      <option value="Qualified">Qualified</option>
                      <option value="Converted">Converted</option>
                      <option value="Rejected">Rejected</option>
                    </select>
                    <textarea className="form-control" placeholder="Optional note (supports multiple lines)" value={note} onChange={(e) => setNote(e.target.value)} style={{ flex: 1, minHeight: 80, resize: 'vertical' }} rows={3} />
                    <button className="btn btn-primary" onClick={handleUpdate} disabled={saving} style={{ minWidth: 110 }}>{saving ? 'Saving…' : 'Update'}</button>
                  </div>
                </div>
              </div>

              <div className="card p-3" style={{ borderRadius: 8, boxShadow: '0 6px 18px rgba(15,23,42,0.04)' }}>
                <h5 style={{ marginTop: 0, marginBottom: 8 }}>Status history</h5>
                {history.length === 0 ? (
                  <div className="text-muted">No local history yet. Updates will appear here.</div>
                ) : (
                  <div style={{ position: 'relative', paddingLeft: 12 }}>
                    <div style={{ position: 'absolute', left: 8, top: 8, bottom: 8, width: 2, background: '#e6edf3' }} />
                    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                      {history.map((h, i) => (
                        <li key={i} style={{ marginBottom: 16, paddingLeft: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 12, height: 12, borderRadius: 12, background: statusDotColor(h.status), boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }} />
                            <div>
                              <div style={{ fontWeight: 700 }}>{h.status}</div>
                              <div style={{ color: '#6b7280', fontSize: 12 }}>{new Date(h.at).toLocaleString()}</div>
                              {h.note && <div style={{ marginTop: 6, color: '#374151' }}>{h.note}</div>}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            <div style={{ flex: '0 0 320px', minWidth: 240 }}>
              <div className="card p-3 mb-3" style={{ borderRadius: 8, boxShadow: '0 6px 18px rgba(15,23,42,0.04)' }}>
                <h6 style={{ marginTop: 0, marginBottom: 12, color: '#374151' }}>Details</h6>
                <div style={{ marginBottom: 8 }}><small style={{ color: '#6b7280' }}>Influencer</small><div style={{ fontWeight: 600 }}>{prospect.influencerName || '—'} {prospect.influencerCode ? `(${prospect.influencerCode})` : ''}</div></div>
                <div style={{ marginBottom: 8 }}>
                  <small style={{ color: '#6b7280' }}>Referrer</small>
                  <div style={{ fontWeight: 600 }}>
                    {prospect.referrerName || '—'} {prospect.referrerPhone ? `— ${prospect.referrerPhone}` : ''}
                  </div>
                  {prospect.referralSource && prospect.referralSource.toLowerCase().includes('merchant') && prospect.merchantCode ? (
                    <div style={{ marginTop: 6 }}><small style={{ color: '#6b7280' }}>Merchant code</small><div style={{ fontWeight: 700, fontFamily: 'monospace' }}>{prospect.merchantCode}</div></div>
                  ) : null}
                </div>
                <div style={{ marginBottom: 8 }}><small style={{ color: '#6b7280' }}>Promo</small><div style={{ fontWeight: 600 }}>{prospect.promoCode ? `${prospect.promoCode} ${prospect.promoValue ? `(${prospect.promoValue})` : ''}` : '—'}</div></div>
                <div style={{ marginBottom: 8 }}><small style={{ color: '#6b7280' }}>Created</small><div style={{ fontWeight: 600 }}>{prospect.createdAt ? new Date(prospect.createdAt).toLocaleString() : '—'}</div></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
