import { computeMarketplace, gimmickFromDiskon, diskonFromGimmick } from '../lib/marketplace'
import { rp, nv } from '../lib/hpp'

export function emptyMpPanel() {
  return {
    potongan: [
      { nama: 'Komisi Platform', value: '', format: '%' },
      { nama: 'Biaya Admin', value: '', format: '%' },
    ],
    marginKotor: '',
    gimmickMode: 'pct', // 'pct' = mulai dari diskon%, 'rp' = mulai dari harga coret
    gimmickDiskonPct: '',
    gimmickHargaRp: '',
  }
}

export default function MarketplacePanel({ label, value, onChange, hpp }) {
  const v = value || emptyMpPanel()

  function setField(k, val) { onChange({ ...v, [k]: val }) }
  function setRow(i, patch) {
    const rows = v.potongan.map((r, idx) => idx === i ? { ...r, ...patch } : r)
    onChange({ ...v, potongan: rows })
  }
  function addRow() {
    onChange({ ...v, potongan: [...v.potongan, { nama: '', value: '', format: '%' }] })
  }
  function delRow(i) {
    onChange({ ...v, potongan: v.potongan.filter((_, idx) => idx !== i) })
  }

  const result = computeMarketplace(hpp, v.potongan, v.marginKotor)

  // gimmick, dua arah, tergantung mode
  let gimmickHargaCoret = null, gimmickDiskonPersen = null
  if (result.hargaJual) {
    if (v.gimmickMode === 'pct') {
      gimmickHargaCoret = gimmickFromDiskon(result.hargaJual, v.gimmickDiskonPct)
      gimmickDiskonPersen = nv(v.gimmickDiskonPct)
    } else {
      gimmickDiskonPersen = diskonFromGimmick(result.hargaJual, v.gimmickHargaRp)
      gimmickHargaCoret = nv(v.gimmickHargaRp)
    }
  }

  return (
    <div className="mp-panel">
      <b className="mp-panel-title">{label}</b>

      <div className="mp-potongan-list">
        {v.potongan.map((r, i) => (
          <div className="mp-potongan-row" key={i}>
            <input type="text" placeholder="Nama potongan" value={r.nama}
              onChange={e => setRow(i, { nama: e.target.value })} />
            <input type="number" placeholder="0" value={r.value}
              onChange={e => setRow(i, { value: e.target.value })} />
            <select value={r.format} onChange={e => setRow(i, { format: e.target.value })}>
              <option value="%">%</option>
              <option value="Rp">Rp</option>
            </select>
            <button className="mp-row-x" onClick={() => delRow(i)} aria-label="Hapus baris">✕</button>
          </div>
        ))}
      </div>
      <button className="mp-add-row" onClick={addRow}>+ tambah potongan</button>

      <div className="mp-margin-fld">
        <label>Margin Kotor ({label})</label>
        <input type="number" placeholder="0" value={v.marginKotor}
          onChange={e => setField('marginKotor', e.target.value)} />
      </div>

      {result.error && <div className="mp-error">{result.error}</div>}

      {result.hargaJual !== null && (
        <div className="mp-result">
          <div className="mp-result-row">
            <span>Harga jual disarankan</span>
            <b>{rp(result.hargaJual)}</b>
          </div>
          <div className="mp-result-row">
            <span>Margin kotor (Rp)</span>
            <b>{rp(result.marginKotorRp)}</b>
          </div>
        </div>
      )}

      {result.hargaJual !== null && (
        <div className="mp-gimmick">
          <div className="mp-gimmick-title">Promo toko / diskon coret</div>
          <div className="mp-gimmick-mode">
            <label>
              <input type="radio" checked={v.gimmickMode === 'pct'}
                onChange={() => setField('gimmickMode', 'pct')} />
              Mulai dari diskon %
            </label>
            <label>
              <input type="radio" checked={v.gimmickMode === 'rp'}
                onChange={() => setField('gimmickMode', 'rp')} />
              Mulai dari harga coret
            </label>
          </div>

          {v.gimmickMode === 'pct' ? (
            <div className="mp-gimmick-fld">
              <label>Diskon (%)</label>
              <input type="number" placeholder="0" value={v.gimmickDiskonPct}
                onChange={e => setField('gimmickDiskonPct', e.target.value)} />
            </div>
          ) : (
            <div className="mp-gimmick-fld">
              <label>Harga coret (Rp)</label>
              <input type="number" placeholder="0" value={v.gimmickHargaRp}
                onChange={e => setField('gimmickHargaRp', e.target.value)} />
            </div>
          )}

          {gimmickHargaCoret !== null && gimmickDiskonPersen !== null && (
            <div className="mp-gimmick-result">
              {v.gimmickMode === 'pct'
                ? <>Harga coret: <b>{rp(gimmickHargaCoret)}</b></>
                : <>Diskon: <b>{gimmickDiskonPersen.toFixed(1)}%</b></>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
