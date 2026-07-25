# Siappa — Super App Ibu Siapa

Manajemen konten media sosial (Threads / Instagram / TikTok) untuk Ibu Siapa.
Stack: Vite + React + Supabase + Vercel. Ini fondasi awal super app "Siappa".

## Fitur MVP (fase 1)
- Tab per platform: Threads, Instagram, TikTok
- Daftar konten dengan naskah lengkap (slide carousel / post thread)
- Arahan grafik + prompt AI per slide
- Caption + hashtag, tombol salin
- Kontrol status: draft / posted / skipped (+ alasan), jam posting
- Input performa: likes, balasan, share, save, klik WA
- Semua tersimpan ke Supabase (baca-tulis real-time)
- PWA: bisa di-install ke home screen HP

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

## Catatan keamanan
MVP pakai anon key + RLS "izinkan semua" — cocok untuk pemakaian internal.
Sebelum dibuka lebih luas, ganti dengan Supabase Auth + policy per-user.
Gunakan project Supabase BARU khusus Siappa, terpisah dari app lain.
