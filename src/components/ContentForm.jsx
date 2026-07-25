import { useState } from 'react'
import { createContent, saveContentWithParts } from '../lib/api'

const VISUAL_TYPES = [
  ['desain_teks', 'Desain Teks'],
  ['foto_asli', 'Foto Asli'],
  ['foto_stok', 'Foto Stok'],
  ['ai', 'AI'],
]
const CONTENT_TYPES = ['edukasi', 'engagement', 'soft-sell', 'fakta', 'quotes', 'menu']
const GOALS = ['awareness', 'engagement', 'leads', 'conversion']
const FORMATS = ['single', 'carousel', 'thread']

const emptyPart = () => ({ text: '', visual_type: 'desain_teks', visual_note: '', ai_prompt: '' })

export default function ContentForm({ brandId, platformId, existing, onClose, onSaved }) {
  const isEdit = Boolean(existing)
  const [form, setForm] = useState(() => existing ? {
    title: existing.title || '',
    content_type: existing.content_type || 'edukasi',
    format: existing.format || 'single',
    goal: existing.goal || 'awareness',
    scheduled_date: existing.scheduled_date || '',
    scheduled_time: existing.scheduled_time ? existing.scheduled_time.slice(0,5) : '',
    caption: existing.caption || '',
    hashtags: existing.hashtags || '',
  } : {
    title: '', content_type: 'edukasi', format: 'single', goal: 'awareness',
    scheduled_date: '', scheduled_time: '', caption: '', hashtags: '',
  })
  const [parts, setParts] = useState(() =>
    existing && existing.content_parts && existing.content_parts.length
      ? existing.content_parts.map(p => ({
          text: p.text || '', visual_type: p.visual_type || 'desain_teks',
          visual_note: p.visual_note || '', ai_prompt: p.ai_prompt || '',
        }))
      : [emptyPart()]
  )
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const setPart = (i, k, v) => setParts(ps => ps.map((p, idx) => idx === i ? { ...p, [k]: v } : p))
  const addPart = () => setParts(ps => [...ps, emptyPart()])
  const removePart = (i) => setParts(ps => ps.length > 1 ? ps.filter((_, idx) => idx !== i) : ps)
  const movePart = (i, dir) => setParts(ps => {
    const j = i + dir
    if (j < 0 || j >= ps.length) return ps
    const next = [...ps]; [next[i], next[j]] = [next[j], next[i]]; return next
  })

  async function submit() {
    if (!form.title.trim()) { alert('Judul wajib diisi.'); return }
    setSaving(true)
    try {
      const content = {
        brand_id: brandId,
        platform_id: platformId,
        title: form.title.trim(),
        content_type: form.content_type,
        format: form.format,
        goal: form.goal,
        scheduled_date: form.scheduled_date || null,
        scheduled_time: form.scheduled_time || null,
        caption: form.caption || null,
        hashtags: form.hashtags || null,
        status: existing ? existing.status : 'draft',
      }
      if (isEdit) await saveContentWithParts(existing.id, content, parts)
      else await createContent(content, parts)
      onSaved && onSaved()
      onClose()
    } catch (e) {
      alert('Gagal menyimpan: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{isEdit ? 'Edit Konten' : 'Tambah Konten'}</h2>
          <button className="x" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="fld">
            <label>Judul *</label>
            <input type="text" value={form.title} onChange={e => set('title', e.target.value)} placeholder="mis. Beku vs Kanginan" />
          </div>

          <div className="grid2">
            <div className="fld">
              <label>Jenis</label>
              <select value={form.content_type} onChange={e => set('content_type', e.target.value)}>
                {CONTENT_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="fld">
              <label>Format</label>
              <select value={form.format} onChange={e => set('format', e.target.value)}>
                {FORMATS.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="fld">
              <label>Tujuan</label>
              <select value={form.goal} onChange={e => set('goal', e.target.value)}>
                {GOALS.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="fld">
              <label>Tanggal</label>
              <input type="date" value={form.scheduled_date} onChange={e => set('scheduled_date', e.target.value)} />
            </div>
            <div className="fld">
              <label>Jam</label>
              <input type="time" value={form.scheduled_time} onChange={e => set('scheduled_time', e.target.value)} />
            </div>
          </div>

          <div className="parts-editor">
            <div className="pe-head">
              <label>Slide / bagian ({parts.length})</label>
              <button className="btn-sm" onClick={addPart}>+ Tambah slide</button>
            </div>
            {parts.map((p, i) => (
              <div className="pe-item" key={i}>
                <div className="pe-top">
                  <span className="pe-num">{i + 1}</span>
                  <select value={p.visual_type} onChange={e => setPart(i, 'visual_type', e.target.value)}>
                    {VISUAL_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  <div className="pe-moves">
                    <button onClick={() => movePart(i, -1)} disabled={i === 0}>↑</button>
                    <button onClick={() => movePart(i, 1)} disabled={i === parts.length - 1}>↓</button>
                    <button className="del" onClick={() => removePart(i)} disabled={parts.length === 1}>hapus</button>
                  </div>
                </div>
                <textarea placeholder="Teks slide…" value={p.text} onChange={e => setPart(i, 'text', e.target.value)} />
                <input type="text" placeholder="Arahan grafik (opsional)" value={p.visual_note} onChange={e => setPart(i, 'visual_note', e.target.value)} />
                {p.visual_type === 'ai' && (
                  <textarea className="ai" placeholder="Prompt AI…" value={p.ai_prompt} onChange={e => setPart(i, 'ai_prompt', e.target.value)} />
                )}
              </div>
            ))}
          </div>

          <div className="fld">
            <label>Caption</label>
            <textarea value={form.caption} onChange={e => set('caption', e.target.value)} placeholder="Caption postingan…" />
          </div>
          <div className="fld">
            <label>Hashtag</label>
            <input type="text" value={form.hashtags} onChange={e => set('hashtags', e.target.value)} placeholder="#frozenfood #ibusiapa" />
          </div>
        </div>

        <div className="modal-foot">
          <button className="btn-ghost" onClick={onClose}>Batal</button>
          <button className="btn-primary" onClick={submit} disabled={saving}>
            {saving ? 'Menyimpan…' : isEdit ? 'Simpan perubahan' : 'Tambah konten'}
          </button>
        </div>
      </div>
    </div>
  )
}
