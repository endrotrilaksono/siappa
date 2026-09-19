import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/app.css'

// Matikan efek scroll mouse mengubah angka di SEMUA input type=number.
window.addEventListener('wheel', (e) => {
  const el = document.activeElement
  if (el && el.tagName === 'INPUT' && el.type === 'number') {
    el.blur()
  }
}, { passive: true })

// Enter di kolom input/dropdown manapun = selesai mengisi, fokus lepas.
// Sengaja TIDAK berlaku untuk TEXTAREA (biar Enter tetap bisa jadi baris
// baru di sana, misal kotak import JSON lama), dan tidak mengganggu
// kolom yang sudah punya aksi Enter sendiri (mis. chip Daftar Harga
// yang pakai Enter buat langsung menyimpan) — chip itu menangani
// Enter-nya sendiri dulu (commit lalu keluar dari mode edit), listener
// global ini cuma menyusul melepas fokus sesudahnya, tidak bentrok.
window.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return
  const el = document.activeElement
  if (el && (el.tagName === 'INPUT' || el.tagName === 'SELECT')) {
    el.blur()
  }
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
