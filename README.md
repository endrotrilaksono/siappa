# Siappa — Super App Ibu Siapa

Manajemen konten media sosial (Threads / Instagram / TikTok) untuk Ibu Siapa.
Stack: Vite + React + Supabase + Vercel. Ini fondasi awal super app "Siappa".

## Modul
- **Konten** — manajemen konten medsos (Threads / Instagram / TikTok)
- **HPP** — kalkulator batch & harga jual (migrasi dari Apps Script)

Navigasi lewat ikon hamburger (☰) di pojok kiri atas.

## Fitur Konten
- Tab per platform: Threads, Instagram, TikTok
- Daftar konten dengan naskah lengkap (slide carousel / post thread)
- Arahan grafik + prompt AI per slide
- Caption + hashtag, tombol salin
- Kontrol status: draft / posted / skipped (+ alasan), jam posting
- Input performa: likes, balasan, share, save, klik WA
- Semua tersimpan ke Supabase (baca-tulis real-time)
- Mode pilih (☑) untuk hapus banyak konten sekaligus
- PWA: bisa di-install ke home screen HP

## Fitur HPP
- Rumus IDENTIK dengan kalkulator Apps Script lama (terverifikasi 77 titik banding, nol selisih)
- Bahan baku + varian produksi tanpa batas
- Output: HPP/pack, harga jual End Customer & MIS/Reseller, margin real
- Riwayat batch tersimpan di Supabase, bisa dimuat ulang ke form
- Export CSV
- Import riwayat lama dari spreadsheet Apps Script (paste JSON)

### Catatan penting HPP
- Hanya INPUT yang disimpan di database. Nilai turunan (HPP, harga jual, untung)
  dihitung ulang saat ditampilkan — supaya perbaikan rumus ikut mengoreksi riwayat lama.
- HPP TIDAK memasukkan biaya tenaga kerja, listrik, dan penyusutan freezer.
  Ini mengikuti kalkulator lama. Pertimbangkan menambahkannya sebelum skala membesar.

## BELUM termasuk (fase 2)
- Editor upload foto + drag teks + highlight biru
- Tambah/hapus konten dari dalam app (sementara lewat Supabase / seed SQL)
- Auth multi-user (sekarang single-user pakai anon key)
- Lini/brand lain (tabel brand disiapkan di DB, tapi hanya diisi Ibu Siapa)

## Cara setup

### 1. Install
```
npm install
```

### 2. Isi credential Supabase
```
cp .env.example .env.local
```
Buka `.env.local`, isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY
(dari Supabase Dashboard > Project Settings > API).

### 3. Buat tabel + seed data
Jalankan DUA file SQL (urut):
1. `supabase-schema.sql` — tabel konten
2. `supabase-hpp-schema.sql` — tabel HPP

Detail:
Supabase Dashboard > SQL Editor > New Query.
Copy seluruh isi `supabase-schema.sql`, paste, Run.
Membuat semua tabel + mengisi 5 konten Ibu Siapa (2 Threads + 3 IG).

### 4. Jalankan
```
npm run dev
```
Buka http://localhost:5173

### 5. Deploy ke Vercel
- Push ke GitHub
- Import repo di Vercel
- Tambahkan Environment Variables di Vercel: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
- Deploy

## ⚠️ UTANG TEKNIS: AUTH BELUM DIPASANG
Modul HPP berisi data paling sensitif: harga beli, margin, struktur biaya.
Di Apps Script, data ini terlindungi login Google. Di Siappa saat ini TIDAK ada login —
siapa pun yang tahu URL bisa membukanya.

Ini keputusan sadar untuk mempercepat MVP. Sebelum URL dibagikan ke luar
lingkaran internal, pasang Supabase Auth (email + password).

## Catatan keamanan
MVP pakai anon key + RLS "izinkan semua" — cocok untuk pemakaian internal.
Sebelum dibuka lebih luas, ganti dengan Supabase Auth + policy per-user.
Gunakan project Supabase BARU khusus Siappa, terpisah dari app lain.


### Simpan dan Export Excel — Channel Penjualan (2026-10-07)

Lengkapi semua baris, lalu gunakan Simpan atau Export Excel. Nama perhitungan
opsional. Perhitungan Tersimpan bisa dibuka dan diexport dari perangkat lain
setelah login. Harga, nama varian, kuantitas, dan hasil disalin saat disimpan;
perubahan atau penghapusan varian HPP tidak mengubah simpanan lama.

Simpanan kedaluwarsa 90 hari sejak waktu server saat dibuat. RLS menyembunyikan
simpanan yang kedaluwarsa, dan job Supabase Cron menghapusnya setiap menit,
termasuk ketika aplikasi tidak dibuka. File Excel yang sudah diunduh tidak
terpengaruh. Pembersihan hanya menyentuh channel_penjualan_simpanan.

Untuk pemasangan baru, jalankan supabase-channel-simpanan-20261007.sql di
proyek Supabase Siappa sebelum deploy kode. Script ini memasang pg_cron,
tabel terpisah, validasi input, RLS wajib login, dan jadwal pembersihan.
Dokumentasi Cron: https://supabase.com/docs/guides/cron/quickstart

Verifikasi hitungan, snapshot, export .xlsx, dan batas expiry:
`node --test tests/channelPenjualan-20261007.test.js`.
