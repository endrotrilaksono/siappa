export const CHANNEL_LABELS = { ibusiapa: 'Ibu Siapa', kongsiapa: 'Kongsiapa', konsinyasi: 'Konsinyasi', reseller: 'Reseller' }
export const DESTINATIONS = {
  ibusiapa: ['kongsiapa', 'konsinyasi', 'reseller'],
  kongsiapa: ['konsinyasi', 'reseller'],
}
export const ORIGINS = ['ibusiapa', 'kongsiapa']

export function channelTotals(items) {
  let penjualan = 0, modal = 0
  for (const item of items) {
    const qty = Number(item.qty)
    const from = Number(item.hargaAsal)
    const to = Number(item.hargaTujuan)
    if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(from) || from <= 0 || !Number.isFinite(to) || to <= 0) {
      throw new Error('Lengkapi semua varian, harga dan kuantitas sebelum menyimpan atau export.')
    }
    penjualan += to * qty
    modal += from * qty
  }
  if (!items.length || !Number.isFinite(penjualan) || !Number.isFinite(modal)) {
    throw new Error('Perhitungan belum lengkap atau angkanya terlalu besar.')
  }
  return { penjualan, modal, untung: penjualan - modal }
}

// Salinan nilai saat disimpan: tidak bergantung pada varian yang mungkin
// berubah ID / dihapus saat batch HPP diedit belakangan.
export function snapshotChannel(nama, asal, tujuan, evaluated) {
  if (!DESTINATIONS[asal]?.includes(tujuan) || evaluated.some(r => !r.lengkap || !r.row)) {
    throw new Error('Lengkapi semua baris sebelum menyimpan atau export.')
  }
  const items = evaluated.map(r => ({
    variantId: r.variantId,
    namaVarian: r.row.label,
    qty: Number(r.qty),
    hargaAsal: r.hargaAsal,
    hargaTujuan: r.hargaTujuan,
  }))
  channelTotals(items)
  return { nama: nama.trim().slice(0, 100) || 'Perhitungan Channel Penjualan', asal, tujuan, items }
}

export function isActiveSaved(saved, now = Date.now()) {
  return Date.parse(saved.expires_at) > now
}

export function exportFilename(nama, now = new Date(), unique = crypto.randomUUID()) {
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
  const time = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`
  const label = nama.normalize('NFKD').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'perhitungan'
  return `siappa-channel-${label}-${date}-${time}-${unique}.xlsx`
}
