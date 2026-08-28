-- ============================================================
-- SIAPPA — Kunci RLS, wajib login (Auth)
-- Jalankan di: Supabase Dashboard > SQL Editor > New Query > Run
--
-- SEBELUM ini: semua tabel pakai "using (true)" alias siapa saja yang
-- pegang URL + anon key bisa baca-tulis, tanpa login sama sekali.
-- Sekarang repo sudah public, ini gap yang harus ditutup.
--
-- SESUDAH ini: cuma user yang SUDAH LOGIN (auth.uid() ada isinya) yang
-- bisa akses. Belum bikin pembagian peran/hak akses granular per user,
-- semua user yang login diperlakukan sama (akses penuh ke semua data).
-- Itu cukup untuk tim kecil internal sekarang. Kalau nanti butuh, misal
-- staf cuma boleh isi status posting tapi tidak boleh lihat HPP, itu
-- perlu kerja tambahan lain kali.
-- ============================================================

drop policy if exists "allow all brands" on brands;
drop policy if exists "allow all platforms" on platforms;
drop policy if exists "allow all contents" on contents;
drop policy if exists "allow all parts" on content_parts;
drop policy if exists "allow all performance" on performance;
drop policy if exists "allow all hpp_batches" on hpp_batches;
drop policy if exists "allow all hpp_variants" on hpp_variants;
drop policy if exists "allow all hpp_components" on hpp_components;

create policy "wajib login brands" on brands for all
  using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "wajib login platforms" on platforms for all
  using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "wajib login contents" on contents for all
  using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "wajib login parts" on content_parts for all
  using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "wajib login performance" on performance for all
  using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "wajib login hpp_batches" on hpp_batches for all
  using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "wajib login hpp_variants" on hpp_variants for all
  using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "wajib login hpp_components" on hpp_components for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

-- ============================================================
-- LANGKAH MANUAL YANG HARUS DILAKUKAN DI SUPABASE DASHBOARD
-- (tidak bisa lewat SQL, harus klik manual):
--
-- 1. Authentication > Providers > Email > matikan "Allow new users to
--    sign up". Ini WAJIB, kalau tidak, siapa saja yang tahu URL app
--    bisa daftar sendiri dan otomatis dapat akses penuh.
--
-- 2. Authentication > Users > Add User > masukkan email + password
--    untuk tiap orang yang boleh akses (Endro, istri, staf, dst).
--    Ini cara nambah user, BUKAN lewat form signup di app.
-- ============================================================
