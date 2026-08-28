-- ============================================================
-- SIAPPA — Tambahan v7: Jalur Kongsiapa + Komponen HPP
-- Jalankan di: Supabase Dashboard > SQL Editor > New Query > Run
-- Ini TAMBAHAN, bukan drop/recreate. Data lama di hpp_batches dan
-- hpp_variants TIDAK terhapus, TIDAK perlu migrasi.
-- ============================================================

-- ---------- Tambah kolom Kongsiapa ke hpp_variants ----------
alter table hpp_variants
  add column if not exists margin_kongsiapa numeric default 20,
  add column if not exists harga_real_kongsiapa numeric default 0;

-- Batch/varian lama otomatis dapat margin_kongsiapa = 20 dan
-- harga_real_kongsiapa = 0 (kosong). Tidak mengganggu data HPP/EC/MIS
-- yang sudah ada.

-- ---------- Tabel Komponen HPP (master kemasan & harga) ----------
create table if not exists hpp_components (
  id uuid primary key default gen_random_uuid(),
  nama text not null,              -- mis: "Plastik Vacuum 15x25"
  spek text,                       -- mis: "15x25 cm, 0.08mm" (opsional)
  harga_per_pcs numeric default 0, -- Rp
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table hpp_components enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'hpp_components' and policyname = 'allow all hpp_components'
  ) then
    create policy "allow all hpp_components" on hpp_components for all using (true) with check (true);
  end if;
end $$;

-- Seed contoh (boleh dihapus/diedit lewat app setelah ini jalan)
insert into hpp_components (nama, spek, harga_per_pcs) values
  ('Plastik Vacuum 15x25', '15x25 cm', 350),
  ('Plastik Vacuum 20x30', '20x30 cm', 500),
  ('Label Stiker', '5x13 cm', 200)
on conflict do nothing;
