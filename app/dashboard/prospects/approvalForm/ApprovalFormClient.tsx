'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import ProtectedRoute from '../../../../components/ProtectedRoute';
import { PERMISSIONS } from '../../../../lib/permissions';

export default function ApprovalFormClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null); // Ref for the dropdown container

  const prospectId = searchParams?.get('id') ?? '';
  const [name] = useState(searchParams?.get('name') ?? '');
  const [email] = useState(searchParams?.get('email') ?? '');
  const [phone] = useState(searchParams?.get('phone') ?? '');
  const [phoneModel] = useState(searchParams?.get('phoneModel') ?? '');
  const [county] = useState(searchParams?.get('county') ?? '');
  const [influencerCode] = useState(searchParams?.get('influencerCode') ?? '');

  // new fields: influencer display name and promo details
  const [influencerName] = useState(searchParams?.get('influencerName') ?? '');
  const [promoCode] = useState(searchParams?.get('promoCode') ?? '');
  const [promoValue] = useState(searchParams?.get('promoValue') ?? '');
  const [promoRedeemed] = useState(searchParams?.get('promoRedeemed') === 'true');
  const [promoExpiresAt] = useState(searchParams?.get('promoExpiresAt') ?? '');

  // merchants now include geoLocation
  const [merchants, setMerchants] = useState([] as { id: number; businessName?: string; geoLocation?: string; merchantCode?: string }[]);
  const [merchantId, setMerchantId] = useState<number | ''>('');
  const [merchantSearch, setMerchantSearch] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false); // New state for dropdown visibility
  const [selectedMerchantName, setSelectedMerchantName] = useState<string>(''); // New state for selected merchant name

  const [devicePrice, setDevicePrice] = useState('');
  const [amountFinanced, setAmountFinanced] = useState('');
  const [imei1, setImei1] = useState('');
  const [imei2, setImei2] = useState('');
  const [productSerial, setProductSerial] = useState('');
  const [colors, setColors] = useState([] as unknown);
  const [memories, setMemories] = useState([] as unknown);
  const [phoneStates, setPhoneStates] = useState([] as unknown);
  const [colorId, setColorId] = useState<number | ''>('');
  const [memoryId, setMemoryId] = useState<number | ''>('');
  const [phoneStateId, setPhoneStateId] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  type MerchantDto = { id: number; businessName?: string | null; geoLocation?: string | null; merchantCode?: string | null; MerchantCode?: string | null };

  useEffect(() => {
    let mounted = true;

    api
      .get('/api/Merchants')
      .then((res) => {
        if (!mounted) return;
        if (Array.isArray(res.data)) {
          const fetchedMerchants = res.data.map((m: unknown) => {
            const it = m as MerchantDto;
            return {
              id: it.id,
              businessName: it.businessName ?? `#${it.id}`,
              geoLocation: it.geoLocation ?? '',
              merchantCode: it.merchantCode ?? it.MerchantCode ?? undefined,
            };
          });
          setMerchants(fetchedMerchants);
        } else {
          setMerchants([]);
        }
      })
      .catch(() => setMerchants([]));

    // load lookups for converting to customer
    api.get('/api/Leads/GetPhoneColors')
      .then((res) => {
        if (!mounted) return;
        if (Array.isArray(res.data)) {
          setColors(res.data.map((c: unknown) => {
            const it = c as { id: number; name?: string };
            return { id: it.id, name: it.name ?? `#${it.id}` };
          }));
        } else {
          setColors([]);
        }
      })
      .catch(() => setColors([]));

    api.get('/api/Leads/GetPhoneMemory')
      .then((res) => {
        if (!mounted) return;
        if (Array.isArray(res.data)) {
          setMemories(res.data.map((m: unknown) => {
            const it = m as { id: number; name?: string };
            return { id: it.id, name: it.name ?? `#${it.id}` };
          }));
        } else {
          setMemories([]);
        }
      })
      .catch(() => setMemories([]));

    api.get('/api/Leads/GetPhoneState')
      .then((res) => {
        if (!mounted) return;
        if (Array.isArray(res.data)) {
          setPhoneStates(res.data.map((p: unknown) => {
            const it = p as { id: number; name?: string };
            return { id: it.id, name: it.name ?? `#${it.id}` };
          }));
        } else {
          setPhoneStates([]);
        }
      })
      .catch(() => setPhoneStates([]));

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSuccess(null);

    if (!prospectId) {
      setSubmitError('Prospect id is missing.');
      return;
    }
    if (!merchantId) {
      setSubmitError('Please select a merchant who sold the phone.');
      return;
    }
    if (!devicePrice || Number(devicePrice) <= 0) {
      setSubmitError('Please enter a valid device price.');
      return;
    }
    if (!amountFinanced || Number(amountFinanced) < 0) {
      setSubmitError('Please enter a valid amount financed.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/api/Leads/ConvertToCustomer', {
        LeadId: Number(prospectId),
        MerchantId: merchantId,
        DevicePrice: Number(devicePrice),
        FinancedAmount: Number(amountFinanced),
        IMEI1: imei1 || null,
        IMEI2: imei2 || null,
        ProductSerial: productSerial || null,
        ColorId: colorId === '' ? null : colorId,
        MemoryId: memoryId === '' ? null : memoryId,
        PhoneStateId: phoneStateId === '' ? null : phoneStateId,
      } as unknown);

      setSuccess('Prospect converted to customer successfully.');
      setTimeout(() => router.push('/dashboard/prospects'), 900);
    } catch (err: unknown) {
      const errorMsg =
        typeof err === 'object' && err !== null
          ? (() => {
              const e = err as { errorMessage?: string; message?: string };
              return e.errorMessage || e.message;
            })()
          : undefined;
      setSubmitError(errorMsg || 'Failed to convert prospect');
    } finally {
      setLoading(false);
    }
  };

  const handleMerchantSelect = (merchant: { id: number; businessName?: string; geoLocation?: string }) => {
    setMerchantId(merchant.id);
    setSelectedMerchantName(merchant.businessName ?? `#${merchant.id}`);
    setIsDropdownOpen(false); // Close dropdown after selection
  };

  // Render merchant options with geoLocation and search
  const renderMerchantOptions = () => {
    let filtered = merchants;
    if (merchantSearch.trim()) {
      const search = merchantSearch.trim().toLowerCase();
      filtered = merchants.filter(
        (m) =>
          (m.businessName ?? '').toLowerCase().includes(search) ||
          (m.geoLocation ?? '').toLowerCase().includes(search)
      );
    }
    if (filtered.length === 0) {
      return <div className="p-2 text-muted">No merchants found.</div>;
    }
    return filtered.map((m) => (
      <div
        key={m.id}
        onClick={() => handleMerchantSelect(m)}
        className="p-2 cursor-pointer hover-bg-light"
      >
        <div><strong>{m.businessName ?? `#${m.id}`}</strong> {m.merchantCode ? <span style={{ fontFamily: 'monospace', marginLeft: 8 }}>({m.merchantCode})</span> : null}</div>
        <div className="text-muted small">{m.geoLocation ?? ''}</div>
      </div>
    ));
  };

  // Render generic options
  const renderOptions = (list: unknown) =>
    Array.isArray(list) ? (list as unknown[]).map((it: unknown) => {
      const item = it as { id: number; name?: string; businessName?: string };
      const label = item.businessName ?? item.name ?? `#${item.id}`;
      return (
        <option key={item.id} value={item.id}>
          {label}
        </option>
      );
    }) : null;

  return (
    <ProtectedRoute requiredPermissions={['adminOnly']} requiredPolicy={PERMISSIONS.POLICY_VIEW_USERS}>
      <div className="p-4 bg-white">
        <div className="d-flex justify-content-between align-items-center border-bottom pb-2 mb-3">
          <Link href="/dashboard/prospects" className="btn btn-light">
            ← Back to Prospects
          </Link>
          <h4 className="mb-0 flex-grow-1 text-center">Convert Prospect</h4>
        </div>

        <form className="mx-auto" style={{ maxWidth: 600 }} onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label text-muted">Prospect</label>
            <div className="fw-bold">{name || phone || email || `#${prospectId}`}</div>
            <div className="text-muted">{phoneModel ? `${phoneModel} • ${county}` : ''}</div>
            {influencerName && <div className="text-muted">Influencer: {influencerName}</div>}
            {influencerCode && !influencerName && <div className="text-muted">Code: {influencerCode}</div>}
            {promoCode && (
              <div className="mt-1 small">
                <span className="fw-medium">Promo: {promoCode}</span>
                <span className="text-muted ms-2">
                  {promoValue ? `Value: ${promoValue}` : null}
                  {typeof promoRedeemed === 'boolean' ? ` • Redeemed: ${promoRedeemed ? 'Yes' : 'No'}` : null}
                  {promoExpiresAt ? ` • Expires: ${new Date(promoExpiresAt).toLocaleString()}` : null}
                </span>
              </div>
            )}
          </div>

          <div className="mb-3">
            <label className="form-label">Merchant who sold the phone</label>
            {/* Custom dropdown component */}
            <div className="position-relative" ref={dropdownRef}>
              <div
                className="form-control d-flex justify-content-between align-items-center cursor-pointer"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              >
                <span>{selectedMerchantName || "Select merchant"}</span>
                <span>▼</span>
              </div>
              {isDropdownOpen && (
                <div className="position-absolute w-100 bg-white border border-top-0 rounded-bottom" style={{ zIndex: 1000 }}>
                  <input
                    type="text"
                    value={merchantSearch}
                    onChange={(e) => setMerchantSearch(e.target.value)}
                    placeholder="Search merchant name or location"
                    className="form-control mb-1"
                  />
                  <div className="merchant-list" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    {renderMerchantOptions()}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mb-3">
            <label className="form-label">Device Price</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={devicePrice}
              onChange={(e) => setDevicePrice(e.target.value)}
              className="form-control"
              required
            />
          </div>

          <div className="mb-3">
            <label className="form-label">Amount Financed</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amountFinanced}
              onChange={(e) => setAmountFinanced(e.target.value)}
              className="form-control"
              required
            />
          </div>

          <div className="mb-3">
            <label className="form-label">IMEI 1</label>
            <input
              type="text"
              value={imei1}
              onChange={(e) => setImei1(e.target.value)}
              className="form-control"
            />
          </div>

          <div className="mb-3">
            <label className="form-label">IMEI 2 (optional)</label>
            <input
              type="text"
              value={imei2}
              onChange={(e) => setImei2(e.target.value)}
              className="form-control"
            />
          </div>

          <div className="mb-3">
            <label className="form-label">Product Serial No</label>
            <input
              type="text"
              value={productSerial}
              onChange={(e) => setProductSerial(e.target.value)}
              className="form-control"
              placeholder="Enter product serial number (optional)"
            />
          </div>

          <div className="row mb-3">
            <div className="col">
              <label className="form-label">Color</label>
              <select
                value={colorId}
                onChange={(e) => setColorId(e.target.value ? Number(e.target.value) : '')}
                className="form-control"
              >
                <option value="">Select color</option>
                {renderOptions(colors)}
              </select>
            </div>
            <div className="col">
              <label className="form-label">Memory</label>
              <select
                value={memoryId}
                onChange={(e) => setMemoryId(e.target.value ? Number(e.target.value) : '')}
                className="form-control"
              >
                <option value="">Select memory</option>
                {renderOptions(memories)}
              </select>
            </div>
            <div className="col">
              <label className="form-label">Phone State</label>
              <select
                value={phoneStateId}
                onChange={(e) => setPhoneStateId(e.target.value ? Number(e.target.value) : '')}
                className="form-control"
              >
                <option value="">Select state</option>
                {renderOptions(phoneStates)}
              </select>
            </div>
          </div>

          <div className="d-flex align-items-center gap-2 mt-4">
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ visibility: 'visible' }}
            >
              {loading ? 'Submitting...' : 'Approve & Convert'}
            </button>
            <Link href="/dashboard/prospects" className="btn btn-light">
              Cancel
            </Link>
          </div>

          {submitError && <div className="text-danger mt-2">{submitError}</div>}
          {success && <div className="text-success mt-2">{success}</div>}
        </form>
      </div>
    </ProtectedRoute>
  );
}