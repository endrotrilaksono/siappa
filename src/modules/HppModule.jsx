import { useState, useEffect, useCallback } from 'react'
import { getHppBatches, createHppBatch, deleteHppBatch, importHppLegacy, getHppComponents } from '../lib/api'
import { calcHpp, rp, gr, pc, nv, yieldClass, marginClass } from '../lib/hpp'

const emptyVar = () => ({
  ukuran_target: '', jumlah_pack: '', kelebihan: '',
  packaging: '', label: '', lainnya: '',
  margin_ec: '25', margin_mis: '15', harga_real: '',
  margin_kongsiapa: '20', harga_real_kongsiapa: '',
})

const fdt = ts => {
  const d = new Date(ts)
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: '2-digit' }) +
    ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

// dropdown kecil untuk pilih komponen tersimpan, mengisi angka ke field target
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
        margin_ec: nv(v.margin_ec), margin_mis: nv(v.margin_mis), harga_real: nv(v.harga_real),
        margin_kongsiapa: nv(v.margin_kongsiapa), harga_real_kongsiapa: nv(v.harga_real_kongsiapa),
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
      margin_ec: v.margin_ec ?? '25', margin_mis: v.margin_mis ?? '15', harga_real: v.harga_real ?? '',
      margin_kongsiapa: v.margin_kongsiapa ?? '20', harga_real_kongsiapa: v.harga_real_kongsiapa ?? '',
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
    const vrow = (lbl, fn) => `${q(lbl)},${vars.map(fn).join(',')}`
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
      vrow('Ukuran Efektif (g)', v => nv(v.ukuran_target) + nv(v.kelebihan)),
      vrow('Jumlah Pack', v => nv(v.jumlah_pack)),
      `${q('Total Gram')},${q(Math.round(R.tg))}`,
      `${q('Yield Rate (%)')},${q(R.yr.toFixed(1))}`, '',
      q('KALKULASI HPP'),
      `${q('HPP Total /pack')},${R.C.map(c => Math.round(c.hpp)).join(',')}`, '',
      q('END CUSTOMER'),
      `${q('Harga Jual EC')},${R.C.map(c => Math.round(c.ec)).join(',')}`,
      `${q('Untung /pack')},${R.C.map(c => Math.round(c.uec)).join(',')}`, '',
      q('MIS / RESELLER'),
      `${q('Harga Jual MIS')},${R.C.map(c => Math.round(c.ms)).join(',')}`,
      `${q('Untung /pack')},${R.C.map(c => Math.round(c.ums)).join(',')}`, '',
      q('KONGSIAPA'),
      `${q('Harga Jual Kongsiapa')},${R.C.map(c => Math.round(c.hargaKongsiapa)).join(',')}`,
      `${q('Untung /pack')},${R.C.map(c => Math.round(c.ukongsiapa)).join(',')}`,
      `${q('Margin Kongsiapa -> EC (info)')},${R.C.map(c => c.marginKongsiapaKeEc !== null ? c.marginKongsiapaKeEc.toFixed(1) : '').join(',')}`,
    ]
    const a = document.createElement('a')
    a.href = 'data:text/csv;charset=utf-8,\uFEFF' + encodeURIComponent(lines.join('\n'))
    a.download = `HPP_${base.nama_produk || 'batch'}_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  const hasRealEc = vars.some(v => nv(v.harga_real) > 0)
  const hasRealKongsiapa = vars.some(v => nv(v.harga_real_kongsiapa) > 0)
  const ready = R.mo > 0 && R.tg > 0

  return (
    <div className="hpp">
      {toast && <div className="hpp-toast">{toast}</div>}

      <div className="card">
        <div className="card-head-h">Bahan Baku</div>
        <div className="hpp-grid2">
          <div className="fld">
            <label>Nama produk</label>
            <input type="text" placeholder="mis: Nila Bersih"
              value={base.nama_produk} onChange={e => setB('nama_produk', e.target.value)} />
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

      <div className="card">
        <div className="card-head-h">Varian Produksi</div>
        <div className="var-wrap">
          {vars.map((v, i) => {
            const ef = nv(v.ukuran_target) + nv(v.kelebihan)
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

                <div className="var-sec">Target margin (%)</div>
                <div className="fld-sm"><label>End customer</label>
                  <input type="number" min="0" max="100" value={v.margin_ec} onChange={e => setV(i, 'margin_ec', e.target.value)} /></div>
                <div className="fld-sm"><label>MIS / Reseller</label>
                  <input type="number" min="0" max="100" value={v.margin_mis} onChange={e => setV(i, 'margin_mis', e.target.value)} /></div>
                <div className="fld-sm kongsiapa-fld"><label>Ke Kongsiapa</label>
                  <input type="number" min="0" max="100" value={v.margin_kongsiapa} onChange={e => setV(i, 'margin_kongsiapa', e.target.value)} />
                  <span className="fld-hint">EC tidak ikut berubah dari ini</span></div>

                <div className="var-sec">Harga jual real (opsional)</div>
                <div className="fld-sm real"><label>Real ke End Customer</label>
                  <input type="number" placeholder="cek margin aktual EC" value={v.harga_real} onChange={e => setV(i, 'harga_real', e.target.value)} /></div>
                <div className="fld-sm real"><label>Real ke Kongsiapa</label>
                  <input type="number" placeholder="cek margin aktual Kongsiapa" value={v.harga_real_kongsiapa} onChange={e => setV(i, 'harga_real_kongsiapa', e.target.value)} /></div>
              </div>
            )
          })}
        </div>
        <button className="btn-ghost-dark" onClick={addVar}>+ Tambah Varian</button>
      </div>

      <div className="card">
        <div className="card-head-h">Hasil Kalkulasi HPP</div>
        {!ready ? (
          <div className="empty">Isi data bahan baku dan minimal satu varian untuk melihat hasil.</div>
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
                <tr><td>HPP ikan+bumbu / pack</td>{R.C.map((c, i) => <td key={i}>{rp(c.hI)}</td>)}</tr>
                <tr><td>HPP kemasan / pack</td>{R.C.map((c, i) => <td key={i}>{rp(c.hK)}</td>)}</tr>
                <tr className="tot"><td>HPP TOTAL / pack</td>{R.C.map((c, i) => <td key={i} className="a">{rp(c.hpp)}</td>)}</tr>

                <tr className="sec"><td colSpan={vars.length + 1}>End Customer</td></tr>
                <tr className="tot"><td>Harga jual EC</td>{R.C.map((c, i) => <td key={i} className="g">{rp(c.ec)}</td>)}</tr>
                <tr><td>Untung / pack</td>{R.C.map((c, i) => <td key={i} className="g">{rp(c.uec)}</td>)}</tr>
                <tr className="tot"><td>Untung total batch</td>{R.C.map((c, i) => <td key={i} className="g">{rp(c.uect)}</td>)}</tr>

                <tr className="sec"><td colSpan={vars.length + 1}>MIS / Reseller</td></tr>
                <tr className="tot"><td>Harga jual MIS/Reseller</td>{R.C.map((c, i) => <td key={i}>{rp(c.ms)}</td>)}</tr>
                <tr><td>Untung / pack</td>{R.C.map((c, i) => <td key={i}>{rp(c.ums)}</td>)}</tr>
                <tr className="tot"><td>Untung total batch</td>{R.C.map((c, i) => <td key={i}>{rp(c.umst)}</td>)}</tr>

                <tr className="sec kongsiapa"><td colSpan={vars.length + 1}>Kongsiapa (mudharabah)</td></tr>
                <tr className="tot"><td>Harga jual Kongsiapa</td>{R.C.map((c, i) => <td key={i} className="k">{rp(c.hargaKongsiapa)}</td>)}</tr>
                <tr><td>Untung / pack</td>{R.C.map((c, i) => <td key={i} className="k">{rp(c.ukongsiapa)}</td>)}</tr>
                <tr className="tot"><td>Untung total batch</td>{R.C.map((c, i) => <td key={i} className="k">{rp(c.ukongsiapaTotal)}</td>)}</tr>
                <tr className="info-row"><td>Margin Kongsiapa → EC <span className="info-tag">info</span></td>
                  {R.C.map((c, i) => <td key={i} className="muted">{c.marginKongsiapaKeEc !== null ? pc(c.marginKongsiapaKeEc) : '—'}</td>)}</tr>

                {hasRealEc && <>
                  <tr className="sec"><td colSpan={vars.length + 1}>Harga Real — End Customer</td></tr>
                  <tr className="tot"><td>Harga real EC</td>{vars.map((v, i) => <td key={i}>{nv(v.harga_real) > 0 ? rp(nv(v.harga_real)) : '—'}</td>)}</tr>
                  <tr><td>Margin real EC</td>{R.C.map((c, i) => <td key={i} className={c.mR !== null ? marginClass(c.mR) : ''}>{c.mR !== null ? pc(c.mR) : '—'}</td>)}</tr>
                  <tr><td>Untung / pack</td>{R.C.map((c, i) => <td key={i} className={c.uR !== null ? (c.uR > 0 ? 'g' : 'r') : ''}>{c.uR !== null ? rp(c.uR) : '—'}</td>)}</tr>
                  <tr className="tot"><td>Untung total batch</td>{R.C.map((c, i) => <td key={i} className={c.uRt !== null ? (c.uRt > 0 ? 'g' : 'r') : ''}>{c.uRt !== null ? rp(c.uRt) : '—'}</td>)}</tr>
                </>}

                {hasRealKongsiapa && <>
                  <tr className="sec kongsiapa"><td colSpan={vars.length + 1}>Harga Real — Kongsiapa</td></tr>
                  <tr className="tot"><td>Harga real Kongsiapa</td>{vars.map((v, i) => <td key={i}>{nv(v.harga_real_kongsiapa) > 0 ? rp(nv(v.harga_real_kongsiapa)) : '—'}</td>)}</tr>
                  <tr><td>Margin real Kongsiapa</td>{R.C.map((c, i) => <td key={i} className={c.mRKongsiapa !== null ? marginClass(c.mRKongsiapa) : ''}>{c.mRKongsiapa !== null ? pc(c.mRKongsiapa) : '—'}</td>)}</tr>
                  <tr><td>Untung / pack</td>{R.C.map((c, i) => <td key={i} className={c.uRKongsiapa !== null ? (c.uRKongsiapa > 0 ? 'g' : 'r') : ''}>{c.uRKongsiapa !== null ? rp(c.uRKongsiapa) : '—'}</td>)}</tr>
                  <tr className="tot"><td>Untung total batch</td>{R.C.map((c, i) => <td key={i} className={c.uRKongsiapaTotal !== null ? (c.uRKongsiapaTotal > 0 ? 'g' : 'r') : ''}>{c.uRKongsiapaTotal !== null ? rp(c.uRKongsiapaTotal) : '—'}</td>)}</tr>
                </>}
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
