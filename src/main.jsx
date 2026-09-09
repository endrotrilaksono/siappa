import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/app.css'

// Matikan efek scroll mouse mengubah angka di SEMUA input type=number,
// di SELURUH app, terpasang sekali di sini, bukan ditempel per kolom.
// Kalau input angka sedang fokus dan mouse discroll di atasnya, browser
// bawaan akan menaik/turunkan angkanya tanpa sengaja — itu yang dimatikan.
// Caranya: begitu wheel terdeteksi di atas input angka yang sedang aktif,
// langsung blur (lepas fokus), jadi scroll-nya jatuh ke scroll halaman
// biasa, bukan mengubah angka.
window.addEventListener('wheel', (e) => {
  const el = document.activeElement
  if (el && el.tagName === 'INPUT' && el.type === 'number') {
    el.blur()
  }
}, { passive: true })

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
