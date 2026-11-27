import { useEffect, useState } from 'react'
import { isSoundEnabled, setSoundEnabled } from '../lib/clickSound'

// Activa o silencia el sonido de click. Activado por defecto.
export default function SoundToggle({ className = '' }: { className?: string }) {
  const [on, setOn] = useState(isSoundEnabled())

  useEffect(() => {
    const sync = () => setOn(isSoundEnabled())
    window.addEventListener('dos-sound-change', sync)
    return () => window.removeEventListener('dos-sound-change', sync)
  }, [])

  return (
    <button
      type="button"
      data-no-click-sound
      onClick={() => setSoundEnabled(!on)}
      className={`theme-toggle sound-toggle ${className}`.trim()}
      aria-pressed={on}
      aria-label={on ? 'Silenciar sonido de click' : 'Activar sonido de click'}
      title={on ? 'Sonido activado' : 'Sonido silenciado'}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
        <path d="M11 5 6 9H3v6h3l5 4z" />
        {on ? (
          <>
            <path d="M15.5 9a4 4 0 0 1 0 6" />
            <path d="M18.5 6.5a8 8 0 0 1 0 11" />
          </>
        ) : (
          <path d="m16 9 5 6m0-6-5 6" />
        )}
      </svg>
    </button>
  )
}
