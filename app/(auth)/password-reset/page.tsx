'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

// The core component containing the logic and UI.
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
    // We use the native browser URL API to get search parameters.
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
        const params = new URLSearchParams({ phonenumber: normalized, token: t });
        const res = await fetch(`/api/Auth/validate-reset?${params.toString()}`);
        if (!res.ok) {
          setValid(false);
          const body = await res.json().catch(() => null);
          setError((body && body.error) || 'Failed to validate link.');
        } else {
          const body = await res.json();
          setValid(Boolean(body?.valid));
          if (!body?.valid) setError('Invalid or expired link.');
        }
      } catch (err) {
        setError('Network error while validating link.');
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
      const res = await fetch('/api/Auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          PhoneNumber: phone,
          Token: token,
          NewPassword: newPassword
        })
      });

      if (res.ok) {
        setSuccess('Password has been reset. You may now sign in.');
        // Use window.location.href for redirection.
        setTimeout(() => window.location.href = '/login', 2000);
      } else {
        const body = await res.json().catch(() => null);
        setError((body && body.error) || 'Failed to reset password.');
      }
    } catch (err) {
      setError((err instanceof Error && err.message) || 'Network error');
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
              {/* Use Next.js Link for navigation */}
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
                      <a href="/forgotpassword" className="btn btn-link">Request a new link</a>
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

// The outer component to be exported.
export default function ResetPasswordPage() {
  return <ResetPasswordContent />;
}
