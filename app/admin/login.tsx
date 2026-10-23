'use client';

import { useEffect, useState } from 'react';
import {
  Lock,
  Mail,
  KeyRound,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Coffee,
  Sparkles
} from 'lucide-react';

export default function AdminLogin() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showToken, setShowToken] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [setupToken, setSetupToken] = useState('');

  useEffect(() => {
    fetch('/api/admin-auth')
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error);
        if (d.authenticated) {
          window.location.assign('/admin');
          return;
        }
        setConfigured(!!d.configured);
      })
      .catch(() => setError('Unable to check administrator setup status.'));
  }, []);

  async function submit(e: React.FormEvent<HTMLFormElement>, action: 'setup' | 'login') {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');

    if (action === 'setup') {
      if (password !== confirm) {
        setError('Passwords do not match.');
        setBusy(false);
        return;
      }
      if (password.length < 14) {
        setError('Password must be at least 14 characters long.');
        setBusy(false);
        return;
      }
      if (!/^[a-f0-9]{64,}$/i.test(setupToken.trim())) {
        setError('Activation token must be at least 64 hexadecimal characters.');
        setBusy(false);
        return;
      }
    }

    try {
      const res = await fetch('/api/admin-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          email: email.trim(),
          password,
          setupToken: setupToken.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Authentication request failed.');

      if (action === 'setup') {
        setConfigured(true);
        setMessage('Administrator account successfully activated. Please sign in below.');
        setPassword('');
        setConfirm('');
        setSetupToken('');
      } else {
        window.location.assign('/admin');
      }
    } catch (err: any) {
      setError(err?.message || 'Authentication error.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-auth-page">
      <header className="admin-auth-header">
        <a href="/" className="admin-auth-back-link">
          <ArrowLeft size={15} />
          <span>Reading Desk</span>
        </a>
        <div className="admin-auth-header-tag">
          <span className="pulse-dot" />
          <span>Protected Gateway</span>
        </div>
      </header>

      <main className="admin-auth-main">
        <div className="admin-auth-brand-center">
          <a href="/" className="admin-logo-emblem" title="TOMOCA Coffee Reads">
            <img src="/tomoca-logo.png" alt="TOMOCA Coffee 1953" className="admin-logo-img" />
          </a>
          <div className="admin-auth-brand-title">
            <span>reads.</span>
            <span className="brand-dot">•</span>
          </div>
        </div>

        <div className="admin-auth-card">
          {configured === null ? (
            <div className="admin-auth-loading">
              <div className="loading-spinner-wrap">
                <Coffee size={28} className="spin-icon" />
              </div>
              <h2>Connecting to TOMOCA Reads</h2>
              <p>Verifying secure administrator configuration…</p>
            </div>
          ) : configured ? (
            <>
              <div className="admin-card-header">
                <span className="admin-badge">
                  <Lock size={12} />
                  Private Administration
                </span>
                <h1>Welcome back.</h1>
                <p>Sign in to manage news curation, daily café QR tokens, and subscription billing.</p>
              </div>

              {message && (
                <div className="auth-alert success" role="status">
                  <CheckCircle2 size={18} className="alert-icon" />
                  <div>{message}</div>
                </div>
              )}

              {error && (
                <div className="auth-alert error" role="alert">
                  <AlertCircle size={18} className="alert-icon" />
                  <div>{error}</div>
                </div>
              )}

              <form onSubmit={e => submit(e, 'login')} className="admin-auth-form">
                <div className="form-group">
                  <label htmlFor="login-email">Administrator Email</label>
                  <div className="input-wrap">
                    <Mail size={18} className="input-icon" />
                    <input
                      id="login-email"
                      name="email"
                      type="email"
                      autoComplete="username"
                      required
                      placeholder="admin@tomocacoffee.et"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      disabled={busy}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <div className="label-with-hint">
                    <label htmlFor="login-password">Password</label>
                  </div>
                  <div className="input-wrap">
                    <Lock size={18} className="input-icon" />
                    <input
                      id="login-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      maxLength={256}
                      placeholder="Enter your password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      disabled={busy}
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="admin-submit-btn"
                  disabled={busy || !email || !password}
                >
                  {busy ? (
                    <>
                      <Loader2 size={18} className="spin-icon" />
                      <span>Authenticating…</span>
                    </>
                  ) : (
                    <>
                      <span>Sign in to Dashboard</span>
                      <ArrowRight size={18} className="arrow-icon" />
                    </>
                  )}
                </button>
              </form>

              <div className="admin-auth-footer">
                <ShieldCheck size={14} />
                <span>Protected by salted PBKDF2 & 8-hour encrypted session cookies</span>
              </div>
            </>
          ) : (
            <>
              <div className="admin-card-header">
                <span className="admin-badge setup">
                  <KeyRound size={12} />
                  First-Time Activation
                </span>
                <h1>Activate TOMOCA Reads</h1>
                <p>Create the primary administrator account using the one-time activation token from your environment configuration.</p>
              </div>

              {error && (
                <div className="auth-alert error" role="alert">
                  <AlertCircle size={18} className="alert-icon" />
                  <div>{error}</div>
                </div>
              )}

              <form onSubmit={e => submit(e, 'setup')} className="admin-auth-form">
                <div className="form-group">
                  <label htmlFor="setup-email">Administrator Email</label>
                  <div className="input-wrap">
                    <Mail size={18} className="input-icon" />
                    <input
                      id="setup-email"
                      name="email"
                      type="email"
                      autoComplete="username"
                      required
                      maxLength={254}
                      placeholder="admin@tomocacoffee.et"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      disabled={busy}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <div className="label-with-hint">
                    <label htmlFor="setup-password">Password</label>
                    <span className={`char-hint ${password.length >= 14 ? 'valid' : ''}`}>
                      {password.length}/14 min
                    </span>
                  </div>
                  <div className="input-wrap">
                    <Lock size={18} className="input-icon" />
                    <input
                      id="setup-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      minLength={14}
                      maxLength={256}
                      required
                      placeholder="At least 14 characters"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      disabled={busy}
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <div className="label-with-hint">
                    <label htmlFor="setup-confirm">Confirm Password</label>
                    {confirm && (
                      <span className={`char-hint ${password === confirm ? 'valid' : 'invalid'}`}>
                        {password === confirm ? 'Matches' : 'Does not match'}
                      </span>
                    )}
                  </div>
                  <div className="input-wrap">
                    <Lock size={18} className="input-icon" />
                    <input
                      id="setup-confirm"
                      name="confirm"
                      type={showConfirm ? 'text' : 'password'}
                      autoComplete="new-password"
                      minLength={14}
                      maxLength={256}
                      required
                      placeholder="Repeat password"
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      disabled={busy}
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowConfirm(!showConfirm)}
                      aria-label={showConfirm ? 'Hide password' : 'Show password'}
                      tabIndex={-1}
                    >
                      {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <div className="label-with-hint">
                    <label htmlFor="setup-token">Activation Token (Hex)</label>
                    <span className={`char-hint ${setupToken.length >= 64 ? 'valid' : ''}`}>
                      {setupToken.length}/64 hex
                    </span>
                  </div>
                  <div className="input-wrap">
                    <KeyRound size={18} className="input-icon" />
                    <input
                      id="setup-token"
                      name="setupToken"
                      type={showToken ? 'text' : 'password'}
                      autoComplete="off"
                      required
                      minLength={64}
                      className="mono-input"
                      placeholder="Paste your 64-character ADMIN_SETUP_TOKEN"
                      value={setupToken}
                      onChange={e => setSetupToken(e.target.value)}
                      disabled={busy}
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowToken(!showToken)}
                      aria-label={showToken ? 'Hide token' : 'Show token'}
                      tabIndex={-1}
                    >
                      {showToken ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <p className="field-help">
                    Found in your <code className="inline-code">.env.local</code> as <code className="inline-code">ADMIN_SETUP_TOKEN</code>.
                  </p>
                </div>

                <button
                  type="submit"
                  className="admin-submit-btn"
                  disabled={busy || !email || password.length < 14 || password !== confirm || setupToken.length < 64}
                >
                  {busy ? (
                    <>
                      <Loader2 size={18} className="spin-icon" />
                      <span>Creating Administrator…</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={18} />
                      <span>Activate Administrator</span>
                    </>
                  )}
                </button>
              </form>

              <div className="admin-auth-footer">
                <ShieldCheck size={14} />
                <span>Single-use activation token · Cannot create additional admins once configured</span>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
