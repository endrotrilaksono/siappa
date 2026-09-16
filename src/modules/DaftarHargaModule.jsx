import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { getHppBatches, deleteHppVariant, updateHppVariant } from '../lib/api'
import { supabase } from '../lib/supabase'
import { rp, pc, nv } from '../lib/hpp'
import { computeMarketplace, marginFromHargaJual } from '../lib/marketplace'

const JALUR = [
  { key: 'kongsiapa', label: 'Kongsiapa', marginField: 'margin_kongsiapa', realField: 'harga_real_kongsiapa' },
  { key: 'reseller', label: 'Reseller', marginField: 'margin_mis', realField: 'harga_real_mis' },
  { key: 'konsinyasi', label: 'Konsinyasi', marginField: 'margin_konsinyasi', realField: 'harga_real_konsinyasi' },
  { key: 'ec', label: 'End Customer', marginField: 'margin_ec', realField: 'harga_real' },
]

const MP_PLATFORMS = [
  { key: 'shopee', varField: 'mp_shopee', potonganField: 'mp_shopee_potongan', label: 'Shopee', cls: 'sp' },
  { key: 'tiktok', varField: 'mp_tiktok', potonganField: 'mp_tiktok_potongan', label: 'TikTok Shop', cls: 'tt' },
  { key: 'grabmart', varField: 'mp_grabmart', potonganField: 'mp_grabmart_potongan', label: 'GrabMart', cls: 'gm' },
]

function hppVarian(batch, variant) {
  const kg = nv(batch.total_kg), hi = nv(batch.harga_ikan), hb = nv(batch.biaya_bumbu)
  const mo = kg * (hi + hb)
  const tg = (batch.hpp_variants || []).reduce((s, v) => s + (nv(v.ukuran_target) + nv(v.kelebihan)) * nv(v.jumlah_pack), 0)
  const ef = nv(variant.ukuran_target) + nv(variant.kelebihan)
  const hI = tg > 0 ? (mo / tg) * ef : 0
  const hK = nv(variant.packaging) + nv(variant.label) + nv(variant.lainnya)
  return hI + hK
}

// ---------- Chip jalur offline (Kongsiapa/Reseller/Konsinyasi/EC) ----------
function JalurChip({ jalur, variant, hpp, onSaved }) {
  const [editing, setEditing] = useState(false)
  const [marginVal, setMarginVal] = useState('')
  const [hargaVal, setHargaVal] = useState('')
  const [busy, setBusy] = useState(false)

  const margin = nv(variant[jalur.marginField])
  const harga = nv(variant[jalur.realField])
  const marginReal = harga > 0 ? ((harga - hpp) / harga) * 100 : null
  const untung = harga > 0 ? harga - hpp : null

  function startEdit() {
    setMarginVal(String(margin || ''))
    setHargaVal(String(harga || ''))
    setEditing(true)
  }
  function onMarginChange(v) {
    setMarginVal(v)
    const m = parseFloat(v)
    if (!isNaN(m) && m < 100) setHargaVal(String(Math.round(hpp / (1 - m / 100))))
  }
  function onHargaChange(v) {
    setHargaVal(v)
    const h = parseFloat(v)
    if (!isNaN(h) && h > 0) setMarginVal((((h - hpp) / h) * 100).toFixed(1))
  }
  async function commit() {
    setBusy(true)
    try {
      await updateHppVariant(variant.id, {
        [jalur.marginField]: parseFloat(marginVal) || 0,
        [jalur.realField]: parseFloat(hargaVal) || 0,
      })
      setEditing(false)
      onSaved()
    } catch (e) { alert('Gagal menyimpan: ' + e.message) }
    finally { setBusy(false) }
  }

  if (editing) {
    return (
      <div className="jalur-chip editing" onClick={e => e.stopPropagation()}>
        <div className="chip-edit-label">{jalur.label}</div>
        <div className="chip-edit-row">
          <input type="number" value={marginVal} onChange={e => onMarginChange(e.target.value)}
            placeholder="%" autoFocus onKeyDown={e => e.key === 'Enter' && commit()} />
          <span className="chip-edit-sep">%</span>
        </div>
        <div className="chip-edit-row">
          <input type="number" value={hargaVal} onChange={e => onHargaChange(e.target.value)}
            placeholder="Rp" onKeyDown={e => e.key === 'Enter' && commit()} />
        </div>
        <div className="chip-edit-actions">
          <button className="chip-ok" onClick={commit} disabled={busy}>{busy ? '…' : '✓'}</button>
          <button className="chip-cancel" onClick={() => setEditing(false)}>✕</button>
        </div>
      </div>
    )
  }

  const warna = harga <= 0 ? 'n' : untung >= 0 ? 'g' : 'r'
  return (
    <div className={`jalur-chip ${warna}`} onDoubleClick={startEdit} title="Dobel klik untuk edit">
      <div className="chip-label">{jalur.label}</div>
      {harga > 0 ? (
        <>
          <div className="chip-harga">{rp(harga)}</div>
          <div className="chip-sub">{pc(marginReal)} · untung {rp(untung)}</div>
        </>
      ) : (
        <div className="chip-kosong">Belum diisi</div>
      )}
    </div>
  )
}

// ---------- Chip Marketplace (Shopee/TikTok/GrabMart) ----------
// Beda dari JalurChip: rumus margin<->harga butuh potongan dari level
// PRODUK (row.batch), bukan dari variant sendiri, karena potongan
// sekarang dishare semua varian dalam satu produk.
function MpChip({ platform, batch, variant, hpp, onSaved }) {
  const [editing, setEditing] = useState(false)
  const [marginVal, setMarginVal] = useState('')
  const [hargaVal, setHargaVal] = useState('')
  const [busy, setBusy] = useState(false)

  const potongan = batch[platform.potonganField] || []
  const mpData = variant[platform.varField] || {}
  const margin = nv(mpData.marginKotor)
  const harga = nv(mpData.hargaReal)
  const marginReal = harga > 0 ? ((harga - hpp) / harga) * 100 : null
  const untung = harga > 0 ? harga - hpp : null

  function startEdit() {
    setMarginVal(String(margin || ''))
    setHargaVal(String(harga || ''))
    setEditing(true)
  }
  function onMarginChange(v) {
    setMarginVal(v)
    const m = parseFloat(v)
    if (!isNaN(m)) {
      const r = computeMarketplace(hpp, potongan, m)
      if (r.hargaJual !== null) setHargaVal(String(Math.round(r.hargaJual)))
    }
  }
  function onHargaChange(v) {
    setHargaVal(v)
    const h = parseFloat(v)
    if (!isNaN(h) && h > 0) {
      const m = marginFromHargaJual(hpp, potongan, h)
      if (m !== null) setMarginVal(m.toFixed(1))
    }
  }
  async function commit() {
    setBusy(true)
    try {
      await updateHppVariant(variant.id, {
        [platform.varField]: {
          ...mpData,
          marginKotor: parseFloat(marginVal) || 0,
          hargaReal: parseFloat(hargaVal) || 0,
        },
      })
      setEditing(false)
      onSaved()
    } catch (e) { alert('Gagal menyimpan: ' + e.message) }
    finally { setBusy(false) }
  }

  if (editing) {
    return (
      <div className="jalur-chip editing" onClick={e => e.stopPropagation()}>
        <div className="chip-edit-label">{platform.label}</div>
        <div className="chip-edit-row">
          <input type="number" value={marginVal} onChange={e => onMarginChange(e.target.value)}
            placeholder="%" autoFocus onKeyDown={e => e.key === 'Enter' && commit()} />
          <span className="chip-edit-sep">%</span>
        </div>
        <div className="chip-edit-row">
          <input type="number" value={hargaVal} onChange={e => onHargaChange(e.target.value)}
            placeholder="Rp" onKeyDown={e => e.key === 'Enter' && commit()} />
        </div>
        <div className="chip-edit-actions">
          <button className="chip-ok" onClick={commit} disabled={busy}>{busy ? '…' : '✓'}</button>
          <button className="chip-cancel" onClick={() => setEditing(false)}>✕</button>
        </div>
      </div>
    )
  }

  const warna = harga <= 0 ? 'n' : untung >= 0 ? 'g' : 'r'
  return (
    <div className={`jalur-chip ${warna}`} onDoubleClick={startEdit} title="Dobel klik untuk edit">
      <div className="chip-label">{platform.label}</div>
      {harga > 0 ? (
        <>
          <div className="chip-harga">{rp(harga)}</div>
          <div className="chip-sub">{pc(marginReal)} · untung {rp(untung)}</div>
        </>
      ) : (
        <div className="chip-kosong">Belum diisi</div>
      )}
    </div>
  )
}

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

  const rows = useMemo(() => {
    const out = []
    for (const b of hist) {
      for (const v of (b.hpp_variants || [])) {
        out.push({ batch: b, variant: v, hpp: hppVarian(b, v) })
      }
    }
    out.sort((a, b) => {
      const n = (a.batch.nama_produk || '').localeCompare(b.batch.nama_produk || '')
      if (n !== 0) return n
      return nv(a.variant.ukuran_target) - nv(b.variant.ukuran_target)
    })
    return out
  }, [hist])

  const filtered = useMemo(() => {
    if (!q.trim()) return rows
    const qq = q.trim().toLowerCase()
    return rows.filter(r =>
      (r.batch.nama_produk || '').toLowerCase().includes(qq) ||
      (r.variant.nama_varian || '').toLowerCase().includes(qq)
    )
  }, [rows, q])

  function editBatch(batch) {
    navigate('/hpp', { state: { loadBatchId: batch.id } })
  }

  async function removeVariant(row) {
    const nama = row.variant.nama_varian || `${row.batch.nama_produk} ${row.variant.ukuran_target}g`
    if (!confirm(`Hapus "${nama}" dari Daftar Harga? Permanen.`)) return
    try { await deleteHppVariant(row.variant.id); load(); flash('Dihapus') }
    catch (e) { alert('Gagal menghapus: ' + e.message) }
  }

  function toggleSelect(id) {
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
  }
  function toggleSelectAll() {
    setSelected(s => s.length === filtered.length ? [] : filtered.map(r => r.variant.id))
  }
  function exitSelectMode() {
    setSelectMode(false); setSelected([]); setBulkValue('')
  }

  async function bulkDeleteSelected() {
    if (!selected.length) return
    if (!confirm(`Hapus ${selected.length} baris dari Daftar Harga? Permanen.`)) return
    try {
      const { error } = await supabase.from('hpp_variants').delete().in('id', selected)
      if (error) throw error
      exitSelectMode(); load(); flash('Terhapus')
    } catch (e) { alert('Gagal menghapus: ' + e.message) }
  }

  async function applyBulkMargin() {
    const val = parseFloat(bulkValue)
    if (isNaN(val) || val < 0 || val >= 100) { alert('Isi angka margin yang valid (0-99).'); return }
    if (!selected.length) return
    const jalurLabel = JALUR.find(j => j.marginField === bulkJalur)?.label
    if (!confirm(
      `Ubah margin ${jalurLabel} jadi ${val}% untuk ${selected.length} baris terpilih?\n\n` +
      `Ini CUMA mengubah target margin, TIDAK mengubah harga real yang sudah dicatat.`
    )) return
    setBulkBusy(true)
    try {
      const { error } = await supabase.from('hpp_variants').update({ [bulkJalur]: val }).in('id', selected)
      if (error) throw error
      exitSelectMode(); load()
      flash(`✓ Margin ${jalurLabel} ${selected.length} baris diperbarui`)
    } catch (e) { alert('Gagal update massal: ' + e.message) }
    finally { setBulkBusy(false) }
  }

  return (
    <div className="hpp">
      {toast && <div className="hpp-toast">{toast}</div>}

      <div className="card">
        <div className="card-head-h">Daftar Harga</div>
        <p className="muted sm" style={{ marginTop: 0 }}>
          Satu baris per varian. Dobel klik chip mana pun (termasuk Shopee/TikTok/GrabMart)
          untuk edit margin dan harga langsung.
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
          {rows.length > 0 && <button className="btn-ghost-dark" onClick={() => setSelectMode(true)}>☑ Pilih / Ubah massal</button>}
        </div>
      )}

      {selectMode && selected.length > 0 && (
        <div className="card bulk-margin-card">
          <div className="card-head-h">Ubah Margin Massal</div>
          <p className="muted sm" style={{ marginTop: 0 }}>
            Berlaku untuk {selected.length} baris terpilih. Cuma jalur Kongsiapa/Reseller/
            Konsinyasi/EC (bukan Shopee/TikTok/GrabMart, potongannya per produk bukan per
            baris). Harga real yang sudah dicatat TIDAK ikut berubah.
          </p>
          <div className="bulk-margin-row">
            <select value={bulkJalur} onChange={e => setBulkJalur(e.target.value)}>
              {JALUR.map(j => <option key={j.marginField} value={j.marginField}>{j.label}</option>)}
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
            {rows.length === 0 ? 'Belum ada HPP yang dihitung. Buka Kalkulator HPP untuk mulai.' : 'Tidak ada yang cocok dicari.'}
          </div>
        : filtered.map(row => {
            const rowKey = row.variant.id
            return (
              <div className="card harga-row2" key={rowKey}>
                <div className="harga-row2-top">
                  {selectMode && (
                    <input type="checkbox" checked={selected.includes(rowKey)} onChange={() => toggleSelect(rowKey)} />
                  )}
                  <div className="harga-row2-title">
                    <b>{row.variant.nama_varian || `${row.batch.nama_produk} ${row.variant.ukuran_target}g`}</b>
                    <span className="muted sm"> · HPP {rp(row.hpp)}</span>
                  </div>
                  {!selectMode && (
                    <div className="harga-row2-actions">
                      <button className="link-btn" onClick={() => editBatch(row.batch)}>Edit</button>
                      <button className="link-btn del" onClick={() => removeVariant(row)}>Hapus</button>
                    </div>
                  )}
                </div>
                <div className="jalur-chip-row">
                  {JALUR.map(j => (
                    <JalurChip key={j.key} jalur={j} variant={row.variant} hpp={row.hpp} onSaved={load} />
                  ))}
                  {MP_PLATFORMS.map(mp => (
                    <MpChip key={mp.key} platform={mp} batch={row.batch} variant={row.variant} hpp={row.hpp} onSaved={load} />
                  ))}
                </div>
              </div>
            )
          })}
    </div>
  )
}
