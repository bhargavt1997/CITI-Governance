import { useState } from 'react'
import { useAuth } from '../auth'

export default function Login() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await login(email.trim(), password)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-brand">
        <div className="login-brand-inner">
          <div className="login-logo">CG</div>
          <h1>Citi Governance</h1>
          <p>
            One place for onboarding, PTS timesheets, skill profiles and
            certifications — no more scattered Excel sheets.
          </p>
          <ul className="login-points">
            <li>📊 Live governance dashboard &amp; monthly trends</li>
            <li>🧭 8-stage onboarding pipeline with audit trail</li>
            <li>🕒 Weekly PTS hours, auto-totaled</li>
            <li>🎓 Certification catalog &amp; progress tracking</li>
          </ul>
        </div>
      </div>

      <div className="login-form-side">
        <form className="login-card" onSubmit={submit}>
          <h2>Welcome back</h2>
          <p className="login-sub">Sign in with your Deloitte email</p>

          {error && <div className="error-banner">{error}</div>}

          <label className="login-label">Email</label>
          <input
            type="email" required autoFocus
            value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="you@deloitte.com"
          />

          <label className="login-label">Password</label>
          <input
            type="password" required
            value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />

          <button className="btn login-btn" type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>

          <div className="login-hint">
            <span><strong>Demo accounts</strong> · password <code>Citi@123</code></span>
            <span>Lead — suresh.iyer@deloitte.com</span>
            <span>Developer — arjun.mehta@deloitte.com</span>
          </div>
        </form>
      </div>
    </div>
  )
}
