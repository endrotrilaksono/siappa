import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as XLSX from 'xlsx'
import { channelTotals, snapshotChannel, isActiveSaved, exportFilename } from '../src/lib/channelPenjualan.js'
import { buildChannelWorkbook } from '../src/lib/channelExcel.js'

const evaluated = () => [
  { variantId: 'a', row: { label: 'Udang 235g' }, qty: '3', hargaAsal: 15000.25, hargaTujuan: 21000, lengkap: true },
  { variantId: 'b', row: { label: 'Ikan 435g' }, qty: '2', hargaAsal: 25000.75, hargaTujuan: 35000, lengkap: true },
]
const snapshot = () => snapshotChannel('Pesanan mitra', 'ibusiapa', 'konsinyasi', evaluated())

test('dua produk: jumlah harga total = penjualan; pecahan HPP tetap utuh', () => {
  assert.deepEqual(channelTotals(snapshot().items), { penjualan: 133000, modal: 95002.25, untung: 37997.75 })
})
test('baris kosong, harga kosong, rute tidak valid, dan qty tidak valid ditolak seluruhnya', () => {
  assert.throws(() => channelTotals([]))
  for (const qty of ['', 0, -1, 'abc', Infinity]) assert.throws(() => channelTotals([{ qty, hargaAsal: 100, hargaTujuan: 200 }]))
  assert.throws(() => channelTotals([{ qty: 1, hargaAsal: 0, hargaTujuan: 200 }]))
  assert.throws(() => channelTotals([{ qty: 1, hargaAsal: 100, hargaTujuan: null }]))
  assert.throws(() => snapshotChannel('x', 'ibusiapa', 'ec', evaluated()))
  assert.throws(() => snapshotChannel('x', 'ibusiapa', 'konsinyasi', [...evaluated(), { lengkap: false }]))
})
test('perhitungan rugi tetap tampil dengan untung negatif', () => {
  assert.equal(channelTotals([{ qty: 2, hargaAsal: 20000, hargaTujuan: 15000 }]).untung, -10000)
})
test('snapshot tidak ikut berubah saat nama dan harga Daftar Harga berubah', () => {
  const rows = evaluated()
  const saved = snapshotChannel('x', 'kongsiapa', 'reseller', rows)
  rows[0].row.label = 'Nama baru'; rows[0].hargaTujuan = 100000; rows[0].qty = 20
  assert.equal(saved.items[0].namaVarian, 'Udang 235g')
  assert.equal(saved.items[0].hargaTujuan, 21000)
  assert.equal(saved.items[0].qty, 3)
})
test('simpanan tidak aktif tepat pada batas kedaluwarsa', () => {
  const saved = { expires_at: '2027-01-05T12:00:00Z' }
  const cutoff = Date.parse(saved.expires_at)
  assert.equal(isActiveSaved(saved, cutoff - 1), true)
  assert.equal(isActiveSaved(saved, cutoff), false)
  assert.equal(isActiveSaved(saved, cutoff + 1), false)
})
test('file Excel nyata bisa dibaca kembali; angka dan rumus cocok dengan layar', () => {
  const wb = buildChannelWorkbook(snapshot())
  const read = XLSX.read(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }), { type: 'buffer', cellFormula: true })
  const products = read.Sheets.Produk, summary = read.Sheets.Ringkasan
  assert.equal(products.G2.v + products.G3.v, summary.B8.v)
  assert.equal(products.F2.v + products.F3.v, summary.B9.v)
  assert.equal(summary.B10.v, summary.B8.v - summary.B9.v)
  assert.equal(summary.B8.v, 133000)
  assert.equal(products.D2.v, 15000.25)
  assert.equal(products.G4.f, 'SUM(G2:G3)')
  assert.equal(summary.B8.f, 'Produk!G4')
})
test('nama bebas ditulis sebagai teks Excel, bukan rumus', () => {
  const data = snapshot()
  data.items[0].namaVarian = '=HYPERLINK("https://example.com","x")'
  const cell = buildChannelWorkbook(data).Sheets.Produk.B2
  assert.equal(cell.t, 's'); assert.equal(cell.f, undefined)
})
test('nama file bertanggal dan unik meskipun diexport di detik yang sama', () => {
  const date = new Date(2026, 9, 7, 14, 10, 30)
  assert.equal(exportFilename('Pesanan / Mitra?', date, 'uuid-a'), 'siappa-channel-Pesanan-Mitra-20261007-141030-uuid-a.xlsx')
  assert.notEqual(exportFilename('x', date, 'uuid-a'), exportFilename('x', date, 'uuid-b'))
})
