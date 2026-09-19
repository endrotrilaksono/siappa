import { createContext, useContext, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

const UnsavedCtx = createContext(null)

export function UnsavedChangesProvider({ children }) {
  const navigate = useNavigate()
  const [isDirty, setIsDirty] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const pendingPath = useRef(null)

  const setDirty = useCallback((v) => setIsDirty(v), [])

  const requestNavigate = useCallback((path) => {
    if (!isDirty) { navigate(path); return }
    pendingPath.current = path
    setConfirmOpen(true)
  }, [isDirty, navigate])

  function confirmLeave() {
    setConfirmOpen(false)
    setIsDirty(false)
    if (pendingPath.current) navigate(pendingPath.current)
    pendingPath.current = null
  }
  function cancelLeave() {
    setConfirmOpen(false)
    pendingPath.current = null
  }

  return (
    <UnsavedCtx.Provider value={{ isDirty, setDirty, requestNavigate }}>
      {children}
      {confirmOpen && (
        <div className="uc-backdrop">
          <div className="uc-dialog">
            <div className="uc-title">Ada perubahan belum disimpan</div>
            <p className="uc-body">
              Kalau pindah halaman sekarang, perubahan yang belum diklik Simpan akan hilang.
            </p>
            <div className="uc-actions">
              <button className="btn-ghost" onClick={cancelLeave}>Tetap di sini</button>
              <button className="btn-danger" onClick={confirmLeave}>Tinggalkan halaman</button>
            </div>
          </div>
        </div>
      )}
    </UnsavedCtx.Provider>
  )
}

export function useUnsavedGuard() {
  const ctx = useContext(UnsavedCtx)
  if (!ctx) throw new Error('useUnsavedGuard harus dipakai di dalam UnsavedChangesProvider')
  return ctx
}
