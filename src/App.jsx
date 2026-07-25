import { useEffect, useState, useCallback } from 'react'
import { getBrands, getPlatforms, getContents, deleteContent } from './lib/api'
import { hasCredentials } from './lib/supabase'
import ContentCard from './components/ContentCard'
import ContentForm from './components/ContentForm'
import ExcelImport from './components/ExcelImport'

export default function App() {
  const [brands, setBrands] = useState([])
  const [platforms, setPlatforms] = useState([])
  const [brandId, setBrandId] = useState(null)
  const [platformId, setPlatformId] = useState(null)
  const [contents, setContents] = useState([])
  const [counts, setCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [showImport, setShowImport] = useState(false)

  // muat brand + platform sekali
  useEffect(() => {
    (async () => {
      try {
        const [b, p] = await Promise.all([getBrands(), getPlatforms()])
        setBrands(b); setPlatforms(p)
        if (b.length) setBrandId(b[0].id)
        if (p.length) setPlatformId(p[0].id)
      } catch (e) {
        setError(e.message)
      }
    })()
  }, [])

  const loadContents = useCallback(async () => {
    if (!brandId || !platformId) return
    setLoading(true); setError(null)
    try {
      const data = await getContents({ brandId, platformId })
      setContents(data)
      // hitung per platform untuk badge
      const all = await getContents({ brandId })
      const c = {}
      all.forEach(x => { c[x.platform_id] = (c[x.platform_id] || 0) + 1 })
      setCounts(c)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [brandId, platformId])

  useEffect(() => { loadContents() }, [loadContents])

  const currentBrand = brands.find(b => b.id === brandId)

  async function handleDelete(content) {
    if (!confirm(`Hapus konten "${content.title}"? Tindakan ini permanen.`)) return
    try {
      await deleteContent(content.id)
      loadContents()
    } catch (e) {
      alert('Gagal menghapus: ' + e.message)
    }
  }

  function handleEdit(content) {
    setEditing(content)
    setShowForm(true)
  }

  function openNew() {
    setEditing(null)
    setShowForm(true)
  }

  return (
    <div className="app">
      <div className="topbar">
        <div className="topbar-row">
          <h1>Siappa</h1>
          <span className="brand-label">{currentBrand?.name || 'Ibu Siapa'}</span>
        </div>
        <div className="tabs">
          {platforms.map(p => (
            <button key={p.id} className={platformId === p.id ? 'on' : ''} onClick={() => setPlatformId(p.id)}>
              {p.name}
              {counts[p.id] ? <span className="badge">{counts[p.id]}</span> : null}
            </button>
          ))}
        </div>
      </div>

      <div className="body">
        {!hasCredentials && (
          <div className="err-banner">
            Credential Supabase belum diisi. Buat file <b>.env.local</b> dari <b>.env.example</b>, isi URL & anon key, lalu restart <b>npm run dev</b>.
          </div>
        )}
        {error && <div className="err-banner">Error: {error}</div>}

        <div className="actionbar">
          <button className="btn-primary" onClick={openNew}>+ Tambah konten</button>
          <button className="btn-ghost-dark" onClick={() => setShowImport(true)}>⬆ Import Excel</button>
        </div>

        {loading ? (
          <div className="loading">Memuat konten…</div>
        ) : contents.length === 0 ? (
          <div className="empty">
            Belum ada konten di platform ini.<br />
            Tekan <b>+ Tambah konten</b> atau <b>Import Excel</b> untuk mulai.
          </div>
        ) : (
          contents.map(c => (
            <ContentCard key={c.id} content={c} onChange={loadContents} onEdit={handleEdit} onDelete={handleDelete} />
          ))
        )}
      </div>

      {showForm && (
        <ContentForm
          brandId={brandId}
          platformId={platformId}
          existing={editing}
          onClose={() => setShowForm(false)}
          onSaved={loadContents}
        />
      )}
      {showImport && (
        <ExcelImport
          brandId={brandId}
          onClose={() => setShowImport(false)}
          onImported={loadContents}
        />
      )}
    </div>
  )
}
