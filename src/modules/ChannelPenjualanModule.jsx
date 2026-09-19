import { useState, useEffect, useCallback, useMemo } from 'react'
import { getHppBatches } from '../lib/api'
import { rp, nv } from '../lib/hpp'

const CHANNEL_LABELS = { ibusiapa: 'Ibu Siapa', kongsiapa: 'Kongsiapa', konsinyasi: 'Konsinyasi', reseller: 'Reseller' }

// asal -> daftar tujuan yang valid. Kongsiapa tidak boleh jadi tujuan
// dari dirinya sendiri, dan Ibu Siapa (HPP) tidak pernah jadi tujuan.
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

// ambil harga varian di channel tertentu. null = belum diisi/tidak ada.
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

export default function ChannelPenjualanModule() {
  const [hist, setHist] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [asal, setAsal] = useState('ibusiapa')
  const [tujuan, setTujuan] = useState('kongsiapa')
  const [rows, setRows] = useState([emptyRow()])
  const [hasil, setHasil] = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try { setHist(await getHppBatches()) }
    catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  // daftar varian datar, sama pola seperti Daftar Harga
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

  // begitu asal berganti, pastikan tujuan tetap salah satu opsi yang valid
  function changeAsal(v) {
    setAsal(v)
    setHasil(null)
    if (!DESTINATIONS[v].includes(tujuan)) setTujuan(DESTINATIONS[v][0])
  }
  function changeTujuan(v) { setTujuan(v); setHasil(null) }

  function setRow(i, patch) {
    setRows(rs => rs.map((r, idx) => idx === i ? { ...r, ...patch } : r))
    setHasil(null)
  }
  function addRow() { setRows(rs => [...rs, emptyRow()]); setHasil(null) }
  function delRow(i) { setRows(rs => rs.length > 1 ? rs.filter((_, idx) => idx !== i) : rs); setHasil(null) }

  // evaluasi tiap baris: harga asal, harga tujuan, dan apakah lengkap
  const evaluated = rows.map(r => {
    const row = r.variantId ? variantMap.get(r.variantId) : null
    if (!row) return { ...r, row: null, hargaAsal: null, hargaTujuan: null, lengkap: false }
    const hargaAsal = hargaDiChannel(asal, row)
    const hargaTujuan = hargaDiChannel(tujuan, row)
    const qtyValid = nv(r.qty) > 0
    return {
      ...r, row, hargaAsal, hargaTujuan,
      lengkap: hargaAsal !== null && hargaTujuan !== null && qtyValid,
    }
  })

  const adaBarisKosong = rows.some(r => !r.variantId)
  const semuaLengkap = evaluated.length > 0 && !adaBarisKosong && evaluated.every(r => r.lengkap)

  function hitungTotal() {
    if (!semuaLengkap) return
    let penjualan = 0, modal = 0
    evaluated.forEach(r => {
      const q = nv(r.qty)
      penjualan += r.hargaTujuan * q
      modal += r.hargaAsal * q
    })
    setHasil({ penjualan, modal, untung: penjualan - modal })
  }

  return (
    <div className="hpp">
      <div className="card">
        <div className="card-head-h">Channel Penjualan</div>
        <p className="muted sm" style={{ marginTop: 0 }}>
          Hitung total keuntungan dari satu channel ke channel lain, buat beberapa produk sekaligus.
        </p>

        <div className="cp-channel-row">
          <div className="fld">
            <label>Dari</label>
            <select value={asal} onChange={e => changeAsal(e.target.value)}>
              {ORIGINS.map(o => <option key={o} value={o}>{CHANNEL_LABELS[o]}</option>)}
            </select>
          </div>
          <div className="cp-arrow">→</div>
          <div className="fld">
            <label>Ke</label>
            <select value={tujuan} onChange={e => changeTujuan(e.target.value)}>
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
            <div className="cp-rows">
              {evaluated.map((r, i) => (
                <div className={`cp-row ${r.variantId && !r.lengkap ? 'warn' : ''}`} key={i}>
                  <select value={r.variantId} onChange={e => setRow(i, { variantId: e.target.value })}>
                    <option value="">— pilih varian —</option>
                    {variantList.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
                  </select>
                  <input type="number" placeholder="Qty" value={r.qty}
                    onChange={e => setRow(i, { qty: e.target.value })} />
                  <button className="var-x" onClick={() => delRow(i)}>✕</button>
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

      {!semuaLengkap && rows.some(r => r.variantId) && (
        <div className="mp-error cp-blocker">
          Ada produk yang harganya belum lengkap di salah satu channel, atau kuantitasnya belum diisi.
          Lengkapi dulu semua baris sebelum bisa menghitung total.
        </div>
      )}

      <div className="hpp-actions">
        <button className="btn-primary" onClick={hitungTotal} disabled={!semuaLengkap}>
          Hitung Total
        </button>
      </div>

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
