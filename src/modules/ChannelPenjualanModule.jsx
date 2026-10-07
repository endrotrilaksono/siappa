import { useState, useEffect, useCallback, useMemo } from 'react'
import { getHppBatches, getChannelSimpanan, createChannelSimpanan } from '../lib/api'
import { CHANNEL_LABELS, DESTINATIONS, ORIGINS, channelTotals, snapshotChannel, isActiveSaved } from '../lib/channelPenjualan'
import { rp, nv } from '../lib/hpp'

function hppVarian(batch, variant) {
  const kg = nv(batch.total_kg), hi = nv(batch.harga_ikan), hb = nv(batch.biaya_bumbu)
  const mo = kg * (hi + hb)
  const tg = (batch.hpp_variants || []).reduce((s, v) => s + (nv(v.ukuran_target) + nv(v.kelebihan)) * nv(v.jumlah_pack), 0)
  const ef = nv(variant.ukuran_target) + nv(variant.kelebihan)
  const hI = tg > 0 ? (mo / tg) * ef : 0
  const hK = nv(variant.packaging) + nv(variant.label) + nv(variant.lainnya)
  return hI + hK
}

function hargaDiChannel(channelKey, row) {
  if (!row) return null
  if (channelKey === 'ibusiapa') return Number.isFinite(row.hpp) && row.hpp > 0 ? row.hpp : null
  const field = channelKey === 'kongsiapa' ? 'harga_real_kongsiapa'
    : channelKey === 'konsinyasi' ? 'harga_real_konsinyasi'
    : 'harga_real_mis'
  const h = nv(row.variant[field])
  return Number.isFinite(h) && h > 0 ? h : null
}

const emptyRow = () => ({ variantId: '', qty: '' })

// ---------- Pencarian varian, ketik untuk saring ----------
function VariantPicker({ value, variantList, onChange }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const selected = variantList.find(v => v.id === value)

  const filtered = useMemo(() => {
    const qq = query.trim().toLowerCase()
    const base = qq ? variantList.filter(v => v.label.toLowerCase().includes(qq)) : variantList
    return base.slice(0, 30)
  }, [query, variantList])

  return (
    <div className="cp-picker">
      <input
        type="text"
        placeholder="Cari varian…"
        value={open ? query : (selected ? selected.label : '')}
        onFocus={() => { setOpen(true); setQuery('') }}
        onChange={e => setQuery(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && (
        <div className="cp-picker-list">
          {filtered.length === 0 && <div className="cp-picker-empty">Tidak ketemu</div>}
          {filtered.map(v => (
            <div key={v.id} className="cp-picker-item"
              onMouseDown={() => { onChange(v.id); setOpen(false) }}>
              {v.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ChannelPenjualanModule() {
  const [hist, setHist] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [asal, setAsal] = useState('ibusiapa')
  const [tujuan, setTujuan] = useState('kongsiapa')
  const [rows, setRows] = useState([emptyRow()])
  const [nama, setNama] = useState('')
  const [simpanan, setSimpanan] = useState([])
  const [savedLoading, setSavedLoading] = useState(true)
  const [savedError, setSavedError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [notice, setNotice] = useState('')
  const [selectedSaved, setSelectedSaved] = useState(null)
  const [savedFingerprint, setSavedFingerprint] = useState('')
  const [now, setNow] = useState(Date.now())

  const loadSaved = useCallback(async () => {
    setSavedLoading(true); setSavedError(null)
    try { setSimpanan(await getChannelSimpanan()) }
    catch (e) { setSavedError(e.message) }
    finally { setSavedLoading(false) }
  }, [])
  useEffect(() => { loadSaved() }, [loadSaved])
  useEffect(() => {
    const tick = () => setNow(Date.now())
    const timer = window.setInterval(tick, 1000)
    window.addEventListener('focus', tick)
    return () => { window.clearInterval(timer); window.removeEventListener('focus', tick) }
  }, [])
  useEffect(() => {
    if (!selectedSaved) return
    const handleEscape = e => { if (e.key === 'Escape') setSelectedSaved(null) }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [selectedSaved])

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try { setHist(await getHppBatches()) }
    catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const variantList = useMemo(() => {
    const out = []
    for (const b of hist) {
      for (const v of (b.hpp_variants || [])) {
        out.push({
          id: v.id, batch: b, variant: v, hpp: hppVarian(b, v),
          label: v.nama_varian || `${b.nama_produk} ${v.ukuran_target}g`,
        })
      }
    }
    out.sort((a, b) => a.label.localeCompare(b.label))
    return out
  }, [hist])

  const variantMap = useMemo(() => {
    const m = new Map()
    variantList.forEach(r => m.set(r.id, r))
    return m
  }, [variantList])

  function changeAsal(v) {
    setAsal(v)
    if (!DESTINATIONS[v].includes(tujuan)) setTujuan(DESTINATIONS[v][0])
  }

  function setRow(i, patch) { setRows(rs => rs.map((r, idx) => idx === i ? { ...r, ...patch } : r)) }
  function addRow() { setRows(rs => [...rs, emptyRow()]) }
  function delRow(i) { setRows(rs => rs.length > 1 ? rs.filter((_, idx) => idx !== i) : rs) }

  const evaluated = rows.map(r => {
    const row = r.variantId ? variantMap.get(r.variantId) : null
    if (!row) return { ...r, row: null, hargaAsal: null, hargaTujuan: null, lengkap: false }
    const hargaAsal = hargaDiChannel(asal, row)
    const hargaTujuan = hargaDiChannel(tujuan, row)
    const qtyValid = Number.isFinite(Number(r.qty)) && Number(r.qty) > 0
    return { ...r, row, hargaAsal, hargaTujuan, lengkap: hargaAsal !== null && hargaTujuan !== null && qtyValid }
  })

  const adaBarisTerisi = rows.some(r => r.variantId)
  const semuaLengkap = !loading && !error && evaluated.length > 0 && adaBarisTerisi && evaluated.every(r => r.lengkap)

  // Hitungan dan export memakai angka yang sama, termasuk pecahan HPP.
  let hasil = null
  if (semuaLengkap) {
    try { hasil = channelTotals(evaluated) } catch { /* angka tidak valid: jangan simpan/export */ }
  }
  const fingerprint = JSON.stringify({ nama, asal, tujuan, items: evaluated.map(r => ({
    variantId: r.variantId, label: r.row?.label, qty: r.qty, hargaAsal: r.hargaAsal, hargaTujuan: r.hargaTujuan,
  })) })
  const alreadySaved = fingerprint === savedFingerprint
  const activeSaved = simpanan.filter(s => isActiveSaved(s, now))
  const viewingSaved = selectedSaved && isActiveSaved(selectedSaved, now) ? selectedSaved : null
  const savedTotals = viewingSaved ? channelTotals(viewingSaved.items) : null
  const formatDate = value => new Date(value).toLocaleString('id-ID')

  function currentSnapshot() {
    if (!hasil) throw new Error('Lengkapi semua baris sebelum menyimpan atau export.')
    return snapshotChannel(nama || `${CHANNEL_LABELS[asal]} ke ${CHANNEL_LABELS[tujuan]}`, asal, tujuan, evaluated)
  }

  async function save() {
    if (busy || alreadySaved || !hasil) return
    setBusy(true); setNotice(''); setSavedError(null)
    const savingFingerprint = fingerprint
    try {
      const saved = await createChannelSimpanan(currentSnapshot())
      setSimpanan(list => [saved, ...list])
      setSavedFingerprint(savingFingerprint)
      setNotice('Perhitungan tersimpan. Bisa dibuka dan diexport selama 90 hari.')
    } catch (e) { setSavedError(`Belum tersimpan: ${e.message}`) }
    finally { setBusy(false) }
  }

  async function exportExcel(saved = null) {
    if (exporting) return
    setExporting(true); setNotice('')
    try {
      if (saved && !isActiveSaved(saved)) throw new Error('Simpanan ini sudah melewati 90 hari.')
      const snapshot = saved || currentSnapshot()
      const { downloadChannelExcel } = await import('../lib/channelExcel')
      downloadChannelExcel(snapshot)
      setNotice('File Excel sudah diunduh.')
    } catch (e) { setNotice(`Export gagal: ${e.message}`) }
    finally { setExporting(false) }
  }

  return (
    <div className="hpp">
      <div className="card">
        <div className="card-head-h">Channel Penjualan</div>
        <p className="muted sm" style={{ marginTop: 0 }}>
          Hitung total keuntungan dari satu channel ke channel lain, buat beberapa produk sekaligus.
        </p>

        {/* Struktur Dari/Panah/Ke sengaja dibuat CERMIN satu sama lain
            (label kosong di atas panah, sejajar label Dari/Ke), supaya
            panahnya PASTI sejajar sama select-nya, bukan diatur pakai
            angka jarak yang gampang meleset. */}
        <div className="cp-channel-row">
          <div className="fld">
            <label>Dari</label>
            <select value={asal} onChange={e => changeAsal(e.target.value)}>
              {ORIGINS.map(o => <option key={o} value={o}>{CHANNEL_LABELS[o]}</option>)}
            </select>
          </div>
          <div className="cp-arrow-col">
            <label>&nbsp;</label>
            <div className="cp-arrow">→</div>
          </div>
          <div className="fld">
            <label>Ke</label>
            <select value={tujuan} onChange={e => setTujuan(e.target.value)}>
              {DESTINATIONS[asal].map(t => <option key={t} value={t}>{CHANNEL_LABELS[t]}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head-h">Produk</div>
        {error && <div className="err-banner">Error: {error}</div>}
        {loading ? <div className="loading">Memuat…</div> : (
          <>
            <div className="cp-head-row">
              <span>Varian</span><span>Qty</span><span>Harga satuan</span><span>Harga total</span><span></span>
            </div>
            <div className="cp-rows">
              {evaluated.map((r, i) => (
                <div className="cp-row-wrap" key={i}>
                  <div className={`cp-row ${r.variantId && !r.lengkap ? 'warn' : ''}`}>
                    <VariantPicker value={r.variantId} variantList={variantList}
                      onChange={id => setRow(i, { variantId: id })} />
                    <input type="number" min="0" step="any" aria-label={`Kuantitas produk ${i + 1}`} placeholder="0" value={r.qty}
                      onChange={e => setRow(i, { qty: e.target.value })} />
                    <div className="cp-harga">{r.hargaTujuan !== null ? rp(r.hargaTujuan) : '—'}</div>
                    <div className="cp-harga">{r.hargaTujuan !== null && nv(r.qty) > 0 ? rp(r.hargaTujuan * nv(r.qty)) : '—'}</div>
                    <button className="var-x" onClick={() => delRow(i)}>✕</button>
                  </div>
                  {r.variantId && !r.lengkap && (
                    <div className="cp-row-warn">
                      {r.hargaAsal === null && <>Harga di {CHANNEL_LABELS[asal]} belum diisi. </>}
                      {r.hargaTujuan === null && <>Harga di {CHANNEL_LABELS[tujuan]} belum diisi. </>}
                      {(!Number.isFinite(Number(r.qty)) || Number(r.qty) <= 0) && <>Isi kuantitas yang lebih dari 0.</>}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button className="btn-ghost-dark" onClick={addRow}>+ Tambah Produk</button>
          </>
        )}
      </div>

      {!semuaLengkap && adaBarisTerisi && (
        <div className="mp-error cp-blocker">
          Ada produk yang harganya belum lengkap di salah satu channel, atau kuantitasnya belum diisi.
          Total baru muncul kalau semua baris sudah lengkap.
        </div>
      )}

      {semuaLengkap && !hasil && <div className="err-banner">Angka terlalu besar. Kurangi kuantitas atau harga.</div>}
      {hasil && (
        <div className="card cp-hasil">
          <div className="cp-hasil-row">
            <span>Total Penjualan Bersih</span>
            <b>{rp(hasil.penjualan)}</b>
          </div>
          <div className="cp-hasil-row">
            <span>Harga Modal</span>
            <b>{rp(hasil.modal)}</b>
          </div>
          <div className="cp-hasil-row cp-hasil-total">
            <span>Total Keuntungan</span>
            <b className={hasil.untung >= 0 ? 'g' : 'r'}>{rp(hasil.untung)}</b>
          </div>
          <div className="fld cp-save-name">
            <label htmlFor="cp-save-name">Nama perhitungan (opsional)</label>
            <input id="cp-save-name" maxLength={100} placeholder="Mis. Pesanan Kongsiapa Kertosono" value={nama} onChange={e => setNama(e.target.value)} />
          </div>
          <div className="cp-save-actions">
            <button className="btn-primary" disabled={busy || alreadySaved} onClick={save}>{busy ? 'Menyimpan…' : alreadySaved ? 'Tersimpan' : 'Simpan'}</button>
            <button className="btn-ghost-dark" disabled={exporting} onClick={() => exportExcel()}>{exporting ? 'Menyiapkan Excel…' : 'Export Excel'}</button>
          </div>
          <p className="muted sm">Simpanan otomatis dihapus setelah 90 hari. File Excel yang sudah diunduh tetap ada di perangkatmu.</p>
        </div>
      )}
      {notice && <p role="status" className="cp-notice">{notice}</p>}
      <div className="card cp-saved">
        <div className="cp-saved-heading">
          <div className="card-head-h">Perhitungan Tersimpan</div>
          <button className="btn-ghost-dark" onClick={loadSaved} disabled={savedLoading}>Muat ulang</button>
        </div>
        <p className="muted sm">Tersimpan selama 90 hari sejak dibuat. Nama, harga, kuantitas, dan hasil mengikuti saat disimpan.</p>
        {savedError && <div role="alert" className="err-banner">{savedError}</div>}
        {savedLoading ? <div className="loading">Memuat simpanan…</div> : activeSaved.length === 0 ? <p className="muted">Belum ada perhitungan tersimpan.</p> : (
          <div className="cp-saved-list">
            {activeSaved.map(s => (
              <div className="cp-saved-item" key={s.id}>
                <div><b>{s.nama}</b><div className="muted sm">{CHANNEL_LABELS[s.asal]} → {CHANNEL_LABELS[s.tujuan]} · {s.items.length} produk</div>
                  <div className="muted sm">Disimpan {formatDate(s.created_at)} · Berlaku sampai {formatDate(s.expires_at)}</div></div>
                <div className="cp-save-actions">
                  <button className="btn-ghost-dark" onClick={() => setSelectedSaved(s)}>Lihat</button>
                  <button className="btn-ghost-dark" disabled={exporting} onClick={() => exportExcel(s)}>Export Excel</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {selectedSaved && (
        <div className="modal-backdrop" onClick={() => setSelectedSaved(null)}>
          <div className="modal cp-saved-modal" role="dialog" aria-modal="true" aria-labelledby="cp-saved-title" onClick={e => e.stopPropagation()}>
            <div className="modal-head"><h2 id="cp-saved-title">{selectedSaved.nama}</h2><button className="x" autoFocus aria-label="Tutup simpanan" onClick={() => setSelectedSaved(null)}>✕</button></div>
            <div className="modal-body">
              {!viewingSaved ? <p>Simpanan sudah melewati masa penyimpanan 90 hari.</p> : <>
                <p>{CHANNEL_LABELS[viewingSaved.asal]} → {CHANNEL_LABELS[viewingSaved.tujuan]}</p>
                <p className="muted sm">Disimpan {formatDate(viewingSaved.created_at)} · Berlaku sampai {formatDate(viewingSaved.expires_at)}</p>
                <div className="cp-saved-table-wrap"><table className="cp-saved-table"><thead><tr><th>Varian</th><th>Qty</th><th>Harga modal satuan</th><th>Harga satuan tujuan</th><th>Harga total</th></tr></thead><tbody>
                  {viewingSaved.items.map((item, i) => <tr key={i}><td>{item.namaVarian}</td><td>{item.qty}</td><td>{rp(item.hargaAsal)}</td><td>{rp(item.hargaTujuan)}</td><td>{rp(item.hargaTujuan * item.qty)}</td></tr>)}
                </tbody></table></div>
                <div className="cp-hasil">
                  <div className="cp-hasil-row"><span>Total Penjualan Bersih</span><b>{rp(savedTotals.penjualan)}</b></div>
                  <div className="cp-hasil-row"><span>Harga Modal</span><b>{rp(savedTotals.modal)}</b></div>
                  <div className="cp-hasil-row cp-hasil-total"><span>Total Keuntungan</span><b className={savedTotals.untung >= 0 ? 'g' : 'r'}>{rp(savedTotals.untung)}</b></div>
                </div>
              </>}
            </div>
            <div className="modal-foot"><button className="btn-ghost-dark" onClick={() => setSelectedSaved(null)}>Tutup</button><button className="btn-primary" disabled={!viewingSaved || exporting} onClick={() => exportExcel(viewingSaved)}>Export Excel</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
