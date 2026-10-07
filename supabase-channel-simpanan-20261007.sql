-- Siappa: simpanan Channel Penjualan, masa simpan 90 hari.
-- Tabel terpisah; tidak mengubah HPP, Daftar Harga, maupun Mitra Titip.
-- Akses hanya untuk pengguna yang sudah login, sesuai aplikasi sekarang.
begin;

create extension if not exists pg_cron with schema pg_catalog;

create table if not exists public.channel_penjualan_simpanan (
  id uuid primary key default gen_random_uuid(),
  nama text not null check (length(nama) between 1 and 100),
  asal text not null,
  tujuan text not null,
  items jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) > 0),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '90 days'),
  constraint channel_penjualan_rute_valid check (
    (asal = 'ibusiapa' and tujuan in ('kongsiapa', 'konsinyasi', 'reseller')) or
    (asal = 'kongsiapa' and tujuan in ('konsinyasi', 'reseller'))
  )
);
create index if not exists channel_penjualan_simpanan_expiry
  on public.channel_penjualan_simpanan (expires_at);
create index if not exists channel_penjualan_simpanan_created
  on public.channel_penjualan_simpanan (created_at desc);

-- Waktu dibuat dan kedaluwarsa ditentukan server, bukan jam perangkat.
create or replace function public.channel_penjualan_set_retention()
returns trigger language plpgsql set search_path = '' as $$
declare item jsonb;
begin
  if jsonb_typeof(new.items) is distinct from 'array' or jsonb_array_length(new.items) = 0 then
    raise exception 'Isi perhitungan tidak boleh kosong';
  end if;
  for item in select value from jsonb_array_elements(new.items) loop
    if jsonb_typeof(item->'namaVarian') is distinct from 'string' or
       jsonb_typeof(item->'qty') is distinct from 'number' or
       jsonb_typeof(item->'hargaAsal') is distinct from 'number' or
       jsonb_typeof(item->'hargaTujuan') is distinct from 'number' then
      raise exception 'Nama, kuantitas, dan harga varian harus lengkap';
    end if;
    if (item->>'qty')::numeric <= 0 or (item->>'hargaAsal')::numeric <= 0 or (item->>'hargaTujuan')::numeric <= 0 then
      raise exception 'Kuantitas dan harga harus lebih dari 0';
    end if;
  end loop;
  new.created_at := now();
  new.expires_at := new.created_at + interval '90 days';
  new.created_by := auth.uid();
  return new;
end;
$$;
drop trigger if exists channel_penjualan_retention on public.channel_penjualan_simpanan;
create trigger channel_penjualan_retention before insert on public.channel_penjualan_simpanan
  for each row execute function public.channel_penjualan_set_retention();

alter table public.channel_penjualan_simpanan enable row level security;
revoke all on public.channel_penjualan_simpanan from public, anon, authenticated;
grant select, insert on public.channel_penjualan_simpanan to authenticated;
drop policy if exists "login baca simpanan aktif" on public.channel_penjualan_simpanan;
create policy "login baca simpanan aktif" on public.channel_penjualan_simpanan
  for select to authenticated using (auth.uid() is not null and expires_at > now());
drop policy if exists "login simpan perhitungan" on public.channel_penjualan_simpanan;
create policy "login simpan perhitungan" on public.channel_penjualan_simpanan
  for insert to authenticated with check (created_by = auth.uid());

-- Hanya menghapus simpanan fitur ini yang sudah kedaluwarsa.
-- Tetap berjalan walaupun Siappa tidak dibuka. RLS langsung menyembunyikan
-- simpanan setelah 90 hari; penghapusan fisik berjalan setiap menit.
select cron.schedule(
  'siappa-channel-simpanan-expiry', '* * * * *',
  $$delete from public.channel_penjualan_simpanan where expires_at <= now()$$
);
commit;

-- Bukti pemasangan: nama job, status aktif, jadwal dan kebijakan akses.
select jobname, schedule, active from cron.job where jobname = 'siappa-channel-simpanan-expiry';
select policyname, roles, cmd from pg_policies
  where schemaname = 'public' and tablename = 'channel_penjualan_simpanan';
