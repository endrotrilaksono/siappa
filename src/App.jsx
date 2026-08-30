import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useState } from 'react'
import Sidebar from './components/Sidebar'
import KontenModule from './modules/KontenModule'
import HppModule from './modules/HppModule'
import KomponenHppModule from './modules/KomponenHppModule'
import AuthGate from './components/AuthGate'
import { hasCredentials } from './lib/supabase'

const TITLES = { '/konten': 'Konten', '/hpp': 'HPP Kalkulator', '/komponen': 'Komponen HPP' }

function Shell({ signOut }) {
  const [sbOpen, setSbOpen] = useState(false)
  const location = useLocation()
  const title = TITLES[location.pathname] || ''

  return (
    <div className="shell">
      <Sidebar open={sbOpen} onClose={() => setSbOpen(false)} />

      <header className="topbar">
        <button className="burger" onClick={() => setSbOpen(true)} aria-label="Buka menu">
          <span></span><span></span><span></span>
        </button>
        <div className="tb-titles">
          <h1>Siappa</h1>
          <span className="tb-mod">{title}</span>
        </div>
        <span className="brand-label">Ibu Siapa</span>
        <button className="logout-btn" onClick={signOut}>Keluar</button>
      </header>

      <main className="content">
        {!hasCredentials && (
          <div className="body">
            <div className="err-banner">
              Credential Supabase belum diisi. Buat <b>.env.local</b> dari <b>.env.example</b>, lalu restart <b>npm run dev</b>.
            </div>
          </div>
        )}
        <Routes>
          <Route path="/" element={<Navigate to="/hpp" replace />} />
          <Route path="/konten" element={<KontenModule />} />
          <Route path="/hpp" element={<div className="body"><HppModule /></div>} />
          <Route path="/komponen" element={<div className="body"><KomponenHppModule /></div>} />
          {/* fallback: path tak dikenal balik ke HPP, bukan halaman putih */}
          <Route path="*" element={<Navigate to="/hpp" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <AuthGate>
      {(session, signOut) => (
        <BrowserRouter>
          <Shell signOut={signOut} />
        </BrowserRouter>
      )}
    </AuthGate>
  )
}
