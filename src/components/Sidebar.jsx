import { useEffect } from 'react'
import { NavLink } from 'react-router-dom'

const MODULES = [
  { path: '/konten', label: 'Konten', desc: 'Threads · Instagram · TikTok', icon: '📝' },
  { path: '/hpp', label: 'HPP', desc: 'Kalkulator batch & harga jual', icon: '🧮' },
  { path: '/komponen', label: 'Komponen HPP', desc: 'Master kemasan & harga', icon: '📦' },
]

export default function Sidebar({ open, onClose }) {
  useEffect(() => {
    if (!open) return
    const h = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])

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
            <NavLink
              key={m.path}
              to={m.path}
              onClick={onClose}
              className={({ isActive }) => `sb-item ${isActive ? 'on' : ''}`}
            >
              <span className="sb-ico">{m.icon}</span>
              <span className="sb-txt">
                <span className="sb-lbl">{m.label}</span>
                <span className="sb-desc">{m.desc}</span>
              </span>
            </NavLink>
          ))}
        </nav>

        <div className="sb-foot">
          Super app Ibu Siapa
        </div>
      </aside>
    </>
  )
}
