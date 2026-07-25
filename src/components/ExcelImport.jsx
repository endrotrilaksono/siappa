import { useState } from 'react'
import * as XLSX from 'xlsx'
import { importContents, getLookups } from '../lib/api'

// Kolom template — HARUS sama dengan yang diparse groupRows di bawah.
const TEMPLATE_HEADERS = ['content_key','platform','title','content_type','format','goal','date','time','caption','hashtags','slide_text','visual_type','visual_note','ai_prompt']

const TEMPLATE_EXAMPLE = [
  ['IG-CONTOH','instagram','Contoh: Beku vs Kanginan','edukasi','carousel','awareness','2026-08-04','06:00',
   'Caption contoh — isi di baris pertama saja.','#frozenfood #ibusiapa',
   'mana yang lebih segar — ikan beku atau ikan kanginan?','foto_stok','Foto lapak ikan, highlight biru pada beku & kanginan',''],
  ['IG-CONTOH','','','','','','','','','',
   'Ikan di suhu ruang lagi rusak pelan-pelan.','desain_teks','Latar krem, highlight biru pada rusak',''],
  ['IG-CONTOH','','','','','','','','','',
   'Dibekukan -18C, kualitas terkunci di hari pertama.','ai','Ilustrasi termometer + es',
   'Minimalist flat vector, snowflake and thermometer minus 18 celsius, cream background, deep blue lines, no text, 4:5'],
]

function downloadTemplate() {
  const wb = XLSX.utils.book_new()
  // Sheet Konten: header + contoh + beberapa baris kosong
  const aoa = [TEMPLATE_HEADERS, ...TEMPLATE_EXAMPLE]
  for (let i = 0; i < 15; i++) aoa.push(new Array(TEMPLATE_HEADERS.length).fill(''))
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = [13,11,22,13,10,12,12,8,30,20,34,13,28,34].map(w => ({ wch: w }))
  XLSX.utils.book_append_sheet(wb, ws, 'Konten')

  // Sheet Petunjuk
  const guide = [
    ['CARA PAKAI'],
    ['1. Satu BARIS = satu SLIDE (carousel/thread) atau satu post (single).'],
    ['2. Slide dalam satu konten diberi content_key yang SAMA.'],
    ['3. Kolom konten (platform, title, dst) cukup diisi di BARIS PERTAMA tiap content_key.'],
    ['4. Kolom slide (slide_text, visual_type, dst) diisi di SETIAP baris.'],
    [''],
    ['NILAI VALID'],
    ['platform    : threads, instagram, tiktok'],
    ['format      : single, carousel, thread'],
    ['content_type: edukasi, engagement, soft-sell, fakta, quotes, menu'],
    ['goal        : awareness, engagement, leads, conversion'],
    ['visual_type : desain_teks, foto_asli, foto_stok, ai'],
    [''],
    ['Hapus baris contoh (IG-CONTOH) sebelum import bila tidak ingin ikut masuk.'],
    ['Foto produk pakai foto_asli, JANGAN ai. AI hanya untuk ilustrasi non-produk.'],
  ]
  const ws2 = XLSX.utils.aoa_to_sheet(guide)
  ws2['!cols'] = [{ wch: 90 }]
  XLSX.utils.book_append_sheet(wb, ws2, 'Petunjuk')

  XLSX.writeFile(wb, 'template-konten-siappa.xlsx')
}

// Format Excel yang diharapkan (satu baris = satu slide):
// content_key | platform | title | content_type | format | goal | date | time | caption | hashtags | slide_text | visual_type | visual_note | ai_prompt
// Kolom konten (title, platform, dst) cukup diisi di baris pertama tiap content_key.

export default function ExcelImport({ brandId, onClose, onImported }) {
  const [rows, setRows] = useState([])
  const [grouped, setGrouped] = useState([])
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function handleFile(e) {
    const f = e.target.files && e.target.files[0]
    if (!f) return
    setError('')
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: 'binary' })
        const sheet = wb.Sheets[wb.SheetNames[0]]
        const data = XLSX.utils.sheet_to_json(sheet, { defval: '' })
        setRows(data)
        groupRows(data)
      } catch (err) {
        setError('Gagal membaca Excel: ' + err.message)
      }
    }
    reader.readAsBinaryString(f)
  }

  function groupRows(data) {
    const map = new Map()
    let order = 0
    for (const r of data) {
      const key = String(r.content_key || r.title || '').trim()
      if (!key) continue
      if (!map.has(key)) {
        map.set(key, {
          order: order++,
          meta: {
            platform: String(r.platform || '').trim().toLowerCase(),
            title: String(r.title || '').trim(),
            content_type: String(r.content_type || 'edukasi').trim(),
            format: String(r.format || 'single').trim(),
            goal: String(r.goal || 'awareness').trim(),
            date: r.date ? String(r.date).trim() : '',
            time: r.time ? String(r.time).trim() : '',
            caption: String(r.caption || '').trim(),
            hashtags: String(r.hashtags || '').trim(),
          },
          parts: [],
        })
      }
      const g = map.get(key)
      // isi meta yang mungkin baru muncul di baris pertama
      if (!g.meta.title && r.title) g.meta.title = String(r.title).trim()
      if (!g.meta.platform && r.platform) g.meta.platform = String(r.platform).trim().toLowerCase()
      if (String(r.slide_text || '').trim() || String(r.visual_type || '').trim()) {
        g.parts.push({
          text: String(r.slide_text || '').trim(),
          visual_type: String(r.visual_type || 'desain_teks').trim(),
          visual_note: String(r.visual_note || '').trim(),
          ai_prompt: String(r.ai_prompt || '').trim(),
        })
      }
    }
    setGrouped(Array.from(map.values()).sort((a, b) => a.order - b.order))
  }

  async function doImport() {
    if (!grouped.length) { setError('Tidak ada data valid untuk diimport.'); return }
    setBusy(true); setStatus('Menyiapkan…'); setError('')
    try {
      const { platforms } = await getLookups()
      const platBySlug = {}
      platforms.forEach(p => { platBySlug[p.slug] = p.id })

      const items = []
      for (const g of grouped) {
        const platformId = platBySlug[g.meta.platform]
        if (!platformId) {
          setError(`Platform "${g.meta.platform}" tidak dikenal (pakai: threads, instagram, tiktok). Konten "${g.meta.title}" dilewati.`)
          continue
        }
        items.push({
          content: {
            brand_id: brandId,
            platform_id: platformId,
            title: g.meta.title,
            content_type: g.meta.content_type,
            format: g.meta.format,
            goal: g.meta.goal,
            scheduled_date: g.meta.date || null,
            scheduled_time: g.meta.time || null,
            caption: g.meta.caption || null,
            hashtags: g.meta.hashtags || null,
            status: 'draft',
          },
          parts: g.parts.length ? g.parts : [{ text: '', visual_type: 'desain_teks' }],
        })
      }
      setStatus(`Mengimport ${items.length} konten…`)
      const n = await importContents(items)
      setStatus(`✓ ${n} konten berhasil diimport.`)
      onImported && onImported()
      setTimeout(onClose, 1200)
    } catch (e) {
      setError('Gagal import: ' + e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Import dari Excel</h2>
          <button className="x" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
            Gunakan template Excel. Satu baris = satu slide.
            Kolom konten (title, platform, dst) diisi di baris pertama tiap konten.
            Platform harus: threads, instagram, atau tiktok.
          </p>

          <button className="btn-outline-full" onClick={downloadTemplate}>
            ⬇ Download template Excel
          </button>

          <label className="filebtn-lg" style={{ marginTop: 10 }}>
            📄 Pilih file Excel (.xlsx)
            <input type="file" accept=".xlsx,.xls" onChange={handleFile} style={{ display: 'none' }} />
          </label>

          {error && <div className="err-banner" style={{ marginTop: 12 }}>{error}</div>}

          {grouped.length > 0 && (
            <div className="preview">
              <div className="preview-head">Pratinjau: {grouped.length} konten, {rows.length} baris</div>
              {grouped.map((g, i) => (
                <div className="preview-item" key={i}>
                  <b>{g.meta.title || '(tanpa judul)'}</b>
                  <span className="muted"> — {g.meta.platform || '?'} · {g.meta.format} · {g.parts.length} slide</span>
                </div>
              ))}
            </div>
          )}

          {status && <div className="status-line">{status}</div>}
        </div>
        <div className="modal-foot">
          <button className="btn-ghost" onClick={onClose}>Tutup</button>
          <button className="btn-primary" onClick={doImport} disabled={busy || !grouped.length}>
            {busy ? 'Mengimport…' : `Import ${grouped.length || ''} konten`}
          </button>
        </div>
      </div>
    </div>
  )
}
