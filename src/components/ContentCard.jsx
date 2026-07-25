import { useState } from 'react'
import { updateContent, upsertPerformance } from '../lib/api'

const SKIP_REASONS = ['Tidak sempat', 'Lupa', 'Topik tidak relevan', 'Diganti konten lain', 'Alasan lain']
const VISUAL_LABEL = {
  foto_asli: 'Foto Asli',
  foto_stok: 'Foto Stok',
  ai: 'AI',
  desain_teks: 'Desain Teks',
}

function copy(text) {
  if (navigator.clipboard) navigator.clipboard.writeText(text)
}

export default function ContentCard({ content, onChange }) {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState(content.status)
  const [skipReason, setSkipReason] = useState(content.skip_reason || '')
  const [time, setTime] = useState(content.scheduled_time || '')
  const [saving, setSaving] = useState(false)
  const [flash, setFlash] = useState(false)

  const perf = (content.performance && content.performance[0]) || {}
  const [metrics, setMetrics] = useState({
    likes: perf.likes || 0, replies: perf.replies || 0,
    shares: perf.shares || 0, saves: perf.saves || 0, wa_clicks: perf.wa_clicks || 0,
  })

  function flashSaved() {
    setFlash(true)
    setTimeout(() => setFlash(false), 1400)
  }

  async function saveStatus(next, reason = skipReason) {
    setStatus(next)
    setSaving(true)
    try {
      const patch = { status: next, skip_reason: next === 'skipped' ? reason : null }
      if (next === 'posted') patch.posted_at = new Date().toISOString()
      await updateContent(content.id, patch)
      flashSaved()
      onChange && onChange()
    } catch (e) {
      alert('Gagal simpan status: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  async function saveTime(v) {
    setTime(v)
    try { await updateContent(content.id, { scheduled_time: v || null }); flashSaved() }
    catch (e) { alert('Gagal simpan jam: ' + e.message) }
  }

  async function saveReason(v) {
    setSkipReason(v)
    try { await updateContent(content.id, { skip_reason: v }); flashSaved() }
    catch (e) { alert('Gagal: ' + e.message) }
  }

  async function saveMetric(key, val) {
    const next = { ...metrics, [key]: Number(val) || 0 }
    setMetrics(next)
    try { await upsertPerformance(content.id, next); flashSaved() }
    catch (e) { alert('Gagal simpan performa: ' + e.message) }
  }

  const parts = content.content_parts || []
  const unitWord = content.format === 'thread' ? 'post' : content.format === 'carousel' ? 'slide' : 'bagian'

  return (
    <div className="card">
      <div className="card-head">
        <h3>{content.title}</h3>
        <span className={`status-pill ${status}`}>{statusLabel(status)}</span>
      </div>

      <div className="chips">
        {content.scheduled_date && <span className="chip date">{fmtDate(content.scheduled_date)}{time ? ` · ${time.slice(0,5)}` : ''}</span>}
        <span className="chip fmt">{content.format}{parts.length > 1 ? ` · ${parts.length} ${unitWord}` : ''}</span>
        {content.content_type && <span className="chip">{content.content_type}</span>}
        <span className={`chip goal-${content.goal}`}>{content.goal}</span>
      </div>

      <button className="foldbtn" onClick={() => setOpen(o => !o)}>
        {open ? '▾ Tutup detail' : '▸ Lihat naskah & kontrol'}
      </button>

      {open && (
        <>
          {parts.length > 0 && (
            <div className="parts">
              {parts.map(p => (
                <div className="part" key={p.id}>
                  <div className="part-top">
                    <span className="part-num">{p.part_order}</span>
                    <span className={`vtype ${p.visual_type}`}>{VISUAL_LABEL[p.visual_type] || p.visual_type}</span>
                    <button className="copy-mini" onClick={() => copy(p.text || '')}>Salin</button>
                  </div>
                  {p.text && <div className="part-text">{p.text}</div>}
                  {p.visual_note && <div className="part-note"><b>Grafik:</b> {p.visual_note}</div>}
                  {p.visual_type === 'ai' && p.ai_prompt && (
                    <div className="ai-prompt">
                      <span className="lbl">Prompt AI <button className="copy-mini" onClick={() => copy(p.ai_prompt)}>Salin</button></span>
                      {p.ai_prompt}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {content.caption && (
            <div className="caption-box">
              <span className="lbl">Caption <button className="copy-mini" style={{ marginLeft: 'auto' }} onClick={() => copy(content.caption)}>Salin</button></span>
              <pre>{content.caption}</pre>
              {content.hashtags && <div className="tags">{content.hashtags}</div>}
            </div>
          )}

          <div className="controls">
            <div className="ctl-row">
              <label>Status</label>
              <div className="seg">
                {['draft', 'posted', 'skipped'].map(s => (
                  <button key={s} className={status === s ? `on ${s}` : ''} onClick={() => saveStatus(s)}>
                    {statusLabel(s)}
                  </button>
                ))}
              </div>
            </div>

            {status === 'skipped' && (
              <div className="ctl-row">
                <label>Alasan</label>
                <select className="reason-sel" value={skipReason} onChange={e => saveReason(e.target.value)}>
                  <option value="">— pilih —</option>
                  {SKIP_REASONS.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
            )}

            <div className="ctl-row">
              <label>Jam posting</label>
              <input className="time-in" type="time" value={time ? time.slice(0,5) : ''} onChange={e => saveTime(e.target.value)} />
              <span className={`saveflash ${flash ? 'show' : ''}`}>✓ tersimpan</span>
            </div>

            <div>
              <div className="ctl-row" style={{ marginBottom: 8 }}><label>Performa</label></div>
              <div className="perf">
                {[['likes','Likes'],['replies','Balasan'],['shares','Share'],['saves','Save'],['wa_clicks','Klik WA']].map(([k,l]) => (
                  <div className="metric" key={k}>
                    <label className="muted">{l}</label>
                    <input type="number" min="0" value={metrics[k]} onChange={e => saveMetric(k, e.target.value)} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function statusLabel(s) {
  return { draft: 'Draft', scheduled: 'Terjadwal', posted: 'Diposting', skipped: 'Dilewati' }[s] || s
}
function fmtDate(d) {
  const days = ['Min','Sen','Sel','Rab','Kam','Jum','Sab']
  const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']
  const dt = new Date(d + 'T00:00:00')
  return `${days[dt.getDay()]} ${dt.getDate()} ${months[dt.getMonth()]}`
}
