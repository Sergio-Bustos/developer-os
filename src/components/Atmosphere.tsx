import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

// Fondo generativo: hilos de tinta que fluyen por un campo de corrientes.
// Casi no se ven... hasta que la "lámpara" pasa por encima: sigue al cursor
// o al dedo, y cuando nadie la mueve flota sola por la pantalla.
const PALETTE = ['240,180,90', '238,123,92', '98,201,189']

interface Thread {
  x: number
  y: number
  life: number
  c: number
  speed: number
}

export default function Atmosphere() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const strength = useRef(1)
  const { pathname } = useLocation()

  // En el login brilla más; dentro de la app se vuelve discreto para no distraer
  const isAuth = pathname === '/login' || pathname === '/register'
  useEffect(() => {
    strength.current = isAuth ? 1 : 0.6
  }, [isAuth])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const small = window.matchMedia('(max-width: 767px)').matches

    let w = 0
    let h = 0
    let t = 0
    let raf = 0
    let last = 0
    let threads: Thread[] = []
    let idle = 0
    const lamp = { x: 0, y: 0, tx: 0, ty: 0, active: false }

    function spawn(p?: Thread): Thread {
      const q = p ?? { x: 0, y: 0, life: 0, c: 0, speed: 1 }
      q.x = Math.random() * w
      q.y = Math.random() * h
      q.life = 140 + Math.random() * 260
      q.speed = 0.6 + Math.random() * 0.9
      // el color depende de la zona: así se forman "regiones" de luz
      const z = (Math.sin(q.x * 0.0012) + Math.cos(q.y * 0.0015) + 2) / 4
      q.c = Math.min(2, Math.floor(z * 3))
      return q
    }

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, small ? 1 : 1.5)
      w = window.innerWidth
      h = window.innerHeight
      canvas!.width = Math.round(w * dpr)
      canvas!.height = Math.round(h * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx!.fillStyle = '#0a1016'
      ctx!.fillRect(0, 0, w, h)
      lamp.x = lamp.tx = w * 0.5
      lamp.y = lamp.ty = h * 0.35
      threads = Array.from({ length: small ? 70 : 150 }, () => spawn())
    }

    function field(x: number, y: number) {
      const k = 0.0016
      return (
        Math.sin(x * k + t * 0.12) * 2.1 +
        Math.cos(y * k * 1.3 - t * 0.09) * 2.1 +
        Math.sin((x + y) * k * 0.6 + t * 0.05) * 1.2
      )
    }

    function step(fade: boolean) {
      if (fade) {
        ctx!.fillStyle = 'rgba(10,16,22,0.055)'
        ctx!.fillRect(0, 0, w, h)
      }
      const radius = Math.max(240, Math.min(w, h) * 0.42)
      const s = strength.current
      ctx!.lineWidth = 1.1
      ctx!.lineCap = 'round'

      for (const p of threads) {
        const a = field(p.x, p.y)
        const nx = p.x + Math.cos(a) * p.speed * 2.2
        const ny = p.y + Math.sin(a) * p.speed * 2.2
        const dx = nx - lamp.x
        const dy = ny - lamp.y
        const d = Math.sqrt(dx * dx + dy * dy)
        const lit = d < radius ? 1 - d / radius : 0
        const alpha = (0.07 + lit * lit * 0.7) * s

        ctx!.strokeStyle = `rgba(${PALETTE[p.c]},${alpha.toFixed(3)})`
        ctx!.beginPath()
        ctx!.moveTo(p.x, p.y)
        ctx!.lineTo(nx, ny)
        ctx!.stroke()

        p.x = nx
        p.y = ny
        p.life -= 1
        if (p.life <= 0 || nx < -20 || nx > w + 20 || ny < -20 || ny > h + 20) spawn(p)
      }
    }

    function frame(now: number) {
      raf = requestAnimationFrame(frame)
      if (now - last < 33) return // ~30 fps: suficiente y gentil con el celular
      t += (now - last) / 1000
      last = now

      if (!lamp.active) {
        lamp.tx = w * (0.5 + 0.32 * Math.sin(t * 0.23))
        lamp.ty = h * (0.38 + 0.22 * Math.cos(t * 0.31))
      }
      lamp.x += (lamp.tx - lamp.x) * 0.06
      lamp.y += (lamp.ty - lamp.y) * 0.06
      step(true)
    }

    function moveLamp(e: PointerEvent) {
      lamp.tx = e.clientX
      lamp.ty = e.clientY
      lamp.active = true
      window.clearTimeout(idle)
      idle = window.setTimeout(() => {
        lamp.active = false
      }, 4000)
    }

    function onVisibility() {
      if (document.hidden) {
        cancelAnimationFrame(raf)
      } else if (!reduced) {
        last = performance.now()
        raf = requestAnimationFrame(frame)
      }
    }

    let resizeTimer = 0
    function onResize() {
      window.clearTimeout(resizeTimer)
      resizeTimer = window.setTimeout(() => {
        resize()
        if (reduced) for (let i = 0; i < 220; i++) step(false)
      }, 200)
    }

    resize()
    if (reduced) {
      // Sin movimiento: un solo dibujo estático
      for (let i = 0; i < 220; i++) step(false)
    } else {
      last = performance.now()
      raf = requestAnimationFrame(frame)
      window.addEventListener('pointermove', moveLamp, { passive: true })
      window.addEventListener('pointerdown', moveLamp, { passive: true })
      document.addEventListener('visibilitychange', onVisibility)
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(idle)
      window.clearTimeout(resizeTimer)
      window.removeEventListener('pointermove', moveLamp)
      window.removeEventListener('pointerdown', moveLamp)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return <canvas ref={canvasRef} className="atmosphere" aria-hidden="true" />
}
