import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  console.warn('[Konten OS] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY belum diisi. Buat file .env.local dari .env.example.')
}

export const supabase = createClient(url || 'http://localhost', key || 'anon')
export const hasCredentials = Boolean(url && key)
