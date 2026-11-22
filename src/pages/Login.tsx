import { useState, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import '../App.css'

export default function Login() {
  const navigate = useNavigate()
  const { signIn } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()

    setError('')
    setLoading(true)

    const result = await signIn(email, password)

    if (result.error) {
      setError(result.error.message)
      setLoading(false)
      return
    }

    navigate('/dashboard')
  }

  return (
    <main className="auth-page">
      <section className="auth-poster">
        <div className="auth-mark" aria-hidden="true">
          <svg viewBox="0 0 32 32" width="34" height="34">
            <circle
              cx="16"
              cy="16"
              r="12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeDasharray="52 24"
              strokeLinecap="round"
              className="mark-ring"
            />
            <circle cx="16" cy="16" r="4.2" className="mark-core" />
          </svg>
        </div>

        <p className="auth-statement">
          Tu centro de control para desarrollo, aprendizaje y
          productividad.
        </p>
      </section>

      <div className="auth-card">
        <h1>Developer OS</h1>

        <h2>Iniciar sesión</h2>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Correo</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>

          {error && <p className="auth-error">{error}</p>}

          <button type="submit" disabled={loading}>
            {loading ? 'Iniciando sesión...' : 'Iniciar sesión'}
          </button>
        </form>

        <p className="auth-register">
          ¿No tienes cuenta? <Link to="/register">Crear cuenta</Link>
        </p>
      </div>
    </main>
  )
}
