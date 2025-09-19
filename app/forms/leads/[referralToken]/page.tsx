'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import api from '../../../../lib/api';
import type { AxiosError } from 'axios';

type Option = { id: string | number; name: string };

export default function LeadFormPage() {
  const rawParams = useParams() as Record<string, string | undefined> | null;
  const urlToken = rawParams?.referralToken ?? rawParams?.ReferralToken ?? '';

  const [firstName, setFirstName] = useState('');
  const [otherName, setOtherName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [phoneModel, setPhoneModel] = useState<string | number>('');
  const [county, setCounty] = useState<string | number>('');
  const [referralToken, setReferralToken] = useState<string>(urlToken);

  const [phoneModels, setPhoneModels] = useState<Option[]>([]);
  const [counties, setCounties] = useState<Option[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  // Added consent state for privacy policy checkbox
  const [consent, setConsent] = useState(false);

  useEffect(() => {
    if (urlToken) setReferralToken(urlToken);
  }, [urlToken]);

  function normalizeOptions(input: unknown): Option[] {
    const list: unknown[] =
      Array.isArray(input) ? input : (typeof input === 'object' && input !== null && Array.isArray((input as { data?: unknown }).data))
        ? (input as { data: unknown[] }).data
        : [];

    return list.map((it) => {
      if (typeof it === 'string') return { id: it, name: it };
      if (typeof it === 'number') return { id: it, name: String(it) };
      if (typeof it === 'object' && it !== null) {
        const obj = it as Record<string, unknown>;
        const id = obj.id ?? obj.value ?? obj.name ?? JSON.stringify(obj);
        const name =
          typeof obj.name === 'string'
            ? obj.name
            : typeof obj.value === 'string'
            ? obj.value
            : typeof obj.id === 'string' || typeof obj.id === 'number'
            ? String(obj.id)
            : JSON.stringify(obj);
        return { id: id as string | number, name };
      }
      return { id: String(it), name: String(it) };
    });
  }

  function getErrorMessage(err: unknown): string {
    if (typeof err === 'object' && err !== null && 'isAxiosError' in err && (err as AxiosError).isAxiosError) {
      const a = err as AxiosError;
      const data = a.response?.data as Record<string, unknown> | undefined;
      if (data) {
        if (typeof data.message === 'string') return data.message;
        if (typeof data.error === 'string') return data.error;
      }
      return a.message || 'API error';
    }
    if (err instanceof Error) return err.message;
    return String(err);
  }

  useEffect(() => {
    let mounted = true;
    async function loadOptions() {
      setLoadingOptions(true);
      try {
        const [ptResp, cResp] = await Promise.all([api.get('/api/Leads/GetPhoneModels'), api.get('/api/Leads/GetCounties')]);
        if (!mounted) return;
        const pts = normalizeOptions(ptResp.data ?? ptResp);
        const cnts = normalizeOptions(cResp.data ?? cResp);
        setPhoneModels(pts);
        setCounties(cnts);
        if (pts.length && !phoneModel) setPhoneModel(pts[0].id);
        if (cnts.length && !county) setCounty(cnts[0].id);
      } catch (err: unknown) {
        setMessage({ text: getErrorMessage(err) || 'Could not load form options. Refresh to try again.', isError: true });
      } finally {
        if (mounted) setLoadingOptions(false);
      }
    }
    loadOptions();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validateEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  const validatePhone = (p: string) => /^\d{6,15}$/.test(p);

  async function handleSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setMessage(null);

    if (!firstName.trim()) return setMessage({ text: 'First name is required.', isError: true });
    if (!otherName.trim()) return setMessage({ text: 'Other name is required.', isError: true });
    if (!phone.trim() || !validatePhone(phone.trim()))
      return setMessage({ text: 'Enter a valid phone number (digits only).', isError: true });
    if (!email.trim() || !validateEmail(email.trim()))
      return setMessage({ text: 'Enter a valid email address.', isError: true });
    if (!phoneModel) return setMessage({ text: 'Select a phone model.', isError: true });
    if (!county) return setMessage({ text: 'Select a county.', isError: true });

    // Ensure user consented to privacy policy
    if (!consent) return setMessage({ text: 'You must consent to the privacy policy to continue.', isError: true });

    if (submitting) return;

    const payload = {
      FirstName: firstName.trim(),
      OtherName: otherName.trim(),
      phone: `+254${phone.trim()}`,
      email: email.trim(),
      phoneModel,
      county,
      referralToken: referralToken?.trim() || null,
    };

    try {
      setSubmitting(true);
      await api.post('/SubmitLead', payload);
      setMessage({ text: 'Submitted successfully.' });
      setFirstName('');
      setOtherName('');
      setPhone('');
      setEmail('');
      // reset consent after successful submit
      setConsent(false);
    } catch (err: unknown) {
      setMessage({ text: getErrorMessage(err), isError: true });
    } finally {
      setSubmitting(false);
    }
  }

  // Consistent styles with dashboard pages
  return (
    <div className="p-4 bg-white" style={{ minHeight: '100vh', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', background: '#f1f3f4' }}>
      <form className="mx-auto" style={{ maxWidth: 600, width: '100%', background: '#fff', borderRadius: 8, boxShadow: '0 1px 3px rgba(60,64,67,.1), 0 4px 8px rgba(60,64,67,.08)', padding: 28 }} onSubmit={handleSubmit}>        
        <div className="mb-3">
          <label className="form-label">First Name <span style={{ color: '#d93025' }}>*</span></label>
          <input
            className="form-control"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="First name"
            required
          />
        </div>
        <div className="mb-3">
          <label className="form-label">Other Name <span style={{ color: '#d93025' }}>*</span></label>
          <input
            className="form-control"
            value={otherName}
            onChange={(e) => setOtherName(e.target.value)}
            placeholder="Other name"
            required
          />
        </div>
        <div className="mb-3">
          <label className="form-label">Phone Number <span style={{ color: '#d93025' }}>*</span></label>
          <div className="input-group">
            <span className="input-group-text">+254</span>
            <input
              className="form-control"
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
              placeholder="707123456"
              required
            />
          </div>
          <div className="form-text">Enter the local number without the leading zero.</div>
        </div>
        <div className="mb-3">
          <label className="form-label">Email Address <span style={{ color: '#d93025' }}>*</span></label>
          <input
            className="form-control"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
        </div>
        <div className="mb-3">
          <label className="form-label">Phone Type you Want <span style={{ color: '#d93025' }}>*</span></label>
          <select
            className="form-control"
            value={phoneModel}
            onChange={(e) => setPhoneModel(e.target.value)}
            disabled={loadingOptions}
            required
          >
            <option value="">Select phone model</option>
            {phoneModels.map((opt) => (
              <option key={opt.id} value={opt.id}>{opt.name}</option>
            ))}
          </select>
        </div>
        <div className="mb-3">
          <label className="form-label">County of residence <span style={{ color: '#d93025' }}>*</span></label>
          <select
            className="form-control"
            value={county}
            onChange={(e) => setCounty(e.target.value)}
            disabled={loadingOptions}
            required
          >
            <option value="">Select county</option>
            {counties.map((opt) => (
              <option key={opt.id} value={opt.id}>{opt.name}</option>
            ))}
          </select>
        </div>

        {/* Added privacy policy consent checkbox with link */}
        <div className="mb-3 form-check">
          <input
            id="consent"
            type="checkbox"
            className="form-check-input"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          <label className="form-check-label" htmlFor="consent">
            I consent to the <a href="https://buysimutech.co.ke/" target="_blank" rel="noopener noreferrer">privacy policy</a>.
          </label>
        </div>

        <div className="d-flex align-items-center gap-2 mt-4">
          <button
            type="submit"
            disabled={submitting}
            className="btn btn-primary"
            style={{ visibility: 'visible' }}
          >
            {submitting ? 'Submitting…' : 'Submit'}
          </button>
          <button
            type="button"
            onClick={() => {
              setFirstName('');
              setOtherName('');
              setPhone('');
              setEmail('');
              setMessage(null);
              setConsent(false);
            }}
            className="btn btn-light"
            style={{ visibility: 'visible' }}
          >
            Clear
          </button>
          {message && (
            <div className={message.isError ? 'text-danger' : 'text-success'} style={{ marginLeft: 8 }}>
              {message.text}
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
