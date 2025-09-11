'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ErrorMessage from '../../../components/ui/ErrorMessage';
import { useAuth } from '../../../components/providers/AuthProvider';

export default function LoginPage() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { login } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!phone || !password) {
      setError('Both fields are required');
      return;
    }
    setLoading(true);

    try {
      await login(phone, password);
      router.push('/dashboard');
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
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
                          type="password"
                          className="form-control form-control-lg border-light bg-light-subtle"
                          placeholder="Enter Password"
                          aria-label="Enter Password"
                          aria-describedby="basic-addon4"
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          autoComplete="current-password"
                        />
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