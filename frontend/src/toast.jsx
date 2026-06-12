import { createContext, useCallback, useContext, useRef, useState } from 'react'

const ToastCtx = createContext(null)

/** App-wide notifications. Use `const toast = useToast()` then toast.success/error/warning/info(message). */
export const useToast = () => {
  const ctx = useContext(ToastCtx)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const seq = useRef(0)

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id))
  }, [])

  const push = useCallback((type, message, opts = {}) => {
    const id = (seq.current += 1)
    const duration = opts.duration ?? (type === 'error' ? 5000 : 3000)
    setToasts((list) => [...list, { id, message }])
    if (duration > 0) setTimeout(() => dismiss(id), duration)
    return id
  }, [dismiss])

  // Keep the success/error/etc. helpers so callers can express intent; they all render the same toast.
  const value = useRef({
    show: (m, o) => push('info', m, o),
    success: (m, o) => push('success', m, o),
    error: (m, o) => push('error', m, o),
    warning: (m, o) => push('warning', m, o),
    info: (m, o) => push('info', m, o),
    dismiss,
  }).current

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast" role="status">{t.message}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}
