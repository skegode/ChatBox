'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const normalize = (p: string) => p?.trim().replace(/\s|-/g, '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    const phoneNorm = normalize(phone);
    if (!phoneNorm) {
      setError('Phone number is required');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/Auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ PhoneNumber: phoneNorm })
      });

      if (res.ok) {
        // API intentionally returns ambiguous message so attackers can't enumerate users.
        setInfo('If the phone number exists, a password reset link has been sent.');
        setPhone('');
      } else {
        const body = await res.json().catch(() => null);
        setError((body && body.error) || 'Failed to request reset link.');
      }
    } catch (err) {
      setError((err instanceof Error && err.message) || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="account-pages my-5 pt-sm-5">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-md-8 col-lg-6 col-xl-5">
            <div className="text-center mb-4">
              <Link href="/" className="auth-logo mb-5 d-block">
                <img src="/images/logo.png" alt="logo" height="80" />
              </Link>
              <h4>Reset your password</h4>
              <p className="text-muted mb-0">Enter the phone number used for the account.</p>
            </div>

            <div className="card">
              <div className="card-body p-4">
                <div className="p-3">
                  {error && <div className="alert alert-danger">{error}</div>}
                  {info && <div className="alert alert-success">{info}</div>}

                  <form onSubmit={handleSubmit}>
                    <div className="mb-3">
                      <label className="form-label">Phone number</label>
                      <div className="input-group mb-3 bg-light-subtle rounded-3">
                        <span className="input-group-text text-muted"><i className="ri-phone-line"></i></span>
                        <input
                          type="tel"
                          className="form-control form-control-lg border-light bg-light-subtle"
                          placeholder="e.g. 0712345678"
                          value={phone}
                          onChange={e => setPhone(e.target.value)}
                          autoComplete="tel"
                        />
                      </div>
                    </div>

                    <div className="d-grid mb-3">
                      <button className="btn btn-primary" type="submit" disabled={loading}>
                        {loading ? 'Sending...' : 'Send reset link'}
                      </button>
                    </div>

                    <div className="text-center">
                      <Link href="/login" className="text-muted">Back to sign in</Link>
                    </div>
                  </form>
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