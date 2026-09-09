import { useState, useEffect, useCallback, useMemo } from 'react'
import { getHppBatches } from '../lib/api'
import { calcHpp, rp, pc, nv, marginClass } from '../lib/hpp'

const JALUR = [
  { key: 'kongsiapa', label: 'Kongsiapa', cls: 'k' },
  { key: 'reseller', label: 'Reseller', cls: '' },
  { key: 'ec', label: 'End Customer', cls: 'g' },
]

const fdt = ts => new Date(ts).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })

// Dari semua batch, ambil YANG PALING BARU untuk tiap kombinasi
// nama produk + ukuran, per jalur (bisa beda batch sumbernya kalau
// satu jalur pernah diisi belakangan sementara jalur lain lebih lama).
// Hasilnya: satu baris solid per produk+ukuran, bukan log kejadian.
function buildDaftarHarga(hist) {
  const map = new Map()
  for (const b of hist) {
    for (const v of (b.hpp_variants || [])) {
      const key = `${(b.nama_produk || '').trim().toLowerCase()}__${nv(v.ukuran_target)}`
      if (!map.has(key)) {
        map.set(key, {
          nama_produk: b.nama_produk,
          ukuran_target: v.ukuran_target,
          perJalur: {}, // key jalur -> {harga, tanggal, batch, variant}
          terakhirUpdate: null,
          contohBatch: b, // dipakai buat breakdown HPP terbaru
          contohVariant: v,
        })
      }
      const row = map.get(key)
      JALUR.forEach(j => {
        const field = j.key === 'kongsiapa' ? 'harga_real_kongsiapa' : j.key === 'reseller' ? 'harga_real_mis' : 'harga_real'
        const harga = nv(v[field])
        if (harga <= 0) return
        const existing = row.perJalur[j.key]
        if (!existing || new Date(b.created_at) > new Date(existing.tanggal)) {
          row.perJalur[j.key] = { harga, tanggal: b.created_at }
        }
      })
      if (!row.terakhirUpdate || new Date(b.created_at) > new Date(row.terakhirUpdate)) {
        row.terakhirUpdate = b.created_at
        row.contohBatch = b
        row.contohVariant = v
      }
    }
  }
  return [...map.values()].sort((a, b) => (a.nama_produk || '').localeCompare(b.nama_produk || ''))
}

export default function DaftarHargaModule() {
  const [hist, setHist] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [openKey, setOpenKey] = useState(null)
  const [q, setQ] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try { setHist(await getHppBatches()) }
    catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const daftar = useMemo(() => buildDaftarHarga(hist), [hist])
  const filtered = useMemo(() => {
    if (!q.trim()) return daftar
    const qq = q.trim().toLowerCase()
    return daftar.filter(r => (r.nama_produk || '').toLowerCase().includes(qq))
  }, [daftar, q])

  return (
    <div className="hpp">
      <div className="card">
        <div className="card-head-h">Daftar Harga</div>
        <p className="muted sm" style={{ marginTop: 0 }}>
          Satu baris per produk + ukuran, menampilkan harga TERBARU yang pernah diisi di
          tiap jalur. Klik baris untuk lihat rincian perhitungan HPP-nya.
        </p>
        <input type="text" className="harga-search" placeholder="Cari nama produk…"
          value={q} onChange={e => setQ(e.target.value)} />
      </div>

      {error && <div className="err-banner">Error: {error}</div>}
      {loading ? <div className="loading">Memuat…</div>
        : filtered.length === 0 ? <div className="empty">
            {daftar.length === 0 ? 'Belum ada riwayat HPP sama sekali.' : 'Tidak ada produk yang cocok dicari.'}
          </div>
        : filtered.map(row => {
            const key = `${row.nama_produk}__${row.ukuran_target}`
            const open = openKey === key
            const R = calcHpp(row.contohBatch, [row.contohVariant])
            const c = R.C[0]
            return (
              <div className="card harga-row" key={key}>
                <div className="harga-row-head" onClick={() => setOpenKey(open ? null : key)}>
                  <div className="harga-row-title">
                    <b>{row.nama_produk}</b>
                    <span className="muted sm"> · {row.ukuran_target}g</span>
                  </div>
                  <div className="harga-row-prices">
                    {JALUR.map(j => {
                      const p = row.perJalur[j.key]
                      return (
                        <span key={j.key} className={`harga-chip ${j.cls}`}>
                          {j.label}: {p ? rp(p.harga) : '—'}
                        </span>
                      )
                    })}
                  </div>
                  <button className="foldbtn">{open ? '▾ Tutup' : '▸ Rincian HPP'}</button>
                </div>

                {open && (
                  <div className="harga-detail">
                    <div className="hpp-stats" style={{ marginTop: 0 }}>
                      <div><span className="sl">HPP / pack</span><b className="accent">{rp(c.hpp)}</b></div>
                      <div><span className="sl">Data dari batch</span><b>{fdt(row.contohBatch.created_at)}</b></div>
                    </div>

                    <table className="out-tbl" style={{ marginTop: 12 }}>
                      <thead><tr><th>Jalur</th><th>Harga</th><th>Margin</th><th>Untung/pack</th><th>Update terakhir</th></tr></thead>
                      <tbody>
                        {JALUR.map(j => {
                          const p = row.perJalur[j.key]
                          const jc = c.jalur[j.key]
                          return (
                            <tr key={j.key}>
                              <td style={{ textAlign: 'left' }}>{j.label}</td>
                              <td className={j.cls}>{p ? rp(p.harga) : '—'}</td>
                              <td className={jc.marginReal !== null ? marginClass(jc.marginReal) : ''}>
                                {jc.marginReal !== null ? pc(jc.marginReal) : '—'}
                              </td>
                              <td className={jc.untungReal !== null ? (jc.untungReal > 0 ? 'g' : 'r') : ''}>
                                {jc.untungReal !== null ? rp(jc.untungReal) : '—'}
                              </td>
                              <td className="sm muted">{p ? fdt(p.tanggal) : '—'}</td>
                            </tr>
                          )
                        })}
                        {c.marginKongsiapaKeEcReal !== null && (
                          <tr className="info-row">
                            <td style={{ textAlign: 'left' }}>Kongsiapa → EC <span className="info-tag">info</span></td>
                            <td colSpan={2} className="muted">{pc(c.marginKongsiapaKeEcReal)}</td>
                            <td className="muted">{rp(c.selisihKongsiapaKeEcReal)}</td>
                            <td></td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
    </div>
  )
}
