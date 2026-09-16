import { computeMarketplace, computeMarketplaceReal, gimmickFromDiskon, diskonFromGimmick } from '../lib/marketplace'
import { rp, pc, nv } from '../lib/hpp'

export function emptyMpVariant() {
  return {
    marginKotor: '',
    hargaReal: '',
    gimmickMode: 'pct',
    gimmickDiskonPct: '',
    gimmickHargaRp: '',
  }
}

// Satu baris varian di dalam card Shopee/TikTok/GrabMart. Pola tampilannya
// sengaja dibuat MIRIP blok jalur offline (Kongsiapa dkk): margin -> pratinjau
// harga jual -> input harga real -> pratinjau untung. Bedanya, di sini "target"
// dihitung pakai rumus reverse-margin (butuh potongan dari level produk).
export default function MpVariantRow({ label, value, onChange, hpp, potongan }) {
  const v = value || emptyMpVariant()
  function setField(k, val) { onChange({ ...v, [k]: val }) }

  const target = computeMarketplace(hpp, potongan, v.marginKotor)
  const real = computeMarketplaceReal(hpp, v.hargaReal)

  let gimmickHargaCoret = null, gimmickDiskonPersen = null
  const hargaAcuan = nv(v.hargaReal) > 0 ? nv(v.hargaReal) : target.hargaJual
  if (hargaAcuan) {
    if (v.gimmickMode === 'pct') {
      gimmickHargaCoret = gimmickFromDiskon(hargaAcuan, v.gimmickDiskonPct)
      gimmickDiskonPersen = nv(v.gimmickDiskonPct)
    } else {
      gimmickDiskonPersen = diskonFromGimmick(hargaAcuan, v.gimmickHargaRp)
      gimmickHargaCoret = nv(v.gimmickHargaRp)
    }
  }

  return (
    <div className="mp-var-row">
      <div className="mp-var-label">{label}</div>

      {target.error && <div className="mp-error">{target.error}</div>}

      <div className="fld-sm">
        <label>Margin Kotor (%)</label>
        <input type="number" value={v.marginKotor} onChange={e => setField('marginKotor', e.target.value)} />
      </div>
      {target.hargaJual !== null && (
        <div className="target-preview">Harga jual: <b>{rp(target.hargaJual)}</b></div>
      )}

      <div className="fld-sm real">
        <label>Harga real</label>
        <input type="number" placeholder="0" value={v.hargaReal} onChange={e => setField('hargaReal', e.target.value)} />
      </div>
      {real.untungReal !== null && (
        <div className={`untung-preview ${real.untungReal >= 0 ? 'g' : 'r'}`}>
          Untung: {rp(real.untungReal)} ({pc(real.marginReal)})
        </div>
      )}

      <details className="mp-gimmick-inline">
        <summary>Promo toko / diskon coret</summary>
        <div className="mp-gimmick-mode">
          <label>
            <input type="radio" checked={v.gimmickMode === 'pct'} onChange={() => setField('gimmickMode', 'pct')} />
            Dari diskon %
          </label>
          <label>
            <input type="radio" checked={v.gimmickMode === 'rp'} onChange={() => setField('gimmickMode', 'rp')} />
            Dari harga coret
          </label>
        </div>
        {v.gimmickMode === 'pct' ? (
          <div className="mp-gimmick-fld">
            <label>Diskon (%)</label>
            <input type="number" value={v.gimmickDiskonPct} onChange={e => setField('gimmickDiskonPct', e.target.value)} />
          </div>
        ) : (
          <div className="mp-gimmick-fld">
            <label>Harga coret (Rp)</label>
            <input type="number" value={v.gimmickHargaRp} onChange={e => setField('gimmickHargaRp', e.target.value)} />
          </div>
        )}
        {gimmickHargaCoret !== null && gimmickDiskonPersen !== null && (
          <div className="mp-gimmick-result">
            {v.gimmickMode === 'pct'
              ? <>Harga coret: <b>{rp(gimmickHargaCoret)}</b></>
              : <>Diskon: <b>{gimmickDiskonPersen.toFixed(1)}%</b></>}
          </div>
        )}
      </details>
    </div>
  )
}
