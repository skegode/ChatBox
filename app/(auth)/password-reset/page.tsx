
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '../../../lib/api';

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err !== null) {
    const e = err as Record<string, unknown>;
    if (typeof e.errorMessage === 'string') return e.errorMessage;
    if (typeof e.message === 'string') return e.message;
  }
  return 'Network error';
}

/** Safe extractor for server response payloads */
function extractServerError(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const d = data as Record<string, unknown>;
  if (typeof d.error === 'string') return d.error;
  if (typeof d.message === 'string') return d.message;
  // also check nested structures commonly used by some APIs
  if (d.errors && typeof d.errors === 'object') {
    try {
      // try to stringify validation errors reasonably
      return JSON.stringify(d.errors);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function ResetPasswordContent() {
  const [phone, setPhone] = useState('');
  const [token, setToken] = useState('');
  const [validating, setValidating] = useState(true);
  const [valid, setValid] = useState(false);
  const [error, setError] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const p = urlParams.get('phonenumber') ?? urlParams.get('phone') ?? '';
    const t = urlParams.get('token') ?? '';
    const normalized = p?.trim().replace(/\s|-/g, '');

    setPhone(normalized);
    setToken(t);

    if (!normalized || !t) {
      setValidating(false);
      setValid(false);
      setError('Missing phonenumber or token in the link.');
      return;
    }

    (async () => {
      setValidating(true);
      setError('');
      try {
        const res = await api.get('/api/Auth/validate-reset', {
          params: { phonenumber: normalized, token: t }
        });

        const body = res.data;
        setValid(Boolean((body as Record<string, unknown>)?.valid));
        if (!((body as Record<string, unknown>)?.valid)) setError('Invalid or expired link.');
      } catch (err: unknown) {
        const msg = getErrorMessage(err) || 'Network error while validating link.';
        setError(msg);
        setValid(false);
      } finally {
        setValidating(false);
      }
    })();
  }, []);

  const validateForm = () => {
    if (!newPassword || newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return false;
    }
    if (newPassword !== confirm) {
      setError('Passwords do not match.');
      return false;
    }
    return true;
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const resp = await api.post('/api/Auth/reset-password', {
        PhoneNumber: phone,
        Token: token,
        NewPassword: newPassword
      });

      if (resp.status >= 200 && resp.status < 300) {
        setSuccess('Password has been reset. You may now sign in.');
        setTimeout(() => (window.location.href = '/login'), 2000);
      } else {
        const serverMsg = extractServerError(resp.data);
        setError(serverMsg || 'Failed to reset password.');
      }
    } catch (err: unknown) {
      // axios wrapper may augment error with responseData / errorMessage; try those
      const asRecord = (err as Record<string, unknown>) ?? {};
      const augmentedMsg =
        typeof asRecord.errorMessage === 'string' ? (asRecord.errorMessage as string) : undefined;
      const responseData = asRecord.responseData;
      const serverMsgFromResponse = extractServerError(responseData);
      const msg = augmentedMsg || serverMsgFromResponse || getErrorMessage(err);
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="account-pages my-5 pt-sm-5">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-md-8 col-lg-6 col-xl-5">
            <div className="text-center mb-4">
              <Link href="/" className="auth-logo mb-5 d-block">
                <img src="/images/logo.png" alt="logo" height="80" width="80" />
              </Link>
              <h4>Set a new password</h4>
              <p className="text-muted mb-0">This link is one-time and will expire.</p>
            </div>
            <div className="card">
              <div className="card-body p-4">
                <div className="p-3">
                  {validating && <div className="alert alert-info">Validating reset link...</div>}
                  {error && <div className="alert alert-danger">{error}</div>}
                  {success && <div className="alert alert-success">{success}</div>}

                  {!validating && valid && !success && (
                    <form onSubmit={handleReset}>
                      <div className="mb-3">
                        <label className="form-label">Phone</label>
                        <input type="text" className="form-control" value={phone} disabled />
                      </div>

                      <div className="mb-3">
                        <label className="form-label">New password</label>
                        <input
                          type="password"
                          className="form-control"
                          value={newPassword}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewPassword(e.target.value)}
                          autoComplete="new-password"
                        />
                      </div>

                      <div className="mb-3">
                        <label className="form-label">Confirm password</label>
                        <input
                          type="password"
                          className="form-control"
                          value={confirm}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirm(e.target.value)}
                          autoComplete="new-password"
                        />
                      </div>

                      <div className="d-grid">
                        <button className="btn btn-primary" type="submit" disabled={submitting}>
                          {submitting ? 'Resetting...' : 'Set password'}
                        </button>
                      </div>
                    </form>
                  )}

                  {!validating && !valid && !success && (
                    <div className="text-center">
                      <p className="text-muted">The link is invalid or expired.</p>
                      <a href="/forgotPassword" className="btn btn-link">Request a new link</a>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-5 text-center">
              <p>© {new Date().getFullYear()} Powered by <a href="http://techcrast.co.ke">TechCrast LTD</a></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return <ResetPasswordContent />;
}
