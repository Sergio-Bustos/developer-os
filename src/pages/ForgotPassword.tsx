import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import '../App.css'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setMessage('')
    setError('')
    setLoading(true)

    const redirectTo = `${window.location.origin}/auth/reset-password`
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })

    setLoading(false)

    if (resetError) {
      setError(resetError.message)
      return
    }

    setMessage('Si el correo existe, recibirás un enlace para restablecer tu contraseña.')
  }

  return (
    <main className="auth-page">
      <section className="auth-poster">
        <div className="auth-mark" aria-hidden="true">
          <svg viewBox="0 0 28 28" width="34" height="34" className="mark-bars">
            <rect x="2" y="4" width="24" height="4" />
            <rect x="2" y="12" width="17" height="4" />
            <rect x="2" y="20" width="10" height="4" />
          </svg>
        </div>
        <p className="auth-statement">Recupera el acceso a tu espacio de desarrollo.</p>
      </section>

      <div className="auth-card">
        <h1>Developer OS</h1>
        <h2>Recuperar contraseña</h2>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="reset-email">Correo</label>
            <input
              id="reset-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          {error && <p className="auth-error">{error}</p>}
          {message && <p className="auth-ok">{message}</p>}

          <button type="submit" disabled={loading}>
            {loading ? 'Enviando...' : 'Enviar enlace'}
          </button>
        </form>

        <p className="auth-register">
          <Link to="/login">Volver a iniciar sesión</Link>
        </p>
      </div>
    </main>
  )
}
