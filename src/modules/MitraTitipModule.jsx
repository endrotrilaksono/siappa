import { useState, useEffect, useCallback, useMemo } from 'react'
import { getHppBatches, getMitra, createMitra, deleteMitra, getMitraRiwayat, createMitraRiwayat } from '../lib/api'
import { rp, nv } from '../lib/hpp'

const TIPE_LABEL = { konsinyasi: 'Konsinyasi', end_user: 'End User' }

function hppVarian(batch, variant) {
  const kg = nv(batch.total_kg), hi = nv(batch.harga_ikan), hb = nv(batch.biaya_bumbu)
  const mo = kg * (hi + hb)
  const tg = (batch.hpp_variants || []).reduce((s, v) => s + (nv(v.ukuran_target) + nv(v.kelebihan)) * nv(v.jumlah_pack), 0)
  const ef = nv(variant.ukuran_target) + nv(variant.kelebihan)
  const hI = tg > 0 ? (mo / tg) * ef : 0
  const hK = nv(variant.packaging) + nv(variant.label) + nv(variant.lainnya)
  return hI + hK
}

// harga real varian sesuai tipe mitra, dari Daftar Harga saat ini
// (LIVE, bukan beku — dipakai buat ringkasan nilai stok sekarang)
function hargaTipeMitra(tipeHarga, variant) {
  const field = tipeHarga === 'konsinyasi' ? 'harga_real_konsinyasi' : 'harga_real'
  const h = nv(variant[field])
  return h > 0 ? h : null
}

const fdt = ts => new Date(ts).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

// ---------- Pencarian varian (sama pola seperti Channel Penjualan) ----------
function VariantPicker({ value, options, onChange, placeholder }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const selected = options.find(v => v.id === value)

  const filtered = useMemo(() => {
    const qq = query.trim().toLowerCase()
    const base = qq ? options.filter(v => v.label.toLowerCase().includes(qq)) : options
    return base.slice(0, 30)
  }, [query, options])

  return (
    <div className="cp-picker">
      <input
        type="text"
        placeholder={placeholder || 'Cari varian…'}
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

// ---------- Form Titip Produk Baru ----------
function FormTitipBaru({ mitra, variantOptions, onDone }) {
  const [variantId, setVariantId] = useState('')
  const [jumlah, setJumlah] = useState('')
  const [hargaManual, setHargaManual] = useState('')
  const [busy, setBusy] = useState(false)

  const selected = variantOptions.find(v => v.id === variantId)
  const hargaOtomatis = selected ? hargaTipeMitra(mitra.tipe_harga, selected.variant) : null
  const butuhManual = selected && hargaOtomatis === null

  async function submit() {
    if (!selected || nv(jumlah) <= 0) return
    const harga = butuhManual ? nv(hargaManual) : hargaOtomatis
    if (!harga || harga <= 0) return
    setBusy(true)
    try {
      await createMitraRiwayat({
        mitra_id: mitra.id,
        variant_id: selected.id,
        nama_varian_snapshot: selected.label,
        tipe: 'titip_baru',
        stok_sebelum: 0,
        laku: 0,
        tagihan: 0,
        restok: nv(jumlah),
        stok_sesudah: nv(jumlah),
        harga_dipakai: harga,
        harga_manual: butuhManual,
      })
      onDone()
    } catch (e) { alert('Gagal menyimpan: ' + e.message) }
    finally { setBusy(false) }
  }

  return (
    <div className="mitra-form">
      <div className="fld-sm">
        <label>Varian</label>
        <VariantPicker value={variantId} options={variantOptions} onChange={setVariantId}
          placeholder="Cari produk yang mau dititip…" />
      </div>
      <div className="fld-sm">
        <label>Jumlah titip</label>
        <input type="number" placeholder="0" value={jumlah} onChange={e => setJumlah(e.target.value)} />
      </div>
      {selected && !butuhManual && (
        <div className="target-preview">Harga {TIPE_LABEL[mitra.tipe_harga]}: <b>{rp(hargaOtomatis)}</b></div>
      )}
      {butuhManual && (
        <div className="mitra-warn">
          Harga {TIPE_LABEL[mitra.tipe_harga]} untuk varian ini belum diisi di Daftar Harga.
          Isi manual sekali pakai (TIDAK tersimpan ke Daftar Harga):
          <input type="number" placeholder="Harga manual" value={hargaManual}
            onChange={e => setHargaManual(e.target.value)} style={{ marginTop: 6 }} />
        </div>
      )}
      <button className="btn-primary" onClick={submit}
        disabled={busy || !selected || nv(jumlah) <= 0 || (butuhManual && nv(hargaManual) <= 0)}>
        {busy ? 'Menyimpan…' : 'Simpan Titip Baru'}
      </button>
    </div>
  )
}

// ---------- Form Update Stok ----------
function FormUpdateStok({ mitra, entrusted, onDone }) {
  const [variantId, setVariantId] = useState('')
  const [sisa, setSisa] = useState('')
  const [restok, setRestok] = useState('0')
  const [hargaManual, setHargaManual] = useState('')
  const [busy, setBusy] = useState(false)

  const options = entrusted.map(e => ({ id: e.variantId, label: e.label }))
  const selected = entrusted.find(e => e.variantId === variantId)
  const hargaOtomatis = selected ? hargaTipeMitra(mitra.tipe_harga, selected.variant) : null
  const butuhManual = selected && hargaOtomatis === null

  const laku = selected ? nv(selected.stokSekarang) - nv(sisa) : null
  const stokSesudah = selected ? nv(sisa) + nv(restok) : null

  async function submit() {
    if (!selected || sisa === '') return
    const harga = butuhManual ? nv(hargaManual) : hargaOtomatis
    if (!harga || harga <= 0) return
    setBusy(true)
    try {
      await createMitraRiwayat({
        mitra_id: mitra.id,
        variant_id: selected.variantId,
        nama_varian_snapshot: selected.label,
        tipe: 'update',
        stok_sebelum: selected.stokSekarang,
        laku,
        tagihan: laku * harga,
        restok: nv(restok),
        stok_sesudah: stokSesudah,
        harga_dipakai: harga,
        harga_manual: butuhManual,
      })
      onDone()
    } catch (e) { alert('Gagal menyimpan: ' + e.message) }
    finally { setBusy(false) }
  }

  return (
    <div className="mitra-form">
      <div className="fld-sm">
        <label>Varian (yang sudah dititip)</label>
        <VariantPicker value={variantId} options={options} onChange={setVariantId}
          placeholder="Pilih produk yang mau dicek…" />
      </div>
      {selected && (
        <div className="target-preview">Stok sebelum: <b>{selected.stokSekarang}</b></div>
      )}
      <div className="fld-sm">
        <label>Stok sisa sekarang</label>
        <input type="number" placeholder="0" value={sisa} onChange={e => setSisa(e.target.value)} />
      </div>
      <div className="fld-sm">
        <label>Restok (kalau ada)</label>
        <input type="number" placeholder="0" value={restok} onChange={e => setRestok(e.target.value)} />
      </div>
      {selected && sisa !== '' && (
        <div className={`untung-preview ${laku >= 0 ? 'g' : 'r'}`}>
          Laku: {laku} · Stok sesudah: {stokSesudah}
          {laku < 0 && ' (sisa lebih besar dari stok sebelumnya, cek ulang hitungannya)'}
        </div>
      )}
      {selected && !butuhManual && hargaOtomatis !== null && (
        <div className="target-preview">Harga {TIPE_LABEL[mitra.tipe_harga]}: <b>{rp(hargaOtomatis)}</b></div>
      )}
      {butuhManual && (
        <div className="mitra-warn">
          Harga {TIPE_LABEL[mitra.tipe_harga]} untuk varian ini belum diisi di Daftar Harga.
          Isi manual sekali pakai (TIDAK tersimpan ke Daftar Harga):
          <input type="number" placeholder="Harga manual" value={hargaManual}
            onChange={e => setHargaManual(e.target.value)} style={{ marginTop: 6 }} />
        </div>
      )}
      <button className="btn-primary" onClick={submit}
        disabled={busy || !selected || sisa === '' || (butuhManual && nv(hargaManual) <= 0)}>
        {busy ? 'Menyimpan…' : 'Simpan Update Stok'}
      </button>
    </div>
  )
}

// ---------- Detail satu mitra ----------
function MitraDetail({ mitra, hist, variantMap, onBack }) {
  const [riwayat, setRiwayat] = useState([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(null) // null | 'titip' | 'update'

  const load = useCallback(async () => {
    setLoading(true)
    try { setRiwayat(await getMitraRiwayat(mitra.id)) }
    catch (e) { alert('Gagal memuat riwayat: ' + e.message) }
    finally { setLoading(false) }
  }, [mitra.id])
  useEffect(() => { load() }, [load])

  // ringkasan: variant unik dari riwayat, stok sekarang = stok_sesudah
  // baris TERAKHIR (paling baru) untuk pasangan mitra+varian itu
  const ringkasan = useMemo(() => {
    const map = new Map()
    // riwayat sudah urut terbaru dulu, jadi entri PERTAMA yang ketemu
    // per variant_id itu yang terbaru
    for (const r of riwayat) {
      if (!r.variant_id) continue
      if (!map.has(r.variant_id)) {
        map.set(r.variant_id, {
          variantId: r.variant_id,
          label: r.nama_varian_snapshot,
          stokSekarang: nv(r.stok_sesudah),
          variant: variantMap.get(r.variant_id)?.variant || {},
        })
      }
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label))
  }, [riwayat, variantMap])

  const entrustedIds = new Set(ringkasan.map(r => r.variantId))
  const variantOptionsBaru = useMemo(() =>
    [...variantMap.values()].filter(v => !entrustedIds.has(v.id)),
  [variantMap, entrustedIds])

  function afterSave() {
    setFormOpen(null)
    load()
  }

  return (
    <div className="hpp">
      <button className="link-btn" onClick={onBack}>← Semua Mitra</button>

      <div className="card">
        <div className="card-head-h">
          {mitra.nama} <span className={`mitra-badge ${mitra.tipe_harga}`}>{TIPE_LABEL[mitra.tipe_harga]}</span>
        </div>

        <div className="mitra-actions">
          <button className="btn-ghost-dark" onClick={() => setFormOpen(formOpen === 'titip' ? null : 'titip')}>
            + Titip Produk Baru
          </button>
          <button className="btn-ghost-dark" onClick={() => setFormOpen(formOpen === 'update' ? null : 'update')}>
            ↻ Update Stok
          </button>
        </div>

        {formOpen === 'titip' && (
          <FormTitipBaru mitra={mitra} variantOptions={variantOptionsBaru} onDone={afterSave} />
        )}
        {formOpen === 'update' && (
          ringkasan.length === 0
            ? <p className="muted sm">Belum ada produk yang dititip ke mitra ini.</p>
            : <FormUpdateStok mitra={mitra} entrusted={ringkasan} onDone={afterSave} />
        )}
      </div>

      <div className="card">
        <div className="card-head-h">Stok Saat Ini</div>
        {ringkasan.length === 0 ? <div className="empty">Belum ada produk dititip.</div> : (
          <div className="hist-wrap">
            <table className="hist-tbl">
              <thead><tr><th>Produk</th><th>Stok</th><th>Nilai ({TIPE_LABEL[mitra.tipe_harga]})</th></tr></thead>
              <tbody>
                {ringkasan.map(r => {
                  const harga = hargaTipeMitra(mitra.tipe_harga, r.variant)
                  return (
                    <tr key={r.variantId}>
                      <td><b>{r.label}</b></td>
                      <td>{r.stokSekarang}</td>
                      <td className="accent">{harga !== null ? rp(harga * r.stokSekarang) : 'harga belum ada'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-head-h">Riwayat</div>
        {loading ? <div className="loading">Memuat…</div>
          : riwayat.length === 0 ? <div className="empty">Belum ada riwayat.</div> : (
            <div className="hist-wrap">
              <table className="hist-tbl">
                <thead>
                  <tr><th>Tanggal</th><th>Produk</th><th>Jenis</th><th>Sebelum</th><th>Laku</th><th>Tagihan</th><th>Restok</th><th>Sesudah</th></tr>
                </thead>
                <tbody>
                  {riwayat.map(r => (
                    <tr key={r.id}>
                      <td className="nowrap sm">{fdt(r.tanggal)}</td>
                      <td>{r.nama_varian_snapshot}</td>
                      <td>{r.tipe === 'titip_baru' ? 'Titip baru' : 'Update'}</td>
                      <td>{r.stok_sebelum}</td>
                      <td>{r.laku}</td>
                      <td className="accent">{rp(r.tagihan)}{r.harga_manual && <span className="mitra-manual-tag"> manual</span>}</td>
                      <td>{r.restok}</td>
                      <td><b>{r.stok_sesudah}</b></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>
    </div>
  )
}

// ---------- Modul utama ----------
export default function MitraTitipModule() {
  const [mitraList, setMitraList] = useState([])
  const [hist, setHist] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [namaBaru, setNamaBaru] = useState('')
  const [tipeBaru, setTipeBaru] = useState('konsinyasi')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [m, h] = await Promise.all([getMitra(), getHppBatches()])
      setMitraList(m); setHist(h)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const variantMap = useMemo(() => {
    const m = new Map()
    for (const b of hist) {
      for (const v of (b.hpp_variants || [])) {
        m.set(v.id, {
          id: v.id, batch: b, variant: v, hpp: hppVarian(b, v),
          label: v.nama_varian || `${b.nama_produk} ${v.ukuran_target}g`,
        })
      }
    }
    return m
  }, [hist])

  async function tambahMitra() {
    if (!namaBaru.trim()) return
    setSaving(true)
    try {
      await createMitra({ nama: namaBaru.trim(), tipe_harga: tipeBaru })
      setNamaBaru(''); setShowAdd(false)
      load()
    } catch (e) { alert('Gagal menambah mitra: ' + e.message) }
    finally { setSaving(false) }
  }

  async function hapusMitra(m) {
    if (!confirm(`Hapus mitra "${m.nama}"? Seluruh riwayat titipnya ikut terhapus permanen.`)) return
    try { await deleteMitra(m.id); load() }
    catch (e) { alert('Gagal menghapus: ' + e.message) }
  }

  const selected = mitraList.find(m => m.id === selectedId)
  if (selected) {
    return <MitraDetail mitra={selected} hist={hist} variantMap={variantMap} onBack={() => setSelectedId(null)} />
  }

  return (
    <div className="hpp">
      <div className="card">
        <div className="card-head-h">Mitra Titip</div>
        <p className="muted sm" style={{ marginTop: 0 }}>
          Pantau stok dan tagihan Mitra Titip Freezer / Mitra Titip Barang.
        </p>
        <button className="btn-ghost-dark" onClick={() => setShowAdd(s => !s)}>+ Tambah Mitra</button>
        {showAdd && (
          <div className="mitra-form">
            <div className="fld-sm">
              <label>Nama mitra</label>
              <input type="text" placeholder="mis: Toko Bu Siti" value={namaBaru}
                onChange={e => setNamaBaru(e.target.value)} />
            </div>
            <div className="fld-sm">
              <label>Tipe harga</label>
              <select value={tipeBaru} onChange={e => setTipeBaru(e.target.value)}>
                <option value="konsinyasi">Konsinyasi</option>
                <option value="end_user">End User</option>
              </select>
            </div>
            <button className="btn-primary" onClick={tambahMitra} disabled={saving || !namaBaru.trim()}>
              {saving ? 'Menyimpan…' : 'Simpan Mitra'}
            </button>
          </div>
        )}
      </div>

      {error && <div className="err-banner">Error: {error}</div>}
      {loading ? <div className="loading">Memuat…</div>
        : mitraList.length === 0 ? <div className="empty">Belum ada mitra. Tambahkan lewat tombol di atas.</div>
          : mitraList.map(m => (
              <div className="card mitra-row" key={m.id} onClick={() => setSelectedId(m.id)}>
                <div>
                  <b>{m.nama}</b>
                  <span className={`mitra-badge ${m.tipe_harga}`}>{TIPE_LABEL[m.tipe_harga]}</span>
                </div>
                <button className="link-btn del" onClick={e => { e.stopPropagation(); hapusMitra(m) }}>Hapus</button>
              </div>
            ))}
    </div>
  )
}
