import { useState } from 'react'
import Sidebar from './components/Sidebar'
import KontenModule from './modules/KontenModule'
import HppModule from './modules/HppModule'
import { hasCredentials } from './lib/supabase'

const TITLES = { konten: 'Konten', hpp: 'HPP Kalkulator' }

export default function App() {
  const [sbOpen, setSbOpen] = useState(false)
  const [module, setModule] = useState('konten')

  return (
    <div className="shell">
      <Sidebar
        open={sbOpen}
        onClose={() => setSbOpen(false)}
        active={module}
        onSelect={setModule}
      />

      <header className="topbar">
        <button className="burger" onClick={() => setSbOpen(true)} aria-label="Buka menu">
          <span></span><span></span><span></span>
        </button>
        <div className="tb-titles">
          <h1>Siappa</h1>
          <span className="tb-mod">{TITLES[module]}</span>
        </div>
        <span className="brand-label">Ibu Siapa</span>
      </header>

      <main className="content">
        {!hasCredentials && (
          <div className="body">
            <div className="err-banner">
              Credential Supabase belum diisi. Buat <b>.env.local</b> dari <b>.env.example</b>, lalu restart <b>npm run dev</b>.
            </div>
          </div>
        )}
        {module === 'konten' && <KontenModule />}
        {module === 'hpp' && <div className="body"><HppModule /></div>}
      </main>
    </div>
  )
}
