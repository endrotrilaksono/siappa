import { supabase } from './supabase'

export async function getBrands() {
  const { data, error } = await supabase.from('brands').select('*').order('created_at')
  if (error) throw error
  return data
}

export async function getPlatforms() {
  const { data, error } = await supabase.from('platforms').select('*').order('created_at')
  if (error) throw error
  return data
}

export async function getContents({ brandId, platformId }) {
  let q = supabase
    .from('contents')
    .select('*, content_parts(*), performance(*)')
    .order('sort_order', { ascending: true })
  if (brandId) q = q.eq('brand_id', brandId)
  if (platformId) q = q.eq('platform_id', platformId)
  const { data, error } = await q
  if (error) throw error
  // urutkan parts
  data.forEach(c => {
    if (c.content_parts) c.content_parts.sort((a, b) => a.part_order - b.part_order)
  })
  return data
}

export async function updateContent(id, patch) {
  const { data, error } = await supabase
    .from('contents')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function upsertPerformance(contentId, patch) {
  const { data, error } = await supabase
    .from('performance')
    .upsert({ content_id: contentId, ...patch, updated_at: new Date().toISOString() }, { onConflict: 'content_id' })
    .select()
    .single()
  if (error) throw error
  return data
}

// ---------- CREATE / EDIT / DELETE ----------

// Membuat 1 konten beserta slide/part-nya. parts = array {text, visual_type, visual_note, ai_prompt}
export async function createContent(content, parts = []) {
  const { data: c, error } = await supabase
    .from('contents')
    .insert(content)
    .select()
    .single()
  if (error) throw error

  if (parts.length) {
    const rows = parts.map((p, i) => ({
      content_id: c.id,
      part_order: i + 1,
      text: p.text || '',
      visual_type: p.visual_type || 'desain_teks',
      visual_note: p.visual_note || null,
      ai_prompt: p.ai_prompt || null,
    }))
    const { error: pe } = await supabase.from('content_parts').insert(rows)
    if (pe) throw pe
  }
  // baris performa kosong
  await supabase.from('performance').insert({ content_id: c.id }).select()
  return c
}

// Memperbarui 1 konten + mengganti seluruh slide-nya (hapus lama, buat baru)
export async function saveContentWithParts(id, content, parts = []) {
  const { error } = await supabase
    .from('contents')
    .update({ ...content, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error

  await supabase.from('content_parts').delete().eq('content_id', id)
  if (parts.length) {
    const rows = parts.map((p, i) => ({
      content_id: id,
      part_order: i + 1,
      text: p.text || '',
      visual_type: p.visual_type || 'desain_teks',
      visual_note: p.visual_note || null,
      ai_prompt: p.ai_prompt || null,
    }))
    const { error: pe } = await supabase.from('content_parts').insert(rows)
    if (pe) throw pe
  }
  return true
}

export async function deleteContent(id) {
  const { error } = await supabase.from('contents').delete().eq('id', id)
  if (error) throw error
  return true
}

// Import batch dari array konten (dipakai importer Excel)
export async function importContents(items) {
  let ok = 0
  for (const item of items) {
    await createContent(item.content, item.parts)
    ok++
  }
  return ok
}

// Ambil id brand & platform berdasarkan slug (untuk importer)
export async function getLookups() {
  const [{ data: brands }, { data: platforms }] = await Promise.all([
    supabase.from('brands').select('*'),
    supabase.from('platforms').select('*'),
  ])
  return { brands: brands || [], platforms: platforms || [] }
}
