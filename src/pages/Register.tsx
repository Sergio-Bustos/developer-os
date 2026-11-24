import { useState, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import '../App.css'

export default function Register() {
  const navigate = useNavigate()
  const { signUp } = useAuth()

  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()

    setError('')
    setMessage('')
    setLoading(true)

    if (password.length < 6) {
      setError('La contraseña debe tener mínimo 6 caracteres.')
      setLoading(false)
      return
    }

    const result = await signUp(email, password, displayName)

    if (result.error) {
      setError(result.error.message)
      setLoading(false)
      return
    }

    setMessage(
      'Cuenta creada correctamente. Ahora puedes iniciar sesión.'
    )

    setLoading(false)

    setTimeout(() => {
      navigate('/login')
    }, 1500)
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

        <p className="auth-statement">
          Tu centro de control para desarrollo, aprendizaje y
          productividad.
        </p>
      </section>

      <div className="auth-card">
        <h1>Developer OS</h1>

        <h2>Crear cuenta</h2>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="displayName">Nombre</label>

            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              required
            />
          </div>

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
              minLength={6}
              required
            />
          </div>

          {error && <p className="auth-error">{error}</p>}

          {message && <p className="auth-ok">{message}</p>}

          <button type="submit" disabled={loading}>
            {loading ? 'Creando cuenta...' : 'Crear cuenta'}
          </button>
        </form>

        <p className="auth-register">
          ¿Ya tienes cuenta? <Link to="/login">Iniciar sesión</Link>
        </p>
      </div>
    </main>
  )
}
