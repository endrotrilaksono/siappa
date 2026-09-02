import { useState, useEffect, useCallback, useMemo, Fragment } from 'react'
import { getHppBatches, createHppBatch, deleteHppBatch, importHppLegacy, getHppComponents } from '../lib/api'
import { calcHpp, rp, gr, pc, nv, yieldClass, marginClass } from '../lib/hpp'

const emptyVar = () => ({
  ukuran_target: '', jumlah_pack: '', kelebihan: '',
  packaging: '', label: '', lainnya: '',
  margin_kongsiapa: '20', harga_real_kongsiapa: '',
  margin_mis: '15', harga_real_mis: '',
  margin_ec: '25', harga_real: '',
})

// Urutan hirarki tetap: Kongsiapa -> Reseller -> End Customer
const JALUR = [
  { key: 'kongsiapa', label: 'Kongsiapa', sub: '(mudharabah)', marginField: 'margin_kongsiapa', realField: 'harga_real_kongsiapa', cls: 'k' },
  { key: 'reseller', label: 'Reseller', sub: '', marginField: 'margin_mis', realField: 'harga_real_mis', cls: '' },
  { key: 'ec', label: 'End Customer', sub: '', marginField: 'margin_ec', realField: 'harga_real', cls: 'g' },
]

const fdt = ts => {
  const d = new Date(ts)
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: '2-digit' }) +
    ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}
const fdtShort = ts => new Date(ts).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })

function ComponentPicker({ components, onPick }) {
  if (!components.length) return null
  return (
    <select className="comp-pick" defaultValue=""
      onChange={e => {
        const comp = components.find(c => c.id === e.target.value)
        if (comp) onPick(comp.harga_per_pcs)
        e.target.value = ''
      }}>
      <option value="">+ pilih dari komponen</option>
      {components.map(c => (
        <option key={c.id} value={c.id}>{c.nama} — {rp(c.harga_per_pcs)}</option>
      ))}
    </select>
  )
}

// Cari harga real terakhir untuk kombinasi nama produk + ukuran target,
// dari riwayat batch yang sudah ada (client-side, tidak query baru ke
// server). Dicari per jalur (kongsiapa/reseller/ec) secara terpisah,
// karena bisa saja salah satu jalur pernah diisi tapi jalur lain belum.
function findHargaTerakhir(hist, namaProduk, ukuranTarget, realField) {
  if (!namaProduk || !ukuranTarget) return null
  const namaN = namaProduk.trim().toLowerCase()
  const ukN = nv(ukuranTarget)
  let best = null
  for (const b of hist) {
    if ((b.nama_produk || '').trim().toLowerCase() !== namaN) continue
    for (const v of (b.hpp_variants || [])) {
      if (nv(v.ukuran_target) !== ukN) continue
      const harga = nv(v[realField])
      if (harga <= 0) continue
      if (!best || new Date(b.created_at) > new Date(best.created_at)) {
        best = { harga, created_at: b.created_at }
      }
    }
  }
  return best
}

export default function HppModule() {
  const [base, setBase] = useState({ nama_produk: '', total_kg: '', harga_ikan: '', biaya_bumbu: '0' })
  const [vars, setVars] = useState([emptyVar(), emptyVar()])
  const [hist, setHist] = useState([])
  const [components, setComponents] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [legacyText, setLegacyText] = useState('')

  const R = calcHpp(base, vars)

  const flash = msg => { setToast(msg); setTimeout(() => setToast(''), 2600) }

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [batches, comps] = await Promise.all([getHppBatches(), getHppComponents().catch(() => [])])
      setHist(batches); setComponents(comps)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  // daftar nama produk unik dari riwayat, buat dropdown/datalist
  const namaProdukList = useMemo(() => {
    const set = new Set()
    hist.forEach(b => { if (b.nama_produk) set.add(b.nama_produk) })
    return [...set].sort()
  }, [hist])

  const setB = (k, v) => setBase(b => ({ ...b, [k]: v }))
  const setV = (i, k, v) => setVars(vs => vs.map((x, idx) => idx === i ? { ...x, [k]: v } : x))
  const addVar = () => setVars(vs => [...vs, emptyVar()])
  const delVar = i => setVars(vs => vs.length > 1 ? vs.filter((_, idx) => idx !== i) : vs)

  async function save() {
    if (!R.mo || !R.tg) { flash('Isi dulu bahan baku dan minimal satu varian.'); return }
    setSaving(true)
    try {
      await createHppBatch({
        nama_produk: base.nama_produk || 'Tanpa nama',
        total_kg: nv(base.total_kg), harga_ikan: nv(base.harga_ikan), biaya_bumbu: nv(base.biaya_bumbu),
      }, vars.map(v => ({
        ukuran_target: nv(v.ukuran_target), jumlah_pack: nv(v.jumlah_pack), kelebihan: nv(v.kelebihan),
        packaging: nv(v.packaging), label: nv(v.label), lainnya: nv(v.lainnya),
        margin_kongsiapa: nv(v.margin_kongsiapa), harga_real_kongsiapa: nv(v.harga_real_kongsiapa),
        margin_mis: nv(v.margin_mis), harga_real_mis: nv(v.harga_real_mis),
        margin_ec: nv(v.margin_ec), harga_real: nv(v.harga_real),
      })))
      flash('✓ Batch tersimpan')
      load()
    } catch (e) { alert('Gagal menyimpan: ' + e.message) }
    finally { setSaving(false) }
  }

  async function removeBatch(b) {
    if (!confirm(`Hapus batch "${b.nama_produk}"? Permanen.`)) return
    try { await deleteHppBatch(b.id); load(); flash('Batch dihapus') }
    catch (e) { alert('Gagal: ' + e.message) }
  }

  function loadBatch(b) {
    setBase({
      nama_produk: b.nama_produk || '',
      total_kg: b.total_kg ?? '', harga_ikan: b.harga_ikan ?? '', biaya_bumbu: b.biaya_bumbu ?? '0',
    })
    setVars((b.hpp_variants || []).length ? b.hpp_variants.map(v => ({
      ukuran_target: v.ukuran_target ?? '', jumlah_pack: v.jumlah_pack ?? '', kelebihan: v.kelebihan ?? '',
      packaging: v.packaging ?? '', label: v.label ?? '', lainnya: v.lainnya ?? '',
      margin_kongsiapa: v.margin_kongsiapa ?? '20', harga_real_kongsiapa: v.harga_real_kongsiapa ?? '',
      margin_mis: v.margin_mis ?? '15', harga_real_mis: v.harga_real_mis ?? '',
      margin_ec: v.margin_ec ?? '25', harga_real: v.harga_real ?? '',
    })) : [emptyVar()])
    window.scrollTo({ top: 0, behavior: 'smooth' })
    flash('Data batch dimuat ke form')
  }

  async function doImportLegacy() {
    let items
    try {
      items = JSON.parse(legacyText)
      if (!Array.isArray(items)) throw new Error('Formatnya harus array JSON')
    } catch (e) { alert('JSON tidak valid: ' + e.message); return }
    if (!confirm(`Import ${items.length} batch lama ke Supabase?`)) return
    try {
      const n = await importHppLegacy(items)
      flash(`✓ ${n} batch lama terimport`)
      setShowImport(false); setLegacyText(''); load()
    } catch (e) { alert('Gagal import: ' + e.message) }
  }

  function exportCSV() {
    if (!R.mo && !R.tg) { flash('Tidak ada data.'); return }
    const q = s => `"${String(s ?? '')}"`
    const lines = [
      q('HPP Batch Kalkulator — Ibu Siapa'),
      `${q('Export')},${q(new Date().toLocaleString('id-ID'))}`, '',
      q('BAHAN BAKU'),
      `${q('Nama Produk')},${q(base.nama_produk)}`,
      `${q('Total Ikan (kg)')},${q(base.total_kg)}`,
      `${q('Harga Beli /kg')},${q(base.harga_ikan)}`,
      `${q('Biaya Bumbu /kg')},${q(base.biaya_bumbu)}`,
      `${q('Total Modal')},${q(Math.round(R.mo))}`, '',
      `"",${vars.map((_, i) => q('Varian ' + (i + 1))).join(',')}`,
      `${q('HPP Total /pack')},${R.C.map(c => Math.round(c.hpp)).join(',')}`, '',
    ]
    JALUR.forEach(j => {
      lines.push(q(('Harga ke ' + j.label).toUpperCase()))
      lines.push(`${q('Harga')},${R.C.map(c => c.jalur[j.key].real > 0 ? Math.round(c.jalur[j.key].real) : '').join(',')}`)
      lines.push(`${q('Margin (%)')},${R.C.map(c => c.jalur[j.key].marginReal !== null ? c.jalur[j.key].marginReal.toFixed(1) : '').join(',')}`)
      lines.push(`${q('Untung /pack')},${R.C.map(c => c.jalur[j.key].untungReal !== null ? Math.round(c.jalur[j.key].untungReal) : '').join(',')}`)
      lines.push(`${q('Untung total batch')},${R.C.map(c => c.jalur[j.key].untungRealTotal !== null ? Math.round(c.jalur[j.key].untungRealTotal) : '').join(',')}`)
      lines.push('')
    })
    lines.push(q('Kongsiapa -> End Customer (info)'))
    lines.push(`${q('Margin (%)')},${R.C.map(c => c.marginKongsiapaKeEcReal !== null ? c.marginKongsiapaKeEcReal.toFixed(1) : '').join(',')}`)
    lines.push(`${q('Selisih harga (Rp)')},${R.C.map(c => c.selisihKongsiapaKeEcReal !== null ? Math.round(c.selisihKongsiapaKeEcReal) : '').join(',')}`)

    const a = document.createElement('a')
    a.href = 'data:text/csv;charset=utf-8,\uFEFF' + encodeURIComponent(lines.join('\n'))
    a.download = `HPP_${base.nama_produk || 'batch'}_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  const ready = R.mo > 0 && R.tg > 0
  const anyRealFilled = R.C.some(c => JALUR.some(j => c.jalur[j.key].real > 0))

  return (
    <div className="hpp">
      {toast && <div className="hpp-toast">{toast}</div>}

      <div className="hpp-layout">
      <div className="hpp-col-left">

      {/* ---- BAHAN BAKU ---- */}
      <div className="card">
        <div className="card-head-h">Bahan Baku</div>
        <div className="hpp-grid2">
          <div className="fld">
            <label>Nama produk</label>
            <input type="text" list="nama-produk-list" placeholder="mis: Nila Bersih"
              value={base.nama_produk} onChange={e => setB('nama_produk', e.target.value)} />
            <datalist id="nama-produk-list">
              {namaProdukList.map(n => <option key={n} value={n} />)}
            </datalist>
          </div>
          <div className="fld">
            <label>Total ikan diproses (kg)</label>
            <input type="number" placeholder="0" value={base.total_kg} onChange={e => setB('total_kg', e.target.value)} />
          </div>
          <div className="fld">
            <label>Harga beli ikan (Rp/kg)</label>
            <input type="number" placeholder="0" value={base.harga_ikan} onChange={e => setB('harga_ikan', e.target.value)} />
          </div>
          <div className="fld">
            <label>Biaya bumbu (Rp/kg · 0 jika tidak ada)</label>
            <input type="number" value={base.biaya_bumbu} onChange={e => setB('biaya_bumbu', e.target.value)} />
          </div>
        </div>
        <div className="hpp-stats">
          <div><span className="sl">Biaya ikan</span><b>{nv(base.total_kg) && nv(base.harga_ikan) ? rp(nv(base.total_kg) * nv(base.harga_ikan)) : '—'}</b></div>
          <div><span className="sl">Biaya bumbu</span><b>{rp(nv(base.total_kg) * nv(base.biaya_bumbu))}</b></div>
          <div><span className="sl">Total modal</span><b className="accent">{R.mo > 0 ? rp(R.mo) : '—'}</b></div>
          <div><span className="sl">Total gram</span><b>{R.tg > 0 ? gr(R.tg) : '—'}</b></div>
          <div><span className="sl">Yield rate</span><b className={R.yr > 0 ? yieldClass(R.yr) : ''}>{R.yr > 0 ? pc(R.yr) : '—'}</b></div>
        </div>
      </div>

      {/* ---- VARIAN ---- */}
      <div className="card">
        <div className="card-head-h">Varian Produksi</div>
        <div className="var-wrap">
          {vars.map((v, i) => {
            const ef = nv(v.ukuran_target) + nv(v.kelebihan)
            const c = R.C[i]
            return (
              <div className="var-card" key={i}>
                <div className="var-top">
                  <b>Varian {i + 1}</b>
                  {vars.length > 1 && <button className="var-x" onClick={() => delVar(i)}>✕</button>}
                </div>
                <div className="fld-sm"><label>Ukuran target (g)</label>
                  <input type="number" placeholder="0" value={v.ukuran_target} onChange={e => setV(i, 'ukuran_target', e.target.value)} /></div>
                <div className="fld-sm"><label>Jumlah pack jadi</label>
                  <input type="number" placeholder="0" value={v.jumlah_pack} onChange={e => setV(i, 'jumlah_pack', e.target.value)} /></div>
                <div className="fld-sm"><label>Kelebihan timbang (g)</label>
                  <input type="number" placeholder="0" value={v.kelebihan} onChange={e => setV(i, 'kelebihan', e.target.value)} /></div>
                <div className="var-note">
                  Efektif: <b>{ef ? ef + ' g' : '—'}</b> · Total: <b>{ef && nv(v.jumlah_pack) ? gr(ef * nv(v.jumlah_pack)) : '—'}</b>
                </div>

                <div className="var-sec">Kemasan / pack (Rp)</div>
                <div className="fld-sm">
                  <label>Packaging</label>
                  <input type="number" placeholder="0" value={v.packaging} onChange={e => setV(i, 'packaging', e.target.value)} />
                  <ComponentPicker components={components} onPick={val => setV(i, 'packaging', val)} />
                </div>
                <div className="fld-sm">
                  <label>Label</label>
                  <input type="number" placeholder="0" value={v.label} onChange={e => setV(i, 'label', e.target.value)} />
                  <ComponentPicker components={components} onPick={val => setV(i, 'label', val)} />
                </div>
                <div className="fld-sm">
                  <label>Lainnya</label>
                  <input type="number" placeholder="0" value={v.lainnya} onChange={e => setV(i, 'lainnya', e.target.value)} />
                  <ComponentPicker components={components} onPick={val => setV(i, 'lainnya', val)} />
                </div>

                {/* ---- PER JALUR: margin -> pratinjau target -> harga real -> harga terakhir ---- */}
                {JALUR.map(j => {
                  const last = findHargaTerakhir(hist, base.nama_produk, v.ukuran_target, j.realField)
                  const jc = c ? c.jalur[j.key] : null
                  return (
                    <div className={`jalur-blok ${j.cls}`} key={j.key}>
                      <div className="var-sec jalur-sec">Harga ke {j.label} {j.sub && <span className="jalur-sub">{j.sub}</span>}</div>
                      <div className="fld-sm">
                        <label>Margin (%)</label>
                        <input type="number" min="0" max="100" value={v[j.marginField]}
                          onChange={e => setV(i, j.marginField, e.target.value)} />
                      </div>
                      {jc && jc.target > 0 && (
                        <div className="target-preview">Harga jual: <b>{rp(jc.target)}</b></div>
                      )}
                      <div className="fld-sm real">
                        <label>Harga real</label>
                        <input type="number" placeholder="0" value={v[j.realField]}
                          onChange={e => setV(i, j.realField, e.target.value)} />
                      </div>
                      {jc && jc.untungReal !== null && (
                        <div className={`untung-preview ${jc.untungReal >= 0 ? 'g' : 'r'}`}>
                          Untung: {rp(jc.untungReal)} / pack
                        </div>
                      )}
                      {last && (
                        <div className="harga-terakhir">
                          Harga terakhir: <b>{rp(last.harga)}</b> ({fdtShort(last.created_at)})
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
        <button className="btn-ghost-dark" onClick={addVar}>+ Tambah Varian</button>
      </div>

      </div>{/* /.hpp-col-left */}

      <div className="hpp-col-right">

      {/* ---- OUTPUT: cuma dari harga real, dikelompokkan per jalur ---- */}
      <div className="card">
        <div className="card-head-h">Hasil Kalkulasi HPP</div>
        {!ready ? (
          <div className="empty">Isi data bahan baku dan minimal satu varian untuk melihat hasil.</div>
        ) : !anyRealFilled ? (
          <div className="empty">
            HPP per pack sudah kehitung, tapi belum ada harga real yang diisi.<br />
            Isi minimal satu harga real di salah satu jalur untuk melihat untung.
            <div className="hpp-preview-hpp">
              {vars.map((v, i) => (
                <span key={i}>Varian {i + 1}: <b>{rp(R.C[i].hpp)}</b></span>
              ))}
            </div>
          </div>
        ) : (
          <div className="out-wrap">
            <table className="out-tbl">
              <thead>
                <tr>
                  <th>Komponen</th>
                  {vars.map((v, i) => (
                    <th key={i}>Pack {(nv(v.ukuran_target) + nv(v.kelebihan)) || '—'}g<br />
                      <span className="th-sub">{nv(v.jumlah_pack) || '—'} pack</span></th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="tot"><td>HPP TOTAL / pack</td>{R.C.map((c, i) => <td key={i} className="a">{rp(c.hpp)}</td>)}</tr>

                {JALUR.map(j => {
                  const anyFilled = R.C.some(c => c.jalur[j.key].real > 0)
                  if (!anyFilled) return null
                  return (
                    <Fragment key={j.key}>
                      <tr className={`sec ${j.cls === 'k' ? 'kongsiapa' : ''}`}>
                        <td colSpan={vars.length + 1}>Harga ke {j.label} {j.sub}</td>
                      </tr>
                      <tr className="tot">
                        <td>Harga</td>
                        {R.C.map((c, i) => <td key={i} className={j.cls}>{c.jalur[j.key].real > 0 ? rp(c.jalur[j.key].real) : '—'}</td>)}
                      </tr>
                      <tr>
                        <td>Margin</td>
                        {R.C.map((c, i) => {
                          const mr = c.jalur[j.key].marginReal
                          return <td key={i} className={mr !== null ? marginClass(mr) : ''}>{mr !== null ? pc(mr) : '—'}</td>
                        })}
                      </tr>
                      <tr>
                        <td>Untung / pack</td>
                        {R.C.map((c, i) => {
                          const u = c.jalur[j.key].untungReal
                          return <td key={i} className={u !== null ? (u > 0 ? 'g' : 'r') : ''}>{u !== null ? rp(u) : '—'}</td>
                        })}
                      </tr>
                      <tr className="tot">
                        <td>Untung total batch</td>
                        {R.C.map((c, i) => {
                          const u = c.jalur[j.key].untungRealTotal
                          return <td key={i} className={u !== null ? (u > 0 ? 'g' : 'r') : ''}>{u !== null ? rp(u) : '—'}</td>
                        })}
                      </tr>
                      {j.key === 'kongsiapa' && R.C.some(c => c.marginKongsiapaKeEcReal !== null) && (
                        <>
                          <tr className="info-row">
                            <td>Margin Kongsiapa → EC <span className="info-tag">info</span></td>
                            {R.C.map((c, i) => (
                              <td key={i} className="muted">{c.marginKongsiapaKeEcReal !== null ? pc(c.marginKongsiapaKeEcReal) : '—'}</td>
                            ))}
                          </tr>
                          <tr className="info-row">
                            <td>Selisih harga Kongsiapa → EC <span className="info-tag">info</span></td>
                            {R.C.map((c, i) => (
                              <td key={i} className="muted">{c.selisihKongsiapaKeEcReal !== null ? rp(c.selisihKongsiapaKeEcReal) : '—'}</td>
                            ))}
                          </tr>
                        </>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="hpp-actions">
        <button className="btn-primary" onClick={save} disabled={saving || !ready}>
          {saving ? 'Menyimpan…' : '💾 Simpan Batch'}
        </button>
        <button className="btn-ghost-dark" onClick={exportCSV}>↓ Export CSV</button>
      </div>

      </div>{/* /.hpp-col-right */}
      </div>{/* /.hpp-layout */}

      <div className="hist-head">
        <h3>Riwayat Batch</h3>
        <button className="link-btn" onClick={() => setShowImport(s => !s)}>Import data lama</button>
      </div>

      {showImport && (
        <div className="card import-legacy">
          <p className="muted sm">
            Untuk memindahkan riwayat dari kalkulator Apps Script lama:
            buka spreadsheet lama, salin isi kolom <b>data_json</b> (semua baris), bungkus jadi array JSON
            <code> [ &#123;...&#125;, &#123;...&#125; ] </code>, lalu tempel di bawah.
          </p>
          <textarea rows={5} placeholder='[{"id":"...","ts":"...","nama":"...","state":{...}}]'
            value={legacyText} onChange={e => setLegacyText(e.target.value)} />
          <button className="btn-primary" onClick={doImportLegacy} disabled={!legacyText.trim()}>Import</button>
        </div>
      )}

      {error && <div className="err-banner">Error: {error}</div>}
      {loading ? <div className="loading">Memuat riwayat…</div>
        : hist.length === 0 ? <div className="empty">Belum ada batch tersimpan.</div>
          : (
            <div className="hist-wrap">
              <table className="hist-tbl">
                <thead><tr><th>#</th><th>Waktu</th><th>Produk</th><th>Varian</th><th>Modal</th><th>Total gram</th><th></th></tr></thead>
                <tbody>
                  {hist.map((b, i) => {
                    const rr = calcHpp(b, b.hpp_variants || [])
                    return (
                      <tr key={b.id}>
                        <td className="muted">{hist.length - i}</td>
                        <td className="nowrap sm">{fdt(b.created_at)}</td>
                        <td><b>{b.nama_produk}</b></td>
                        <td><span className="badge-v">{(b.hpp_variants || []).length} var</span></td>
                        <td className="accent">{rp(rr.mo)}</td>
                        <td>{rr.tg > 0 ? gr(rr.tg) : '—'}</td>
                        <td className="nowrap">
                          <button className="link-btn" onClick={() => loadBatch(b)}>Muat</button>
                          <button className="link-btn del" onClick={() => removeBatch(b)}>Hapus</button>
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
