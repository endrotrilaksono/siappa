// ============================================================
// MESIN HITUNG MARKETPLACE (Shopee / TikTok Shop)
// Diadaptasi dari kalkulator Mona App, rumus reverse dari margin kotor.
// Beda dari HPP biasa: potongan platform itu persentase dari HARGA
// JUAL, bukan dari HPP, jadi potongan % dan margin % digabung dulu
// jadi satu pembagi sebelum dapat harga jual.
// ============================================================

import { nv } from './hpp'

export function sumPotongan(rows) {
  let pctRaw = 0
  let rpSum = 0
  ;(rows || []).forEach(r => {
    const v = nv(r.value)
    if (r.format === '%') pctRaw += v
    else rpSum += v
  })
  return { pctFrac: pctRaw / 100, rpSum }
}

/**
 * @param {number} totalHPP - HPP murni per pack (dari hpp.js)
 * @param {Array} potonganRows - [{nama, value, format: '%'|'Rp'}]
 * @param {number|string} marginKotorPct - target margin kotor (%)
 */
export function computeMarketplace(totalHPP, potonganRows, marginKotorPct) {
  const { pctFrac, rpSum } = sumPotongan(potonganRows)
  const mKotor = nv(marginKotorPct) / 100
  const denom = 1 - pctFrac - mKotor

  if (!(totalHPP > 0) || nv(marginKotorPct) <= 0) {
    return { hargaJual: null, marginKotorRp: null, error: null }
  }
  if (denom <= 0) {
    return { hargaJual: null, marginKotorRp: null, error: 'Total potongan + margin kotor >= 100%, tidak bisa dihitung.' }
  }

  const hargaJual = (totalHPP + rpSum) / denom
  const netRevenue = hargaJual * (1 - pctFrac) - rpSum
  const marginKotorRp = netRevenue - totalHPP

  return { hargaJual, marginKotorRp, error: null }
}

// dari harga real -> margin real & untung real (mirip pola calcJalur di hpp.js,
// dipakai supaya Shopee/TikTok/GrabMart konsisten sama 4 jalur offline)
export function computeMarketplaceReal(totalHPP, hargaReal) {
  const hr = nv(hargaReal)
  if (!(hr > 0)) return { marginReal: null, untungReal: null }
  const marginReal = ((hr - totalHPP) / hr) * 100
  const untungReal = hr - totalHPP
  return { marginReal, untungReal }
}

// arah balik dari computeMarketplace: dari HARGA JUAL yang mau dicapai,
// cari MARGIN berapa yang menghasilkan harga itu (dengan potongan yang sama).
// Dipakai untuk editor dua-arah margin<->harga di Daftar Harga.
export function marginFromHargaJual(totalHPP, potonganRows, hargaJual) {
  const hj = nv(hargaJual)
  if (!(hj > 0)) return null
  const { pctFrac, rpSum } = sumPotongan(potonganRows)
  const denom = (totalHPP + rpSum) / hj
  const marginPct = (1 - pctFrac - denom) * 100
  return marginPct
}

// ---------- Gimmick / promo toko / diskon coret, dua arah ----------

// dari diskon% -> harga coret
export function gimmickFromDiskon(hargaJual, diskonPct) {
  const d = nv(diskonPct) / 100
  if (!(hargaJual > 0) || d <= 0 || d >= 1) return null
  return hargaJual / (1 - d)
}

// dari harga coret -> diskon%
export function diskonFromGimmick(hargaJual, hargaGimmick) {
  const hg = nv(hargaGimmick)
  if (!(hargaJual > 0) || hg <= 0) return null
  return (1 - hargaJual / hg) * 100
}
