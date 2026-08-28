// ============================================================
// MESIN HITUNG HPP
// Rumus dasar (HPP, EC, MIS) DISALIN PERSIS dari kalkulator lama.
// Jangan diubah tanpa verifikasi ulang terhadap batch lama.
//
// TAMBAHAN v7: jalur Kongsiapa (divisi mudharabah).
// - Margin HPP -> Kongsiapa: INPUT bebas dari user.
// - Harga Kongsiapa: dihitung dari HPP dan margin itu, rumus sama
//   persis seperti EC/MIS (HPP / (1 - margin%)).
// - EC TIDAK BERUBAH sama sekali. Tetap dihitung langsung dari HPP,
//   tidak peduli ada jalur Kongsiapa atau tidak. Ini aturan mutlak,
//   EC harus identik antara dilihat dari Ibu Siapa atau dari Kongsiapa.
// - Margin Kongsiapa -> EC: BUKAN input, murni angka informasi hasil
//   hitung mundur, selisih antara EC dan Harga Kongsiapa. Menunjukkan
//   markup tersirat kalau Kongsiapa jual di harga EC yang sama.
// - Harga real sekarang ADA DUA, terpisah: harga real EC (kolom lama,
//   harga_real) dan harga real Kongsiapa (kolom baru, harga_real_kongsiapa).
//   Margin real masing-masing dihitung terhadap HPP (bukan terhadap
//   harga target), sama seperti logika margin real EC yang sudah ada.
// ============================================================

export const nv = v => parseFloat(v) || 0
export const rp = v => 'Rp ' + Math.round(v).toLocaleString('id-ID')
export const gr = v => Math.round(v).toLocaleString('id-ID') + ' g'
export const pc = v => (+v).toFixed(1) + '%'

/**
 * @param {{total_kg,harga_ikan,biaya_bumbu}} base
 * @param {Array} vars - {ukuran_target,jumlah_pack,kelebihan,packaging,label,lainnya,
 *                         margin_ec,margin_mis,harga_real,
 *                         margin_kongsiapa,harga_real_kongsiapa}
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

    // EC dan MIS: rumus lama, tidak berubah
    const mec = nv(v.margin_ec)
    const mmis = nv(v.margin_mis)
    const ec = mec < 100 ? hpp / (1 - mec / 100) : hpp
    const ms = mmis < 100 ? hpp / (1 - mmis / 100) : hpp

    const real = nv(v.harga_real)
    const mR = real > 0 ? ((real - hpp) / real) * 100 : null

    const uec = ec - hpp
    const ums = ms - hpp

    // ---------- KONGSIAPA (baru) ----------
    const mkongsiapa = nv(v.margin_kongsiapa)
    const hargaKongsiapa = mkongsiapa < 100 ? hpp / (1 - mkongsiapa / 100) : hpp
    const ukongsiapa = hargaKongsiapa - hpp
    const ukongsiapaTotal = ukongsiapa * ju

    // Margin Kongsiapa -> EC: informasi saja, bukan input. Selisih EC
    // dan Harga Kongsiapa, dibagi EC. Kalau EC belum kehitung (0), null.
    const marginKongsiapaKeEc = ec > 0 ? ((ec - hargaKongsiapa) / ec) * 100 : null

    const realKongsiapa = nv(v.harga_real_kongsiapa)
    const mRKongsiapa = realKongsiapa > 0 ? ((realKongsiapa - hpp) / realKongsiapa) * 100 : null
    const uRKongsiapa = realKongsiapa > 0 ? realKongsiapa - hpp : null
    const uRKongsiapaTotal = realKongsiapa > 0 ? (realKongsiapa - hpp) * ju : null

    return {
      ef, ju, hI, hK, hpp, ec, ms,
      uec, uect: uec * ju,
      ums, umst: ums * ju,
      uR: real > 0 ? real - hpp : null,
      uRt: real > 0 ? (real - hpp) * ju : null,
      mR,
      // kongsiapa
      hargaKongsiapa, ukongsiapa, ukongsiapaTotal, marginKongsiapaKeEc,
      mRKongsiapa, uRKongsiapa, uRKongsiapaTotal,
    }
  })

  return { mo, tg, yr, C }
}

export const yieldClass = yr => (yr >= 70 ? 'g' : yr >= 55 ? 'a' : 'r')
export const marginClass = m => (m >= 25 ? 'g' : m >= 10 ? 'a' : 'r')
