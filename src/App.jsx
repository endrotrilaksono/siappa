import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useState } from 'react'
import Sidebar from './components/Sidebar'
import HppModule from './modules/HppModule'
import KomponenHppModule from './modules/KomponenHppModule'
import DaftarHargaModule from './modules/DaftarHargaModule'
import AuthGate from './components/AuthGate'
import { hasCredentials } from './lib/supabase'
import { UnsavedChangesProvider } from './lib/unsavedChanges'

const TITLES = { '/hpp': 'HPP Kalkulator', '/komponen': 'Komponen HPP', '/harga': 'Daftar Harga' }

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
          <Route path="/hpp" element={<div className="body"><HppModule /></div>} />
          <Route path="/komponen" element={<div className="body"><KomponenHppModule /></div>} />
          <Route path="/harga" element={<div className="body"><DaftarHargaModule /></div>} />
          {/* tab Konten sengaja dilepas dari navigasi. Datanya TETAP AMAN
              di Supabase (tabel contents/content_parts tidak disentuh),
              cuma pintu masuknya di app yang dicabut. Gampang dipasang
              lagi kalau suatu saat dibutuhkan lagi. */}
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
          <UnsavedChangesProvider>
            <Shell signOut={signOut} />
          </UnsavedChangesProvider>
        </BrowserRouter>
      )}
    </AuthGate>
  )
}
