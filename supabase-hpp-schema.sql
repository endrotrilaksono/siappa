-- ============================================================
-- SIAPPA — Modul HPP (tambahan)
-- Jalankan di: Supabase Dashboard > SQL Editor > New Query > Run
-- Skema konten yang lama TIDAK terpengaruh.
-- ============================================================

drop table if exists hpp_variants cascade;
drop table if exists hpp_batches cascade;

-- ---------- BATCH ----------
create table hpp_batches (
  id uuid primary key default gen_random_uuid(),
  nama_produk text not null default 'Tanpa nama',
  total_kg numeric default 0,          -- total ikan diproses (kg)
  harga_ikan numeric default 0,        -- Rp per kg
  biaya_bumbu numeric default 0,       -- Rp per kg
  legacy_id text,                      -- id lama dari Apps Script (untuk migrasi)
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ---------- VARIAN ----------
-- CATATAN: hanya INPUT yang disimpan. Semua nilai turunan (HPP, harga jual,
-- untung, margin) dihitung ulang di app. Supaya kalau rumus diperbaiki,
-- riwayat lama ikut terkoreksi, bukan menyimpan angka usang.
create table hpp_variants (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references hpp_batches(id) on delete cascade,
  urutan int not null default 1,
  ukuran_target numeric default 0,     -- gram
  jumlah_pack numeric default 0,
  kelebihan numeric default 0,         -- gram, kelebihan timbang rata-rata
  packaging numeric default 0,         -- Rp per pack
  label numeric default 0,             -- Rp per pack
  lainnya numeric default 0,           -- Rp per pack
  margin_ec numeric default 25,        -- % end customer
  margin_mis numeric default 15,       -- % MIS/reseller
  harga_real numeric default 0,        -- Rp, opsional
  created_at timestamptz default now()
);

create index idx_hpp_variants_batch on hpp_variants(batch_id);
create index idx_hpp_batches_created on hpp_batches(created_at desc);

-- ---------- RLS ----------
-- MVP tanpa auth (sesuai keputusan). CATATAN KEAMANAN: siapa pun yang tahu
-- URL + anon key bisa membaca struktur biaya. Pasang Supabase Auth sebelum
-- URL dibagikan ke luar lingkaran internal.
alter table hpp_batches enable row level security;
alter table hpp_variants enable row level security;

create policy "allow all hpp_batches" on hpp_batches for all using (true) with check (true);
create policy "allow all hpp_variants" on hpp_variants for all using (true) with check (true);
