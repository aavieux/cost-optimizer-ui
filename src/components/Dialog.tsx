import { useEffect } from 'react'

type Props = {
  onClose: () => void
  children: React.ReactNode
}

export default function Dialog({ onClose, children }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-xl shadow-sm border border-neutral-100 w-full max-w-sm mx-4 p-6">
        {children}
      </div>
    </div>
  )
}
