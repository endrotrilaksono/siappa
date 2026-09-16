// Editor daftar potongan platform (komisi, admin, fulfillment, dst).
// Ditaruh di LEVEL PRODUK (bukan per varian), karena persenan platform
// sama terus berapa pun variannya. Dipakai di paling atas tiap card MP.
export default function MpPotonganEditor({ rows, onChange }) {
  function setRow(i, patch) {
    onChange(rows.map((r, idx) => idx === i ? { ...r, ...patch } : r))
  }
  function addRow() {
    onChange([...rows, { nama: '', value: '', format: '%' }])
  }
  function delRow(i) {
    onChange(rows.filter((_, idx) => idx !== i))
  }

  return (
    <div className="mp-potongan-editor">
      <div className="mp-potongan-list">
        {rows.map((r, i) => (
          <div className="mp-potongan-row" key={i}>
            <input type="text" placeholder="Nama potongan" value={r.nama}
              onChange={e => setRow(i, { nama: e.target.value })} />
            <input type="number" placeholder="0" value={r.value}
              onChange={e => setRow(i, { value: e.target.value })} />
            <select value={r.format} onChange={e => setRow(i, { format: e.target.value })}>
              <option value="%">%</option>
              <option value="Rp">Rp</option>
            </select>
            <button className="mp-row-x" onClick={() => delRow(i)} aria-label="Hapus baris">✕</button>
          </div>
        ))}
      </div>
      <button className="mp-add-row" onClick={addRow}>+ tambah potongan</button>
    </div>
  )
}
