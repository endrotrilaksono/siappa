import { useState, useEffect, useCallback, useMemo } from 'react'
import { getHppBatches } from '../lib/api'
import { rp, nv } from '../lib/hpp'

const CHANNEL_LABELS = { ibusiapa: 'Ibu Siapa', kongsiapa: 'Kongsiapa', konsinyasi: 'Konsinyasi', reseller: 'Reseller' }

const DESTINATIONS = {
  ibusiapa: ['kongsiapa', 'konsinyasi', 'reseller'],
  kongsiapa: ['konsinyasi', 'reseller'],
}
const ORIGINS = ['ibusiapa', 'kongsiapa']

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
  if (channelKey === 'ibusiapa') return row.hpp > 0 ? row.hpp : null
  const field = channelKey === 'kongsiapa' ? 'harga_real_kongsiapa'
    : channelKey === 'konsinyasi' ? 'harga_real_konsinyasi'
    : 'harga_real_mis'
  const h = nv(row.variant[field])
  return h > 0 ? h : null
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
    const qtyValid = nv(r.qty) > 0
    return { ...r, row, hargaAsal, hargaTujuan, lengkap: hargaAsal !== null && hargaTujuan !== null && qtyValid }
  })

  const adaBarisTerisi = rows.some(r => r.variantId)
  const semuaLengkap = evaluated.length > 0 && adaBarisTerisi && evaluated.every(r => r.lengkap)

  // Hasil dihitung LANGSUNG (tidak perlu tombol), cuma tampil begitu
  // semua baris lengkap. Kalau ada yang belum, hasil disembunyikan,
  // bukan ditampilkan sebagai 0 yang menyesatkan.
  const hasil = useMemo(() => {
    if (!semuaLengkap) return null
    let penjualan = 0, modal = 0
    evaluated.forEach(r => {
      const q = nv(r.qty)
      penjualan += r.hargaTujuan * q
      modal += r.hargaAsal * q
    })
    return { penjualan, modal, untung: penjualan - modal }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [semuaLengkap, JSON.stringify(rows), asal, tujuan])

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
                    <input type="number" placeholder="0" value={r.qty}
                      onChange={e => setRow(i, { qty: e.target.value })} />
                    <div className="cp-harga">{r.hargaTujuan !== null ? rp(r.hargaTujuan) : '—'}</div>
                    <div className="cp-harga">{r.hargaTujuan !== null && nv(r.qty) > 0 ? rp(r.hargaTujuan * nv(r.qty)) : '—'}</div>
                    <button className="var-x" onClick={() => delRow(i)}>✕</button>
                  </div>
                  {r.variantId && !r.lengkap && (
                    <div className="cp-row-warn">
                      {r.hargaAsal === null && <>Harga di {CHANNEL_LABELS[asal]} belum diisi. </>}
                      {r.hargaTujuan === null && <>Harga di {CHANNEL_LABELS[tujuan]} belum diisi. </>}
                      {nv(r.qty) <= 0 && <>Isi kuantitas.</>}
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
        </div>
      )}
    </div>
  )
}
