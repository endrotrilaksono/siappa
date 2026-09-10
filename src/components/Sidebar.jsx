import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useUnsavedGuard } from '../lib/unsavedChanges'

const MODULES = [
  { path: '/hpp', label: 'HPP', desc: 'Kalkulator batch & harga jual', icon: '🧮' },
  { path: '/komponen', label: 'Komponen HPP', desc: 'Master kemasan & harga', icon: '📦' },
  { path: '/harga', label: 'Daftar Harga', desc: 'Harga terbaru tiap varian', icon: '💰' },
]

export default function Sidebar({ open, onClose }) {
  const location = useLocation()
  const { requestNavigate } = useUnsavedGuard()

  useEffect(() => {
    if (!open) return
    const h = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])

  function go(path) {
    onClose()
    if (path === location.pathname) return
    requestNavigate(path)
  }

  return (
    <>
      <div className={`sb-backdrop ${open ? 'on' : ''}`} onClick={onClose} />
      <aside className={`sb ${open ? 'on' : ''}`}>
        <div className="sb-head">
          <div>
            <div className="sb-brand">Siappa</div>
            <div className="sb-sub">Ibu Siapa</div>
          </div>
          <button className="sb-x" onClick={onClose} aria-label="Tutup menu">×</button>
        </div>

        <nav className="sb-nav">
          {MODULES.map(m => (
            <button
              key={m.path}
              className={`sb-item ${location.pathname === m.path ? 'on' : ''}`}
              onClick={() => go(m.path)}
            >
              <span className="sb-ico">{m.icon}</span>
              <span className="sb-txt">
                <span className="sb-lbl">{m.label}</span>
                <span className="sb-desc">{m.desc}</span>
              </span>
            </button>
          ))}
        </nav>

        <div className="sb-foot">
          Super app Ibu Siapa
        </div>
      </aside>
    </>
  )
}
