import { useState } from 'react';
import { api } from '../api';

const STEP = { PHONE: 'phone', CODE: 'code', TWO_FA: '2fa' };

export default function LoginScreen({ onLoggedIn }) {
  const [step, setStep]       = useState(STEP.PHONE);
  const [phone, setPhone]     = useState('');
  const [code, setCode]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  async function handleSendCode(e) {
    e.preventDefault();
    setError('');
    if (!phone.trim()) return setError('Enter your phone number');
    setLoading(true);
    try {
      await api.sendCode(phone.trim());
      setStep(STEP.CODE);
    } catch (err) {
      setError(err.message || 'Failed to send code');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode(e) {
    e.preventDefault();
    setError('');
    if (!code.trim()) return setError('Enter the code from Telegram');
    setLoading(true);
    try {
      const res = await api.verifyCode(code.trim());
      if (res.requires2FA) {
        setStep(STEP.TWO_FA);
      } else if (res.ok) {
        onLoggedIn();
      } else {
        setError('Verification failed. Try again.');
      }
    } catch (err) {
      setError(err.message || 'Invalid code');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify2FA(e) {
    e.preventDefault();
    setError('');
    if (!password.trim()) return setError('Enter your 2FA password');
    setLoading(true);
    try {
      const res = await api.verify2FA(password.trim());
      if (res.ok) {
        onLoggedIn();
      } else {
        setError('Wrong password');
      }
    } catch (err) {
      setError(err.message || 'Wrong password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="screen login-screen">
      <div className="login-header">
        <div className="app-icon">🚪</div>
        <h1 className="app-title">Instant Leave</h1>
        <p className="app-subtitle">
          Sign in with your Telegram account to manage your channels and groups
        </p>
      </div>

      {step === STEP.PHONE && (
        <form className="login-form" onSubmit={handleSendCode}>
          <label className="input-label">Phone number</label>
          <input
            className="input"
            type="tel"
            placeholder="+1 234 567 8900"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            disabled={loading}
            autoFocus
          />
          {error && <p className="error-text">{error}</p>}
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Sending...' : 'Send Code'}
          </button>
        </form>
      )}

      {step === STEP.CODE && (
        <form className="login-form" onSubmit={handleVerifyCode}>
          <label className="input-label">Verification code</label>
          <p className="hint-text">Enter the code sent to {phone} via Telegram</p>
          <input
            className="input input-code"
            type="text"
            inputMode="numeric"
            placeholder="12345"
            value={code}
            onChange={e => setCode(e.target.value)}
            disabled={loading}
            maxLength={10}
            autoFocus
          />
          {error && <p className="error-text">{error}</p>}
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Verifying...' : 'Confirm Code'}
          </button>
          <button
            className="btn btn-ghost"
            type="button"
            onClick={() => { setStep(STEP.PHONE); setCode(''); setError(''); }}
          >
            ← Change number
          </button>
        </form>
      )}

      {step === STEP.TWO_FA && (
        <form className="login-form" onSubmit={handleVerify2FA}>
          <label className="input-label">Two-step verification</label>
          <p className="hint-text">Your account has 2FA enabled. Enter your cloud password.</p>
          <input
            className="input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            disabled={loading}
            autoFocus
          />
          {error && <p className="error-text">{error}</p>}
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Verifying...' : 'Confirm Password'}
          </button>
        </form>
      )}

      <p className="privacy-note">
        🔒 Your session is stored securely. We never store your password.
      </p>
    </div>
  );
}
