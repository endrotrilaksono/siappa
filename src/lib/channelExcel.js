import * as XLSX from 'xlsx'
import { CHANNEL_LABELS, channelTotals, exportFilename } from './channelPenjualan.js'

export function buildChannelWorkbook(snapshot) {
  const totals = channelTotals(snapshot.items)
  const wb = XLSX.utils.book_new()
  const summary = XLSX.utils.aoa_to_sheet([
    ['Siappa — Channel Penjualan'],
    ['Nama perhitungan', snapshot.nama],
    ['Dari', CHANNEL_LABELS[snapshot.asal]],
    ['Ke', CHANNEL_LABELS[snapshot.tujuan]],
    ['Disimpan / diexport', new Date(snapshot.created_at || Date.now()).toLocaleString('id-ID')],
    ['Berlaku sampai', snapshot.expires_at ? new Date(snapshot.expires_at).toLocaleString('id-ID') : 'Belum disimpan'],
    [],
    ['Total Penjualan Bersih', totals.penjualan],
    ['Harga Modal', totals.modal],
    ['Total Keuntungan', totals.untung],
    [],
    ['Harga adalah salinan saat perhitungan dibuat; tidak mengikuti perubahan Daftar Harga.'],
  ])
  const headers = ['No', 'Varian', 'Qty', 'Harga modal satuan (Rp)', 'Harga tujuan satuan (Rp)', 'Modal total (Rp)', 'Harga total (Rp)', 'Keuntungan (Rp)']
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...snapshot.items.map((r, i) => [
    i + 1, r.namaVarian, r.qty, r.hargaAsal, r.hargaTujuan,
    r.hargaAsal * r.qty, r.hargaTujuan * r.qty, (r.hargaTujuan - r.hargaAsal) * r.qty,
  ])])
  const end = snapshot.items.length + 1
  for (let row = 2; row <= end; row++) {
    sheet[`F${row}`].f = `C${row}*D${row}`
    sheet[`G${row}`].f = `C${row}*E${row}`
    sheet[`H${row}`].f = `G${row}-F${row}`
    for (const col of ['D', 'E', 'F', 'G', 'H']) sheet[`${col}${row}`].z = '#,##0.00'
  }
  XLSX.utils.sheet_add_aoa(sheet, [['TOTAL', '', '', '', '', totals.modal, totals.penjualan, totals.untung]], { origin: `A${end + 1}` })
  for (const col of ['F', 'G', 'H']) {
    sheet[`${col}${end + 1}`].f = `SUM(${col}2:${col}${end})`
    sheet[`${col}${end + 1}`].z = '#,##0.00'
  }
  summary.B8.f = `Produk!G${end + 1}`
  summary.B9.f = `Produk!F${end + 1}`
  summary.B10.f = 'B8-B9'
  for (const cell of ['B8', 'B9', 'B10']) summary[cell].z = '#,##0.00'
  summary['!cols'] = [{ wch: 29 }, { wch: 45 }]
  sheet['!cols'] = [{ wch: 6 }, { wch: 38 }, { wch: 9 }, ...Array.from({ length: 5 }, () => ({ wch: 25 }))]
  sheet['!autofilter'] = { ref: `A1:H${end}` }
  XLSX.utils.book_append_sheet(wb, summary, 'Ringkasan')
  XLSX.utils.book_append_sheet(wb, sheet, 'Produk')
  return wb
}

export function downloadChannelExcel(snapshot) {
  XLSX.writeFile(buildChannelWorkbook(snapshot), exportFilename(snapshot.nama))
}
