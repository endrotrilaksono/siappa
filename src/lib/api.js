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
