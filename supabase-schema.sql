-- ============================================================
-- KONTEN OS — Skema Database Supabase
-- Jalankan seluruh isi file ini di: Supabase Dashboard > SQL Editor > New Query > Run
-- ============================================================

-- Bersihkan jika sudah ada (aman dijalankan ulang saat development)
drop table if exists performance cascade;
drop table if exists content_parts cascade;
drop table if exists contents cascade;
drop table if exists platforms cascade;
drop table if exists brands cascade;

-- ---------- BRAND ----------
create table brands (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  color text default '#0f1499',
  created_at timestamptz default now()
);

-- ---------- PLATFORM ----------
create table platforms (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  char_limit int,
  unit text default 'post',           -- 'thread' | 'carousel' | 'video' | 'post'
  created_at timestamptz default now()
);

-- ---------- KONTEN ----------
create table contents (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references brands(id) on delete cascade,
  platform_id uuid references platforms(id) on delete cascade,
  title text not null,
  content_type text,                  -- edukasi | engagement | soft-sell | fakta | quotes | menu | dll
  format text default 'single',       -- single | carousel | thread
  goal text default 'awareness',      -- awareness | engagement | leads | conversion
  scheduled_date date,
  scheduled_time time,
  status text default 'draft',        -- draft | scheduled | posted | skipped
  skip_reason text,
  posted_at timestamptz,
  caption text,
  hashtags text,
  notes text,
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ---------- BAGIAN KONTEN (slide carousel / post dalam thread) ----------
create table content_parts (
  id uuid primary key default gen_random_uuid(),
  content_id uuid references contents(id) on delete cascade,
  part_order int not null default 1,
  text text,
  visual_type text default 'desain_teks',  -- foto_asli | foto_stok | ai | desain_teks
  visual_note text,                          -- arahan grafik
  ai_prompt text,                            -- prompt AI jika visual_type = ai
  created_at timestamptz default now()
);

-- ---------- PERFORMA ----------
create table performance (
  id uuid primary key default gen_random_uuid(),
  content_id uuid references contents(id) on delete cascade unique,
  likes int default 0,
  replies int default 0,
  shares int default 0,
  saves int default 0,
  wa_clicks int default 0,
  notes text,
  updated_at timestamptz default now()
);

-- ---------- INDEX ----------
create index idx_contents_platform on contents(platform_id);
create index idx_contents_brand on contents(brand_id);
create index idx_contents_status on contents(status);
create index idx_parts_content on content_parts(content_id);

-- ============================================================
-- RLS (Row Level Security)
-- MVP internal single-user: pakai anon key + kebijakan izinkan semua.
-- CATATAN KEAMANAN: ini membuat data bisa dibaca/tulis siapa saja yang
-- punya anon key + URL. Untuk internal tim kecil ini OK. Saat app dibuka
-- lebih luas, ganti dengan auth Supabase + policy per-user.
-- ============================================================
alter table brands enable row level security;
alter table platforms enable row level security;
alter table contents enable row level security;
alter table content_parts enable row level security;
alter table performance enable row level security;

create policy "allow all brands" on brands for all using (true) with check (true);
create policy "allow all platforms" on platforms for all using (true) with check (true);
create policy "allow all contents" on contents for all using (true) with check (true);
create policy "allow all parts" on content_parts for all using (true) with check (true);
create policy "allow all performance" on performance for all using (true) with check (true);

-- ============================================================
-- SEED DATA
-- ============================================================

-- Brand (khusus Ibu Siapa; tabel dipertahankan untuk pengembangan ekosistem Siappa)
insert into brands (slug, name, color) values
  ('ibu_siapa', 'Ibu Siapa', '#0f1499');

-- Platform
insert into platforms (slug, name, char_limit, unit) values
  ('threads', 'Threads', 500, 'thread'),
  ('instagram', 'Instagram', 2200, 'carousel'),
  ('tiktok', 'TikTok', 2200, 'video');

-- ---------- SEED KONTEN THREADS (Ibu Siapa) ----------
-- Ambil id brand & platform
do $$
declare
  b_ibusiapa uuid;
  p_threads uuid;
  p_ig uuid;
  c_id uuid;
begin
  select id into b_ibusiapa from brands where slug = 'ibu_siapa';
  select id into p_threads from platforms where slug = 'threads';
  select id into p_ig from platforms where slug = 'instagram';

  -- THREADS: Sabtu — beku vs kanginan
  insert into contents (brand_id, platform_id, title, content_type, format, goal, scheduled_date, scheduled_time, status, caption, sort_order)
  values (b_ibusiapa, p_threads, 'Ikan beku vs ikan kanginan', 'edukasi', 'thread', 'awareness', '2026-07-25', '06:00', 'posted', null, 1)
  returning id into c_id;
  insert into content_parts (content_id, part_order, text, visual_type) values
    (c_id, 1, 'Mbak Buk, mana yang lebih segar: ikan beku, atau ikan di lapak yang sejak subuh kena angin? Kebanyakan orang jawab yang kedua. Padahal yang menentukan kesegaran bukan bentuknya. Tapi suhunya.', 'desain_teks'),
    (c_id, 2, 'Ikan yang digelar di suhu ruang itu tidak sedang menunggu pembeli. Dia sedang rusak, pelan-pelan.', 'desain_teks'),
    (c_id, 3, 'Khusus kembung, tongkol, tuna: terlalu lama di suhu hangat, muncul histamin. Digoreng sampai kering pun tidak hilang.', 'desain_teks'),
    (c_id, 4, 'Pembekuan sebaliknya. Di -18C, kualitas ikan terkunci di titik saat dibekukan.', 'desain_teks'),
    (c_id, 5, 'Pertanyaannya bukan beku atau segar. Tapi: ikan ini sudah berapa jam di suhu ruang sebelum sampai ke dapur saya?', 'desain_teks');

  -- THREADS: Minggu pagi — santai
  insert into contents (brand_id, platform_id, title, content_type, format, goal, scheduled_date, scheduled_time, status, sort_order)
  values (b_ibusiapa, p_threads, 'Weekend nggak harus rajin', 'engagement', 'thread', 'engagement', '2026-07-26', '06:00', 'draft', 2)
  returning id into c_id;
  insert into content_parts (content_id, part_order, text, visual_type) values
    (c_id, 1, 'Minggu itu bukan waktunya masak ribet, Mbak Buk. Waktunya rebahan, lanjut drakor, biarkan dapur istirahat. Menu versi aku: dari freezer langsung ke wajan. Fillet dori tinggal potong, lele marinasi tinggal goreng. Weekend nggak harus jadi ibu yang rajin. Cukup jadi ibu yang kenyang dan santai.', 'desain_teks');

  -- IG: beku vs kanginan carousel
  insert into contents (brand_id, platform_id, title, content_type, format, goal, scheduled_date, scheduled_time, status, caption, hashtags, sort_order)
  values (b_ibusiapa, p_ig, 'Beku vs Kanginan (carousel)', 'edukasi', 'carousel', 'awareness', '2026-07-27', '06:00', 'draft',
    'Mbak Buk, mana yang lebih segar: ikan beku, atau ikan yang kanginan dari subuh? Geser sampai habis, ini bakal ngubah cara milih ikan. Simpan & share ke yang masih ragu. Frozen seafood Kertosono & sekitarnya — link di bio.',
    '#frozenfood #ikanbeku #tipsdapur #ibusiapa #kertosono', 1)
  returning id into c_id;
  insert into content_parts (content_id, part_order, text, visual_type, visual_note, ai_prompt) values
    (c_id, 1, 'mana yang lebih segar — ikan beku, atau ikan yang kanginan dari subuh?', 'foto_stok', 'Foto pasar/lapak ikan sebagai latar, teks putih overlay, highlight biru pada kata beku & kanginan', null),
    (c_id, 2, 'Ikan di suhu ruang nggak nunggu pembeli. Dia lagi rusak, pelan-pelan.', 'desain_teks', 'Latar krem polos, teks besar, highlight biru pada kata rusak', null),
    (c_id, 3, 'Khusus kembung, tongkol, tuna: muncul histamin. Digoreng pun tidak hilang.', 'ai', 'Ikon peringatan sederhana di atas latar krem', 'Minimalist flat vector warning icon, fish silhouette, cream background #fffceb, deep blue #0f1499 lines, no text, clean editorial, 4:5 ratio'),
    (c_id, 4, 'Dibekukan -18C kebalikannya. Kualitas ikan terkunci di hari pertama.', 'ai', 'Ilustrasi termometer + kristal es', 'Minimalist flat vector illustration, snowflake and thermometer showing minus 18 celsius, simple line art, cream background #fffceb, deep blue #0f1499 line color, no text, 4:5 ratio'),
    (c_id, 5, 'Dibekukan sejak awal. Nggak pernah mencair di jalan. Ibu Siapa — link di bio.', 'foto_asli', 'FOTO ASLI kemasan produk Ibu Siapa. Wajib asli, jangan AI.', null);

  -- IG: kembung dimasak apa aja
  insert into contents (brand_id, platform_id, title, content_type, format, goal, scheduled_date, scheduled_time, status, caption, hashtags, sort_order)
  values (b_ibusiapa, p_ig, 'Kembung marinasi bisa dimasak apa aja', 'menu', 'carousel', 'leads', '2026-07-28', '13:00', 'draft',
    'Minggu ini paling cepat habis: kembung marinasi. Bumbunya udah meresap dari sananya, tinggal masak. Yang di Kertosono & sekitarnya — WA admin, ambil di tempat, sampai maps. Link di bio.',
    '#kembungmarinasi #ikanmarinasi #frozenfood #ibusiapa #kertosono #laukpraktis', 2)
  returning id into c_id;
  insert into content_parts (content_id, part_order, text, visual_type, visual_note, ai_prompt) values
    (c_id, 1, 'beli kembung marinasi, terus bisa dimasak apa aja? 3 cara, geser.', 'foto_asli', 'FOTO ASLI kemasan kembung marinasi. Highlight biru pada apa aja.', null),
    (c_id, 2, '1 — Goreng kering. Api sedang, jangan dibolak-balik. Satu sisi garing dulu baru balik.', 'foto_asli', 'FOTO ASLI kembung digoreng.', null),
    (c_id, 3, '2 — Panggang teflon tanpa minyak. Buat yang mau lebih ringan. Kulit tetap garing.', 'ai', 'Ilustrasi ide penyajian (bukan klaim foto produk)', 'Appetizing grilled mackerel on a black teflon pan, home kitchen, warm natural light, top-down, illustrative food styling, 4:5 ratio'),
    (c_id, 4, '3 — Suwir buat nasi goreng / sambal. Sisa kemarin jadi lauk baru. Ibu Siapa — link di bio.', 'ai', 'Ilustrasi nasi goreng ikan suwir', 'Indonesian fried rice with shredded fish, home style, warm light, top-down, illustrative food styling, appetizing, 4:5 ratio');

  -- IG: fakta satu slide
  insert into contents (brand_id, platform_id, title, content_type, format, goal, scheduled_date, scheduled_time, status, caption, hashtags, sort_order)
  values (b_ibusiapa, p_ig, 'Fakta: Frozen bukan berarti tidak segar', 'fakta', 'single', 'engagement', '2026-07-29', '13:00', 'draft',
    'Mitos yang paling sering kami dengar. Simpan biar inget pas belanja.',
    '#frozenfood #faktaikan #ibusiapa #kertosono', 3)
  returning id into c_id;
  insert into content_parts (content_id, part_order, text, visual_type, visual_note) values
    (c_id, 1, 'Frozen bukan berarti tidak segar. Ikan yang dibekukan cepat justru lebih terjaga daripada ikan segar yang keliling pasar seharian. Yang bikin turun kualitas: waktu + suhu hangat. Bukan pembekuannya.', 'desain_teks', 'Tipografi besar, highlight biru pada tanda tidak-sama-dengan, latar krem, logo pojok. Gaya kartu fakta.');

end $$;

-- Baris performa kosong untuk tiap konten
insert into performance (content_id)
select id from contents
on conflict (content_id) do nothing;
