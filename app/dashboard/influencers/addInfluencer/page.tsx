'use client';

import React, { useState } from 'react';
import api from '../../../../lib/api';
import Link from 'next/link';
import type { AxiosError } from 'axios';
import ProtectedRoute from '../../../../components/ProtectedRoute';
import { PERMISSIONS } from '../../../../lib/permissions';

export default function InfluencerFormPage() {
  const [firstName, setFirstName] = useState('');
  const [otherName, setOtherName] = useState('');
  const [alias, setAlias] = useState('');
  const [phone, setPhone] = useState(''); // local number after +254
  const [email, setEmail] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; isError?: boolean } | null>(null);
  
  // New: store referral link returned by API so UI can show & copy it
  const [referralLink, setReferralLink] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  function getErrorMessage(err: unknown): string {
    if (typeof err === 'object' && err !== null && 'isAxiosError' in err && (err as AxiosError).isAxiosError) {
      const a = err as AxiosError;
      const data = a.response?.data as Record<string, unknown> | undefined;
      if (data) {
        if (typeof data.message === 'string') return data.message;
        if (typeof data.error === 'string') return data.error;
        if (Array.isArray(data.errors)) return JSON.stringify(data.errors);
        // sometimes API returns referralLink even on 201 — ignore here
      }
      return a.message || 'API error';
    }
    if (err instanceof Error) return err.message;
    return String(err);
  }

  const validateEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  const validatePhone = (p: string) => /^\d{6,15}$/.test(p);

  async function handleSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setMessage(null);
    setReferralLink(null);
    setCopyStatus(null);

    if (!firstName.trim()) return setMessage({ text: 'First name is required.', isError: true });
    if (!otherName.trim()) return setMessage({ text: 'Other name is required.', isError: true });

    const hasPhone = phone.trim().length > 0;
    const hasEmail = email.trim().length > 0;

    if (!hasPhone && !hasEmail) return setMessage({ text: 'Provide at least a phone number or an email address.', isError: true });

    if (hasPhone && !validatePhone(phone.trim()))
      return setMessage({ text: 'Enter a valid phone number (digits only).', isError: true });

    if (hasEmail && !validateEmail(email.trim()))
      return setMessage({ text: 'Enter a valid email address.', isError: true });

    if (submitting) return;

    const payload = {
      FirstName: firstName.trim(),
      OtherName: otherName.trim(),
      Alias: alias.trim() || null,
      EmailAddress: hasEmail ? email.trim() : null,
      PhoneNumber: hasPhone ? `+254${phone.trim()}` : null,
    };

    try {
      setSubmitting(true);
      const resp = await api.post('/CreateInfluencer', payload);
      // API returns { message, influencerId, promoCode, referralLink }
      const link = resp?.data?.referralLink ?? null;
      if (link) {
        setReferralLink(String(link));
        setMessage({ text: 'Submitted successfully. Influencer link generated.' });
      } else {
        setMessage({ text: 'Submitted successfully.' });
      }

      // clear inputs (keep referralLink visible)
      setFirstName('');
      setOtherName('');
      setAlias('');
      setPhone('');
      setEmail('');
    } catch (err: unknown) {
      console.error('Submission error', err);
      setMessage({ text: getErrorMessage(err), isError: true });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCopy() {
    if (!referralLink) return;
    setCopyStatus(null);
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopyStatus('Copied to clipboard');
      setTimeout(() => setCopyStatus(null), 3000);
    } catch {
      // fallback: select input text for manual copy
      setCopyStatus('Unable to copy automatically — please select and copy.');
      setTimeout(() => setCopyStatus(null), 4000);
    }
  }

  return (
    <ProtectedRoute requiredPermissions={['adminOnly']} requiredPolicy={PERMISSIONS.POLICY_VIEW_USERS}>
      <div className="bg-white p-4">
        <div className="d-flex justify-content-between align-items-center">
          <h4 className="mb-0"><i className="ri-group-line me-2" />New Influencer</h4> 
          <Link
            href="/dashboard/influencers"
          >
            <i className="ri-arrow-left-line me-2"></i>Influencers
          </Link>
        </div>
        <hr />
        {message && <div style={{ color: message.isError ? '#d93025' : '#188038' }}>{message.text}</div>}
        <form onSubmit={handleSubmit} className="row">
          <div className='mb-3 col-md-4'>
            <label>First name <span style={{ color: '#d93025' }}>*</span>
            </label>
            <input
              className='form-control'
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="First name"
              aria-required
            />
          </div>
          <div className='mb-3 col-md-4'>
            <label>Other name <span style={{ color: '#d93025' }}>*</span>
            </label>
            <input
              className='form-control'
              value={otherName}
              onChange={(e) => setOtherName(e.target.value)}
              placeholder="Other name / family name"
              aria-required
            />
          </div>

          <div className='mb-3 col-md-4'>
            <label>Alias <span style={{ color: '#d93025' }}>*</span></label>
            <input className='form-control' value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="Nickname or alias" />
          </div>

          <div className='mb-3 col-md-4'>
            <label>Phone Number <span style={{ color: '#d93025' }}>*</span></label>
            <div className="input-group">
              <div className="input-group-prepend">
                <span className="input-group-text" id="basic-addon1">+254</span>
              </div>
              <input 
                type="tel" 
                className="form-control"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                placeholder="707123456" />
            </div>
          </div>

          <div className='mb-3 col-md-4'>
            <label>Email Address <span style={{ color: '#d93025' }}>*</span>
            </label>
            <input
              className='form-control'
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>

          <div className='mb-3 col-md-4 align-self-end text-end'>
            <button type="submit" disabled={submitting} className='btn btn-primary'>
              {submitting ? 'Submitting…' : 'Submit'}
            </button>
            <button
              type="button"
              onClick={() => {
                setFirstName('');
                setOtherName('');
                setAlias('');
                setPhone('');
                setEmail('');
                setMessage(null);
                setReferralLink(null);
                setCopyStatus(null);
              }}
              className='btn btn-danger ms-4'
            >
              Clear
            </button>
          </div>

          {/* New UI: show generated referral link and allow copying */}
          {referralLink && (
            <div className='p-4 border rounded text-center'>
              <h4>Referral link (share with influencer)</h4>
              <div className="input-group mb-3">
                <input type="text" className="form-control" readOnly value={referralLink} />
                <div className="input-group-append">
                  <button className="btn btn-primary" type="button" onClick={handleCopy}>Copy</button>
                </div>
              </div>
              
              {copyStatus && <div className='mt-4 text-success'>{copyStatus}</div>}
            </div>
          )}
        </form>
      </div>
    </ProtectedRoute>
  );
}