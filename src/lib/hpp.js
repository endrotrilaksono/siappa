// ============================================================
// MESIN HITUNG HPP
// Rumus DISALIN PERSIS dari kalkulator Apps Script yang lama.
// Jangan diubah tanpa verifikasi ulang terhadap batch lama.
// ============================================================

export const nv = v => parseFloat(v) || 0
export const rp = v => 'Rp ' + Math.round(v).toLocaleString('id-ID')
export const gr = v => Math.round(v).toLocaleString('id-ID') + ' g'
export const pc = v => (+v).toFixed(1) + '%'

/**
 * @param {{total_kg,harga_ikan,biaya_bumbu}} base
 * @param {Array} vars - {ukuran_target,jumlah_pack,kelebihan,packaging,label,lainnya,margin_ec,margin_mis,harga_real}
 */
export function calcHpp(base, vars) {
  const kg = nv(base.total_kg)
  const hi = nv(base.harga_ikan)
  const hb = nv(base.biaya_bumbu)

  // modal = kg × (harga ikan + biaya bumbu)
  const mo = kg * (hi + hb)

  // total gram = Σ (ukuran + kelebihan) × jumlah pack
  const tg = vars.reduce((s, v) => s + (nv(v.ukuran_target) + nv(v.kelebihan)) * nv(v.jumlah_pack), 0)

  // yield rate = total gram ÷ (kg × 1000) × 100
  const yr = kg > 0 && tg > 0 ? (tg / (kg * 1000)) * 100 : 0

  const C = vars.map(v => {
    const ef = nv(v.ukuran_target) + nv(v.kelebihan)   // gram efektif per pack
    const ju = nv(v.jumlah_pack)

    // alokasi modal per gram × gram efektif
    const hI = tg > 0 ? (mo / tg) * ef : 0
    const hK = nv(v.packaging) + nv(v.label) + nv(v.lainnya)
    const hpp = hI + hK

    // harga jual = HPP ÷ (1 − margin%)
    const mec = nv(v.margin_ec)
    const mmis = nv(v.margin_mis)
    const ec = mec < 100 ? hpp / (1 - mec / 100) : hpp
    const ms = mmis < 100 ? hpp / (1 - mmis / 100) : hpp

    const real = nv(v.harga_real)
    const mR = real > 0 ? ((real - hpp) / real) * 100 : null

    const uec = ec - hpp
    const ums = ms - hpp

    return {
      ef, ju, hI, hK, hpp, ec, ms,
      uec, uect: uec * ju,
      ums, umst: ums * ju,
      uR: real > 0 ? real - hpp : null,
      uRt: real > 0 ? (real - hpp) * ju : null,
      mR,
    }
  })

  return { mo, tg, yr, C }
}

// warna indikator, sama seperti versi lama
export const yieldClass = yr => (yr >= 70 ? 'g' : yr >= 55 ? 'a' : 'r')
export const marginClass = m => (m >= 25 ? 'g' : m >= 10 ? 'a' : 'r')
