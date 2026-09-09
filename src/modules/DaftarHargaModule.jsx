import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { getHppBatches, deleteHppBatch } from '../lib/api'
import { supabase } from '../lib/supabase'
import { calcHpp, rp, gr } from '../lib/hpp'

const fdt = ts => {
  const d = new Date(ts)
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: '2-digit' }) +
    ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

const JALUR_MARGIN = [
  { key: 'margin_kongsiapa', label: 'Kongsiapa' },
  { key: 'margin_mis', label: 'Reseller' },
  { key: 'margin_ec', label: 'End Customer' },
]

export default function DaftarHargaModule() {
  const navigate = useNavigate()
  const [hist, setHist] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState('')
  const [q, setQ] = useState('')

  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState([])
  const [bulkJalur, setBulkJalur] = useState('margin_kongsiapa')
  const [bulkValue, setBulkValue] = useState('')
  const [bulkBusy, setBulkBusy] = useState(false)

  const flash = msg => { setToast(msg); setTimeout(() => setToast(''), 2600) }

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try { setHist(await getHppBatches()) }
    catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    if (!q.trim()) return hist
    const qq = q.trim().toLowerCase()
    return hist.filter(b => (b.nama_produk || '').toLowerCase().includes(qq))
  }, [hist, q])

  function editBatch(batch) {
    // bawa ke "pabrik" (kalkulator HPP) dengan batch ini termuat di form
    navigate('/hpp', { state: { loadBatchId: batch.id } })
  }

  async function removeBatch(batch) {
    if (!confirm(`Hapus "${batch.nama_produk}" dari Daftar Harga? Permanen, tidak bisa dibatalkan.`)) return
    try { await deleteHppBatch(batch.id); load(); flash('Dihapus') }
    catch (e) { alert('Gagal menghapus: ' + e.message) }
  }

  function toggleSelect(id) {
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
  }
  function toggleSelectAll() {
    setSelected(s => s.length === filtered.length ? [] : filtered.map(b => b.id))
  }
  function exitSelectMode() {
    setSelectMode(false); setSelected([]); setBulkValue('')
  }

  async function bulkDeleteSelected() {
    if (!selected.length) return
    if (!confirm(`Hapus ${selected.length} produk dari Daftar Harga? Permanen, tidak bisa dibatalkan.`)) return
    try {
      const { error } = await supabase.from('hpp_batches').delete().in('id', selected)
      if (error) throw error
      exitSelectMode(); load(); flash('Terhapus')
    } catch (e) { alert('Gagal menghapus: ' + e.message) }
  }

  async function applyBulkMargin() {
    const val = parseFloat(bulkValue)
    if (isNaN(val) || val < 0 || val >= 100) { alert('Isi angka margin yang valid (0-99).'); return }
    if (!selected.length) return
    const jalurLabel = JALUR_MARGIN.find(j => j.key === bulkJalur)?.label
    if (!confirm(
      `Ubah margin ${jalurLabel} jadi ${val}% untuk ${selected.length} produk?\n\n` +
      `Ini CUMA mengubah target margin, TIDAK mengubah harga real yang sudah dicatat.`
    )) return
    setBulkBusy(true)
    try {
      const { error } = await supabase
        .from('hpp_variants')
        .update({ [bulkJalur]: val })
        .in('batch_id', selected)
      if (error) throw error
      exitSelectMode(); load()
      flash(`✓ Margin ${jalurLabel} ${selected.length} produk diperbarui`)
    } catch (e) { alert('Gagal update massal: ' + e.message) }
    finally { setBulkBusy(false) }
  }

  return (
    <div className="hpp">
      {toast && <div className="hpp-toast">{toast}</div>}

      <div className="card">
        <div className="card-head-h">Daftar Harga</div>
        <p className="muted sm" style={{ marginTop: 0 }}>
          Hasil jadi dari Kalkulator HPP. Klik Edit untuk kembali ke kalkulator dan hitung ulang.
        </p>
        <input type="text" className="harga-search" placeholder="Cari nama produk…"
          value={q} onChange={e => setQ(e.target.value)} />
      </div>

      {selectMode ? (
        <div className="actionbar select-mode">
          <label className="chk-all">
            <input type="checkbox" checked={selected.length === filtered.length && filtered.length > 0}
              onChange={toggleSelectAll} />
            Pilih semua ({filtered.length})
          </label>
          <span className="sel-count">{selected.length} dipilih</span>
          <button className="btn-danger" onClick={bulkDeleteSelected} disabled={!selected.length}>
            🗑 Hapus {selected.length || ''}
          </button>
          <button className="btn-ghost" onClick={exitSelectMode}>Batal</button>
        </div>
      ) : (
        <div className="actionbar">
          {hist.length > 0 && <button className="btn-ghost-dark" onClick={() => setSelectMode(true)}>☑ Pilih / Ubah massal</button>}
        </div>
      )}

      {selectMode && selected.length > 0 && (
        <div className="card bulk-margin-card">
          <div className="card-head-h">Ubah Margin Massal</div>
          <p className="muted sm" style={{ marginTop: 0 }}>
            Berlaku untuk {selected.length} produk terpilih. Cuma mengubah target margin,
            harga real yang sudah dicatat TIDAK ikut berubah.
          </p>
          <div className="bulk-margin-row">
            <select value={bulkJalur} onChange={e => setBulkJalur(e.target.value)}>
              {JALUR_MARGIN.map(j => <option key={j.key} value={j.key}>{j.label}</option>)}
            </select>
            <input type="number" placeholder="Margin %" value={bulkValue}
              onChange={e => setBulkValue(e.target.value)} style={{ width: 90 }} />
            <button className="btn-primary" onClick={applyBulkMargin} disabled={bulkBusy || !bulkValue}>
              {bulkBusy ? 'Menerapkan…' : 'Terapkan'}
            </button>
          </div>
        </div>
      )}

      {error && <div className="err-banner">Error: {error}</div>}
      {loading ? <div className="loading">Memuat…</div>
        : filtered.length === 0 ? <div className="empty">
            {hist.length === 0 ? 'Belum ada HPP yang dihitung. Buka Kalkulator HPP untuk mulai.' : 'Tidak ada produk yang cocok dicari.'}
          </div>
        : (
          <div className="hist-wrap">
            <table className="hist-tbl">
              <thead>
                <tr>
                  {selectMode && <th></th>}
                  <th>Produk</th><th>Terakhir diperbarui</th><th>Varian</th><th>Modal</th><th>Total gram</th><th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(b => {
                  const rr = calcHpp(b, b.hpp_variants || [])
                  return (
                    <tr key={b.id} className={selectMode ? 'selectable-row' : ''}
                      onClick={selectMode ? () => toggleSelect(b.id) : undefined}>
                      {selectMode && (
                        <td onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={selected.includes(b.id)} onChange={() => toggleSelect(b.id)} />
                        </td>
                      )}
                      <td><b>{b.nama_produk}</b></td>
                      <td className="nowrap sm">{fdt(b.created_at)}</td>
                      <td><span className="badge-v">{(b.hpp_variants || []).length} var</span></td>
                      <td className="accent">{rp(rr.mo)}</td>
                      <td>{rr.tg > 0 ? gr(rr.tg) : '—'}</td>
                      <td className="nowrap">
                        {!selectMode && (
                          <>
                            <button className="link-btn" onClick={() => editBatch(b)}>Edit</button>
                            <button className="link-btn del" onClick={() => removeBatch(b)}>Hapus</button>
                          </>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
    </div>
  )
}
