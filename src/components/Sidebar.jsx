import { useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useUnsavedGuard } from '../lib/unsavedChanges'

const MODULES = [
  { path: '/harga', label: 'Daftar Harga', desc: 'Harga terbaru tiap varian', icon: '💰' },
  { path: '/hpp', label: 'HPP', desc: 'Kalkulator batch & harga jual', icon: '🧮' },
  { path: '/channel', label: 'Channel Penjualan', desc: 'Untung lintas channel, multi produk', icon: '🔀' },
  { path: '/komponen', label: 'Komponen HPP', desc: 'Master kemasan & harga', icon: '📦' },
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

  // Link sungguhan (bukan tombol), supaya klik kanan "buka di tab baru",
  // Cmd/Ctrl-klik, dan klik tengah mouse semuanya jalan alami lewat
  // browser tanpa kita utak-atik. Yang KITA cegat cuma klik kiri polos
  // tanpa modifier, itu yang perlu lewat pemeriksaan perubahan belum
  // simpan dulu sebelum pindah tab yang sama.
  function handleClick(e, path) {
    const isModified = e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0
    if (isModified) return // biarkan browser yang urus (tab baru, dst)
    e.preventDefault()
    onClose()
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
            <NavLink
              key={m.path}
              to={m.path}
              onClick={e => handleClick(e, m.path)}
              className={`sb-item ${location.pathname === m.path ? 'on' : ''}`}
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
