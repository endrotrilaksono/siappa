// ============================================================
// MESIN HITUNG HPP — v9
// Rumus dasar (HPP, alokasi modal per gram) TIDAK berubah dari versi
// sebelumnya, sudah diverifikasi berulang kali. Yang berubah di v9:
//
// 1. Hasil disusun per JALUR PENJUALAN (kongsiapa, reseller, ec), urut
//    hirarki: Kongsiapa -> Reseller -> End Customer. Bukan lagi array
//    datar yang harus dibaca satu-satu.
// 2. Tiap jalur punya: margin target (input), harga target (dihitung
//    dari margin, dipakai untuk PRATINJAU di form, bukan tabel hasil),
//    harga real (input), margin real vs HPP, untung real /pack, untung
//    real total batch.
// 3. Reseller sekarang JUGA punya harga real (sebelumnya tidak ada).
// 4. Margin Kongsiapa -> EC sekarang dihitung dari DUA HARGA REAL
//    (real Kongsiapa vs real EC), BUKAN dari harga target seperti
//    versi sebelumnya. Kalau salah satu atau dua-duanya belum diisi,
//    hasilnya null (belum bisa dihitung), bukan 0.
// ============================================================

export const nv = v => parseFloat(v) || 0
export const rp = v => 'Rp ' + Math.round(v).toLocaleString('id-ID')
export const gr = v => Math.round(v).toLocaleString('id-ID') + ' g'
export const pc = v => (+v).toFixed(1) + '%'

function calcJalur(hpp, margin, real) {
  const target = margin < 100 ? hpp / (1 - margin / 100) : hpp
  const marginReal = real > 0 ? ((real - hpp) / real) * 100 : null
  const untungReal = real > 0 ? real - hpp : null
  return { margin, target, real, marginReal, untungReal }
}

/**
 * @param {{total_kg,harga_ikan,biaya_bumbu}} base
 * @param {Array} vars - {ukuran_target,jumlah_pack,kelebihan,packaging,label,lainnya,
 *                         margin_kongsiapa,harga_real_kongsiapa,
 *                         margin_mis,harga_real_mis,
 *                         margin_ec,harga_real}
 */
export function calcHpp(base, vars) {
  const kg = nv(base.total_kg)
  const hi = nv(base.harga_ikan)
  const hb = nv(base.biaya_bumbu)

  const mo = kg * (hi + hb)
  const tg = vars.reduce((s, v) => s + (nv(v.ukuran_target) + nv(v.kelebihan)) * nv(v.jumlah_pack), 0)
  const yr = kg > 0 && tg > 0 ? (tg / (kg * 1000)) * 100 : 0

  const C = vars.map(v => {
    const ef = nv(v.ukuran_target) + nv(v.kelebihan)
    const ju = nv(v.jumlah_pack)

    const hI = tg > 0 ? (mo / tg) * ef : 0
    const hK = nv(v.packaging) + nv(v.label) + nv(v.lainnya)
    const hpp = hI + hK

    const kongsiapa = calcJalur(hpp, nv(v.margin_kongsiapa), nv(v.harga_real_kongsiapa))
    const reseller = calcJalur(hpp, nv(v.margin_mis), nv(v.harga_real_mis))
    const ec = calcJalur(hpp, nv(v.margin_ec), nv(v.harga_real))

    // untung total batch, per jalur (butuh ju, dihitung di luar calcJalur
    // biar calcJalur tetap murni per-pack)
    ;[kongsiapa, reseller, ec].forEach(j => {
      j.untungRealTotal = j.untungReal !== null ? j.untungReal * ju : null
    })

    // Margin real Kongsiapa -> EC: dari DUA HARGA REAL, bukan HPP.
    const rK = nv(v.harga_real_kongsiapa)
    const rE = nv(v.harga_real)
    const marginKongsiapaKeEcReal = (rK > 0 && rE > 0) ? ((rE - rK) / rE) * 100 : null

    return { ef, ju, hI, hK, hpp, jalur: { kongsiapa, reseller, ec }, marginKongsiapaKeEcReal }
  })

  return { mo, tg, yr, C }
}

export const yieldClass = yr => (yr >= 70 ? 'g' : yr >= 55 ? 'a' : 'r')
export const marginClass = m => (m >= 25 ? 'g' : m >= 10 ? 'a' : 'r')
