// Sonido de click SOLO al pulsar de verdad botones, enlaces y controles interactivos.
// No suena en hover, en espacios vacíos, en tarjetas con solo texto, ni al hacer scroll/deslizar.
// Archivo: public/click.wav (se sirve en /click.wav).
//
// Baja latencia (sobre todo en celular): el audio se decodifica una sola vez en un
// AudioContext y se dispara desde un buffer en memoria, en vez de usar <audio>.

type AudioCtor = typeof AudioContext

const SELECTOR = [
  'a[href]',
  'button',
  'summary',
  '[role="button"]',
  '[role="link"]',
  '[role="tab"]',
  '[role="menuitem"]',
  '[role="switch"]',
  '[role="checkbox"]',
  '[role="radio"]',
  'input[type="button"]',
  'input[type="submit"]',
  'input[type="reset"]',
  'input[type="checkbox"]',
  'input[type="radio"]',
].join(',')

const VOLUME = 0.7
const STORAGE_KEY = 'dos-sound'

// Activado por defecto; la elección se recuerda en este navegador.
let enabled = true
try {
  enabled = localStorage.getItem(STORAGE_KEY) !== 'off'
} catch {
  /* sin almacenamiento */
}
let playHook: (() => void) | null = null

export function isSoundEnabled(): boolean {
  return enabled
}

export function setSoundEnabled(value: boolean) {
  enabled = value
  try {
    localStorage.setItem(STORAGE_KEY, value ? 'on' : 'off')
  } catch {
    /* sin almacenamiento */
  }
  window.dispatchEvent(new CustomEvent('dos-sound-change'))
  if (value && playHook) playHook() // confirma con un click al volver a activarlo
}
const TAP_MAX_MS = 800 // más que esto es una pulsación larga, no un toque
const TAP_MAX_MOVE = 10 // más que esto (px) es deslizar/scroll, no un toque

export function initClickSound() {
  if (typeof window === 'undefined') return

  const Ctor: AudioCtor | undefined =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext

  let ctx: AudioContext | null = null
  let buffer: AudioBuffer | null = null
  let fallback: HTMLAudioElement | null = null

  try {
    if (Ctor) {
      try {
        ctx = new Ctor({ latencyHint: 'interactive' })
      } catch {
        ctx = new Ctor()
      }
      const c = ctx
      fetch('/click.wav')
        .then((r) => r.arrayBuffer())
        .then(
          (data) =>
            new Promise<AudioBuffer>((ok, no) => {
              const p = c.decodeAudioData(data, ok, no)
              if (p && typeof p.then === 'function') p.then(ok, no)
            }),
        )
        .then((b) => {
          buffer = b
        })
        .catch(() => {})
    }
  } catch {
    ctx = null
  }

  // Respaldo si WebAudio no está disponible o aún no cargó el buffer
  try {
    fallback = new Audio('/click.wav')
    fallback.preload = 'auto'
    fallback.volume = VOLUME
  } catch {
    fallback = null
  }

  const shoot = () => {
    if (ctx && buffer) {
      try {
        const src = ctx.createBufferSource()
        src.buffer = buffer
        const gain = ctx.createGain()
        gain.gain.value = VOLUME
        src.connect(gain)
        gain.connect(ctx.destination)
        src.start(0)
        return
      } catch {
        /* cae al respaldo */
      }
    }
    if (fallback) {
      try {
        fallback.currentTime = 0
        const p = fallback.play()
        if (p && p.catch) p.catch(() => {})
      } catch {
        /* sin audio */
      }
    }
  }

  const play = () => {
    if (!enabled) return
    if (ctx && ctx.state !== 'running') {
      try {
        const r = ctx.resume()
        if (r && r.then) r.then(shoot, shoot)
        else shoot()
      } catch {
        shoot()
      }
      return
    }
    shoot()
  }

  playHook = () => {
    last = Date.now()
    play()
  }

  const unlock = () => {
    if (ctx && ctx.state !== 'running') {
      try {
        void ctx.resume()
      } catch {
        /* nada */
      }
    }
  }

  // Devuelve el control interactivo real bajo el puntero (o null si es espacio vacío / texto)
  const target = (e: Event): Element | null => {
    const t = e.target
    if (!(t instanceof Element)) return null
    const el = t.closest(SELECTOR)
    if (!el) return null
    if (el.closest('[data-no-click-sound]')) return null
    if (
      (el as HTMLButtonElement).disabled ||
      el.getAttribute('aria-disabled') === 'true' ||
      el.closest('fieldset:disabled')
    )
      return null
    return el
  }

  let down: { x: number; y: number; t: number; el: Element } | null = null
  let last = 0

  const fire = () => {
    last = Date.now()
    play()
  }

  document.addEventListener(
    'pointerdown',
    (e) => {
      unlock()
      down = null
      const el = target(e)
      if (!el) return
      if (e.pointerType === 'mouse') {
        // Computadora: suena en el instante de presionar el botón izquierdo
        if (e.button === 0) fire()
        return
      }
      // Celular / tablet / lápiz: se confirma al soltar, para no sonar al deslizar
      down = { x: e.clientX, y: e.clientY, t: Date.now(), el }
    },
    { capture: true, passive: true },
  )

  document.addEventListener(
    'pointermove',
    (e) => {
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > TAP_MAX_MOVE) down = null
    },
    { capture: true, passive: true },
  )

  document.addEventListener('pointercancel', () => (down = null), { capture: true, passive: true })

  document.addEventListener(
    'pointerup',
    (e) => {
      const d = down
      down = null
      if (!d) return
      const quick = Date.now() - d.t < TAP_MAX_MS
      const still = Math.hypot(e.clientX - d.x, e.clientY - d.y) <= TAP_MAX_MOVE
      if (quick && still && e.target instanceof Node && d.el.contains(e.target)) fire()
    },
    { capture: true, passive: true },
  )

  // Teclado (Enter/Espacio sobre un botón o enlace): el click llega con detail === 0
  document.addEventListener(
    'click',
    (e) => {
      if (e.detail === 0 && target(e) && Date.now() - last > 600) fire()
    },
    true,
  )
}
