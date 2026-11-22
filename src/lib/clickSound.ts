// Sonido de click en cualquier clic o toque.
// Coloca el archivo en la carpeta "public" como click.mp4 (se sirve en /click.mp4).
// Si ese formato falla, prueba otras extensiones; si no hay audio, no pasa nada.
export function initClickSound() {
  if (typeof window === 'undefined') return

  const exts = ['mp4', 'mp3', 'm4a', 'wav', 'ogg']
  let audio: HTMLAudioElement

  try {
    audio = new Audio()
    audio.preload = 'auto'
    audio.volume = 0.7

    let i = 0
    const next = () => {
      if (i < exts.length) {
        audio.src = `/click.${exts[i++]}`
        audio.load()
      }
    }

    audio.addEventListener('error', next)
    next()
  } catch {
    return
  }

  document.addEventListener(
    'click',
    () => {
      try {
        audio.currentTime = 0
        const played = audio.play()
        if (played && played.catch) played.catch(() => {})
      } catch {
        /* sin audio */
      }
    },
    true,
  )
}
