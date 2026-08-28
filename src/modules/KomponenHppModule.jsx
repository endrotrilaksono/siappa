import { useState, useEffect, useCallback } from 'react'
import { getHppComponents, createHppComponent, updateHppComponent, deleteHppComponent } from '../lib/api'
import { rp } from '../lib/hpp'

export default function KomponenHppModule() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [form, setForm] = useState({ nama: '', spek: '', harga_per_pcs: '' })
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try { setItems(await getHppComponents()) }
    catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  function resetForm() {
    setForm({ nama: '', spek: '', harga_per_pcs: '' })
    setEditingId(null)
  }

  function startEdit(item) {
    setForm({ nama: item.nama || '', spek: item.spek || '', harga_per_pcs: item.harga_per_pcs ?? '' })
    setEditingId(item.id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function submit() {
    if (!form.nama.trim()) { alert('Nama komponen wajib diisi.'); return }
    setSaving(true)
    try {
      const payload = {
        nama: form.nama.trim(),
        spek: form.spek.trim() || null,
        harga_per_pcs: parseFloat(form.harga_per_pcs) || 0,
      }
      if (editingId) await updateHppComponent(editingId, payload)
      else await createHppComponent(payload)
      resetForm()
      load()
    } catch (e) { alert('Gagal menyimpan: ' + e.message) }
    finally { setSaving(false) }
  }

  async function remove(item) {
    if (!confirm(`Hapus komponen "${item.nama}"?`)) return
    try { await deleteHppComponent(item.id); load() }
    catch (e) { alert('Gagal menghapus: ' + e.message) }
  }

  return (
    <div className="hpp">
      <div className="card">
        <div className="card-head-h">{editingId ? 'Edit Komponen' : 'Tambah Komponen'}</div>
        <div className="hpp-grid2">
          <div className="fld">
            <label>Nama komponen</label>
            <input type="text" placeholder="mis: Plastik Vacuum 15x25"
              value={form.nama} onChange={e => setForm(f => ({ ...f, nama: e.target.value }))} />
          </div>
          <div className="fld">
            <label>Spek / ukuran (opsional)</label>
            <input type="text" placeholder="mis: 15x25 cm, 0.08mm"
              value={form.spek} onChange={e => setForm(f => ({ ...f, spek: e.target.value }))} />
          </div>
          <div className="fld">
            <label>Harga per pcs (Rp)</label>
            <input type="number" placeholder="0"
              value={form.harga_per_pcs} onChange={e => setForm(f => ({ ...f, harga_per_pcs: e.target.value }))} />
          </div>
        </div>
        <div className="hpp-actions" style={{ margin: '10px 0 0' }}>
          <button className="btn-primary" onClick={submit} disabled={saving}>
            {saving ? 'Menyimpan…' : editingId ? 'Simpan perubahan' : '+ Tambah komponen'}
          </button>
          {editingId && <button className="btn-ghost-dark" onClick={resetForm}>Batal edit</button>}
        </div>
      </div>

      <div className="card">
        <div className="card-head-h">Daftar Komponen</div>
        <p className="muted sm" style={{ marginTop: 0 }}>
          Komponen di sini akan muncul sebagai pilihan cepat saat mengisi biaya kemasan
          di form HPP, supaya tidak ketik ulang harga tiap kali bikin batch baru.
        </p>
        {error && <div className="err-banner">Error: {error}</div>}
        {loading ? <div className="loading">Memuat…</div>
          : items.length === 0 ? <div className="empty">Belum ada komponen. Tambahkan lewat form di atas.</div>
            : (
              <div className="hist-wrap">
                <table className="hist-tbl">
                  <thead><tr><th>Nama</th><th>Spek</th><th>Harga/pcs</th><th></th></tr></thead>
                  <tbody>
                    {items.map(item => (
                      <tr key={item.id}>
                        <td><b>{item.nama}</b></td>
                        <td className="muted sm">{item.spek || '—'}</td>
                        <td className="accent">{rp(item.harga_per_pcs)}</td>
                        <td className="nowrap">
                          <button className="link-btn" onClick={() => startEdit(item)}>Edit</button>
                          <button className="link-btn del" onClick={() => remove(item)}>Hapus</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
      </div>
    </div>
  )
}
