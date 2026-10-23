'use client';

import { useEffect, useState } from 'react';
import {
  Lock,
  Mail,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  Coffee,
  Sparkles,
  KeyRound
} from 'lucide-react';

export default function ActivateAdmin({ token }: { token: string }) {
  const [state, setState] = useState<any>({ loading: true });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (!token) {
      setState({ loading: false, valid: false });
      setError('This activation link is missing its one-time security token.');
      return;
    }
    fetch('/api/admin-activate?token=' + encodeURIComponent(token))
      .then(async r => ({ ok: r.ok, data: await r.json() }))
      .then(({ ok, data }) => {
        setState({ loading: false, ...data });
        if (!ok) setError(data.error || 'This invitation link is not valid.');
      })
      .catch(() => {
        setState({ loading: false, valid: false });
        setError('Unable to validate this administrator invitation.');
      });
  }, [token]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 14) {
      setError('Password must be at least 14 characters long.');
      return;
    }

    setBusy(true);
    try {
      const r = await fetch('/api/admin-activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Activation failed.');
      window.location.assign('/admin');
    } catch (e: any) {
      setError(e.message || 'Activation failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-auth-page">
      <header className="admin-auth-header">
        <a href="/admin" className="admin-auth-back-link">
          <ArrowLeft size={15} />
          <span>Sign In</span>
        </a>
        <div className="admin-auth-header-tag">
          <span className="pulse-dot" />
          <span>Invitation Gateway</span>
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
          {state.loading ? (
            <div className="admin-auth-loading">
              <div className="loading-spinner-wrap">
                <Coffee size={28} className="spin-icon" />
              </div>
              <h2>Verifying Invitation</h2>
              <p>Validating your one-time TOMOCA Reads administrator link…</p>
            </div>
          ) : state.valid ? (
            <>
              <div className="admin-card-header">
                <span className="admin-badge invitation">
                  <KeyRound size={12} />
                  Administrator Invitation
                </span>
                <h1>Activate your access</h1>
                <p>
                  This invitation is for <strong>{state.email}</strong>. Choose a strong password to complete activation.
                </p>
              </div>

              {error && (
                <div className="auth-alert error" role="alert">
                  <AlertCircle size={18} className="alert-icon" />
                  <div>{error}</div>
                </div>
              )}

              <form onSubmit={submit} className="admin-auth-form">
                <div className="form-group">
                  <div className="label-with-hint">
                    <label htmlFor="invite-password">Create Password</label>
                    <span className={`char-hint ${password.length >= 14 ? 'valid' : ''}`}>
                      {password.length}/14 min
                    </span>
                  </div>
                  <div className="input-wrap">
                    <Lock size={18} className="input-icon" />
                    <input
                      id="invite-password"
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
                    <label htmlFor="invite-confirm">Confirm Password</label>
                    {confirm && (
                      <span className={`char-hint ${password === confirm ? 'valid' : 'invalid'}`}>
                        {password === confirm ? 'Matches' : 'Does not match'}
                      </span>
                    )}
                  </div>
                  <div className="input-wrap">
                    <Lock size={18} className="input-icon" />
                    <input
                      id="invite-confirm"
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

                <button
                  type="submit"
                  className="admin-submit-btn"
                  disabled={busy || password.length < 14 || password !== confirm}
                >
                  {busy ? (
                    <>
                      <Loader2 size={18} className="spin-icon" />
                      <span>Activating Administrator…</span>
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
                <span>One-time secure activation · Token expires in 48 hours</span>
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '10px 0' }}>
              <div className="admin-card-header" style={{ marginBottom: 18 }}>
                <span className="admin-badge" style={{ color: '#b93322', background: 'rgba(185, 51, 34, 0.08)', borderColor: 'rgba(185, 51, 34, 0.2)' }}>
                  <AlertCircle size={12} />
                  Invitation Unavailable
                </span>
                <h1>Link Expired or Invalid</h1>
                <p>{error || 'This administrator invitation is invalid, has expired, or was already used.'}</p>
              </div>

              <a
                href="/admin"
                className="admin-submit-btn"
                style={{ textDecoration: 'none', display: 'inline-flex' }}
              >
                <span>Return to Administrator Sign In</span>
                <ArrowRight size={18} className="arrow-icon" />
              </a>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
