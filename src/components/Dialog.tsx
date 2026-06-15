import { useEffect, useRef, useId } from 'react'

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

type Props = {
  title: string
  onClose: () => void
  children: React.ReactNode
  size?: 'sm' | 'lg'
}

export default function Dialog({ title, onClose, children, size = 'sm' }: Props) {
  const panelRef = useRef<HTMLDivElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)
  const titleId = useId()

  useEffect(() => {
    previousFocus.current = document.activeElement as HTMLElement

    const firstFocusable = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)
    ;(firstFocusable ?? panelRef.current)?.focus()

    return () => {
      previousFocus.current?.focus()
    }
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      const focusable = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`bg-white rounded-xl shadow-sm border border-neutral-100 w-full mx-4 p-6 outline-none ${size === 'lg' ? 'max-w-2xl' : 'max-w-sm'}`}
      >
        <h2 id={titleId} className="text-sm font-semibold text-neutral-900 mb-5">{title}</h2>
        {children}
      </div>
    </div>
  )
}
