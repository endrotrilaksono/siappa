-- ============================================================
-- SIAPPA — Tambahan v9: harga real Reseller
-- Jalankan di: Supabase Dashboard > SQL Editor > New Query > Run
-- TAMBAHAN saja, tidak menghapus data lama.
-- ============================================================

-- Sebelumnya cuma EC dan Kongsiapa yang punya kolom harga real.
-- Reseller (kolom margin_mis) belum punya pasangan harga real-nya.
alter table hpp_variants
  add column if not exists harga_real_mis numeric default 0;

-- Batch/varian lama otomatis dapat harga_real_mis = 0 (kosong).
-- Tidak mengganggu data yang sudah ada.
