import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import '../App.css'
import ThemeToggle from '../components/ThemeToggle'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let active = true
    let timeoutId: number | undefined

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return

      if (session && (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
        setReady(true)
        setError('')
        setChecking(false)
      }
    })

    async function checkSession() {
      try {
        const { data, error: sessionError } = await supabase.auth.getSession()

        if (!active) return

        if (sessionError) {
          setError('No se pudo validar el enlace de recuperación.')
          setReady(false)
          setChecking(false)
          return
        }

        if (data.session) {
          setReady(true)
          setError('')
          setChecking(false)
          return
        }

        // Supabase puede estar terminando de procesar el código PKCE
        // que llegó en la URL. Esperamos un poco antes de marcarlo como inválido.
        timeoutId = window.setTimeout(async () => {
          const { data: retry } = await supabase.auth.getSession()

          if (!active) return

          if (retry.session) {
            setReady(true)
            setError('')
          } else {
            setReady(false)
            setError('El enlace de recuperación no es válido o ya expiró.')
          }

          setChecking(false)
        }, 1500)
      } catch {
        if (active) {
          setError('No se pudo validar el enlace de recuperación.')
          setReady(false)
          setChecking(false)
        }
      }
    }

    void checkSession()

    return () => {
      active = false
      if (timeoutId !== undefined) window.clearTimeout(timeoutId)
      subscription.unsubscribe()
    }
  }, [])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setMessage('')

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setLoading(true)

    const { error: updateError } = await supabase.auth.updateUser({
      password,
    })

    setLoading(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setMessage('Contraseña actualizada correctamente. Redirigiendo...')

    window.setTimeout(() => {
      navigate('/dashboard', { replace: true })
    }, 1200)
  }

  if (checking) {
    return (
      <main className="auth-page">
      <ThemeToggle />
        <section className="auth-poster">
          <div className="auth-mark" aria-hidden="true">
            <svg viewBox="0 0 28 28" width="34" height="34" className="mark-bars">
              <rect x="2" y="4" width="24" height="4" />
              <rect x="2" y="12" width="17" height="4" />
              <rect x="2" y="20" width="10" height="4" />
            </svg>
          </div>
          <p className="auth-statement">
            Define una nueva contraseña y vuelve a tu espacio.
          </p>
        </section>

        <div className="auth-card">
          <h1>Developer OS</h1>
          <h2>Validando enlace...</h2>
          <p>Estamos verificando tu enlace de recuperación.</p>
        </div>
      </main>
    )
  }

  return (
    <main className="auth-page">
      <ThemeToggle />
      <section className="auth-poster">
        <div className="auth-mark" aria-hidden="true">
          <svg viewBox="0 0 28 28" width="34" height="34" className="mark-bars">
            <rect x="2" y="4" width="24" height="4" />
            <rect x="2" y="12" width="17" height="4" />
            <rect x="2" y="20" width="10" height="4" />
          </svg>
        </div>
        <p className="auth-statement">
          Define una nueva contraseña y vuelve a tu espacio.
        </p>
      </section>

      <div className="auth-card">
        <h1>Developer OS</h1>
        <h2>Nueva contraseña</h2>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="new-password">Nueva contraseña</label>
            <input
              id="new-password"
              type="password"
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={!ready || loading}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirm-password">Confirmar contraseña</label>
            <input
              id="confirm-password"
              type="password"
              minLength={6}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              disabled={!ready || loading}
              required
            />
          </div>

          {error && <p className="auth-error">{error}</p>}
          {message && <p className="auth-ok">{message}</p>}

          <button type="submit" disabled={!ready || loading}>
            {loading ? 'Actualizando...' : 'Actualizar contraseña'}
          </button>
        </form>

        <p className="auth-register">
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="bg-transparent p-0 text-inherit underline"
          >
            Volver a iniciar sesión
          </button>
        </p>
      </div>
    </main>
  )
}
