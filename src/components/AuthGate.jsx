import { useState, useEffect } from 'react'
import { getSession, onAuthChange, signOut } from '../lib/auth'
import Login from './Login'

// Bungkus seluruh app dengan ini. Belum login -> tampilkan Login.
// Sudah login -> tampilkan children, dan sediakan signOut lewat prop
// onSignOut supaya bisa dipasang tombol logout di topbar/sidebar.
export default function AuthGate({ children }) {
  const [session, setSession] = useState(undefined) // undefined = belum dicek, null = tidak login
  const [error, setError] = useState(null)

  useEffect(() => {
    getSession().then(setSession).catch(e => { setError(e.message); setSession(null) })
    const unsub = onAuthChange(setSession)
    return unsub
  }, [])

  if (session === undefined) {
    return <div className="auth-loading">Memuat…</div>
  }
  if (!session) {
    return <Login />
  }
  return children(session, signOut)
}
