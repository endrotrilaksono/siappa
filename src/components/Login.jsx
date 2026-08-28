import { useState } from 'react'
import { signIn } from '../lib/auth'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      await signIn(email.trim(), password)
      // onAuthChange di AuthGate yang menangkap perubahan sesi, tidak perlu redirect manual
    } catch (err) {
      setError(
        err.message === 'Invalid login credentials'
          ? 'Email atau password salah.'
          : err.message
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand">Siappa</div>
        <div className="login-sub">Masuk untuk melanjutkan</div>

        <div className="fld">
          <label>Email</label>
          <input type="email" required autoFocus value={email}
            onChange={e => setEmail(e.target.value)} placeholder="nama@email.com" />
        </div>
        <div className="fld">
          <label>Password</label>
          <input type="password" required value={password}
            onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
        </div>

        {error && <div className="login-err">{error}</div>}

        <button className="btn-primary login-btn" disabled={loading} type="submit">
          {loading ? 'Masuk…' : 'Masuk'}
        </button>

        <p className="login-note">
          Belum punya akun? Hubungi admin untuk didaftarkan.
        </p>
      </form>
    </div>
  )
}
