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
    const konsinyasi = calcJalur(hpp, nv(v.margin_konsinyasi), nv(v.harga_real_konsinyasi))
    const ec = calcJalur(hpp, nv(v.margin_ec), nv(v.harga_real))

    ;[kongsiapa, reseller, konsinyasi, ec].forEach(j => {
      j.untungRealTotal = j.untungReal !== null ? j.untungReal * ju : null
    })

    const rK = nv(v.harga_real_kongsiapa)
    const rE = nv(v.harga_real)
    const marginKongsiapaKeEcReal = (rK > 0 && rE > 0) ? ((rE - rK) / rE) * 100 : null
    const selisihKongsiapaKeEcReal = (rK > 0 && rE > 0) ? (rE - rK) : null

    const rKons = nv(v.harga_real_konsinyasi)
    const marginKongsiapaKeKonsinyasiReal = (rK > 0 && rKons > 0) ? ((rKons - rK) / rKons) * 100 : null
    const selisihKongsiapaKeKonsinyasiReal = (rK > 0 && rKons > 0) ? (rKons - rK) : null

    return {
      ef, ju, hI, hK, hpp, jalur: { kongsiapa, reseller, konsinyasi, ec },
      marginKongsiapaKeEcReal, selisihKongsiapaKeEcReal,
      marginKongsiapaKeKonsinyasiReal, selisihKongsiapaKeKonsinyasiReal,
    }
  })

  return { mo, tg, yr, C }
}

export const yieldClass = yr => (yr >= 70 ? 'g' : yr >= 55 ? 'a' : 'r')
export const marginClass = m => (m >= 25 ? 'g' : m >= 10 ? 'a' : 'r')
