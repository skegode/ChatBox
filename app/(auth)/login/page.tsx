'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import ErrorMessage from '../../../components/ui/ErrorMessage';
import { useAuth } from '../../../components/providers/AuthProvider';
import { ApiError, isApiError } from '../../../lib/api';

function LoginForm() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();

  const normalizePhone = (value: string) => {
    const cleaned = String(value || '').trim().replace(/[\s+-]/g, '');
    const digits = cleaned.replace(/\D/g, '');
    return digits;
  };

  const sessionExpired = searchParams?.get('reason') === 'inactivity';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!phone.trim() || !password.trim()) {
      setError('Both fields are required');
      return;
    }

    const normalizedPhone = normalizePhone(phone);
    if (!/^\d{9,15}$/.test(normalizedPhone)) {
      setError('Enter a valid phone number (e.g. 07XXXXXXXX or 2547XXXXXXXX).');
      return;
    }

    setLoading(true);

    try {
      await login(normalizedPhone, password);
      router.push('/dashboard');
    } catch (err: unknown) {
      // Prefer ApiError-specific handling
      if (isApiError(err)) {
        console.error('Login failed (ApiError):', err);
        // Network-level / unreachable server
        if (err.code === 'ERR_NETWORK' || err.message === 'Network Error' || (err.statusCode === undefined && err.responseData === undefined)) {
          const offlineMsg =
            typeof navigator !== 'undefined' && !navigator.onLine
              ? 'You appear to be offline. Check your network connection.'
              : 'Server unreachable — try again later.';
          setError(`Network error: ${offlineMsg}`);
        } else if (err.statusCode === 400) {
          setError('PhoneNumber and Password are required.');
        } else if (err.statusCode === 401) {
          setError('Incorrect phone or password');
        } else if (err.statusCode === 502) {
          setError('Service unavailable, try again');
        } else if (err.errorMessage) {
          setError(err.errorMessage);
        } else {
          setError(err.message || 'Failed to login');
        }
      } else if (err instanceof Error) {
        console.error('Login failed (Error):', err);
        setError(err.message);
      } else {
        console.error('Login failed (unknown):', err);
        setError('Failed to login');
      }
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
                <img src="/images/logo.png" alt="" height="100" className="logo logo-dark" />
                <img src="/images/logo.png" alt="" height="100" className="logo logo-light" />
              </Link>
              <h4>Sign in to your account</h4>
              {/* <p className="text-muted mb-4">Sign in to continue to Chatvia.</p> */}
            </div>

            <div className="card">
              <div className="card-body p-4">
                <div className="p-3">
                  {sessionExpired && (
                    <div style={{ background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#856404', fontSize: 14 }}>
                      You were logged out due to inactivity. Please sign in again.
                    </div>
                  )}
                  {error && <ErrorMessage message={error} />}
                  <form onSubmit={handleLogin}>
                    <div className="mb-3">
                      <label className="form-label">Username</label>
                      <div className="input-group mb-3 bg-light-subtle rounded-3">
                        <span className="input-group-text text-muted" id="basic-addon3">
                          <i className="ri-user-2-line"></i>
                        </span>
                        <input
                          type="text"
                          className="form-control form-control-lg border-light bg-light-subtle"
                          placeholder="Enter Username"
                          aria-label="Enter Username"
                          aria-describedby="basic-addon3"
                          value={phone}
                          onChange={e => setPhone(e.target.value)}
                          autoComplete="tel"
                        />
                      </div>
                    </div>

                    <div className="mb-4">
                      <div className="float-end">
                        <Link href="/forgotPassword" className="text-muted font-size-13">Forgot password?</Link>
                      </div>
                      <label className="form-label">Password</label>
                      <div className="input-group mb-3 bg-light-subtle rounded-3">
                        <span className="input-group-text text-muted" id="basic-addon4">
                          <i className="ri-lock-2-line"></i>
                        </span>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          className="form-control form-control-lg border-light bg-light-subtle"
                          placeholder="Enter Password"
                          aria-label="Enter Password"
                          aria-describedby="basic-addon4"
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          autoComplete="current-password"
                        />
                        <button
                          type="button"
                          className="btn btn-light"
                          onClick={() => setShowPassword(s => !s)}
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                          title={showPassword ? 'Hide password' : 'Show password'}
                        >
                          <i className={showPassword ? 'ri-eye-off-line' : 'ri-eye-line'}></i>
                        </button>
                      </div>
                    </div>

                    <div className="form-check mb-4">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        id="remember-check"
                        checked={remember}
                        onChange={e => setRemember(e.target.checked)}
                      />
                      <label className="form-check-label" htmlFor="remember-check">Remember me</label>
                    </div>

                    <div className="d-grid">
                      <button
                        className="btn btn-primary waves-effect waves-light"
                        type="submit"
                        disabled={loading}
                      >
                        {loading ? 'Signing In...' : 'Sign in'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>

            <div className="mt-5 text-center">
              <p>
                © {new Date().getFullYear()} Powered by <a href="http://techcrast.co.ke">TechCrast LTD</a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
