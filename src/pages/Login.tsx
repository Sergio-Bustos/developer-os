import { useState, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

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
                                                                    <main>
                                                                          <div>
                                                                                  <h1>Developer OS</h1>

                                                                                          <h2>Iniciar sesión</h2>

                                                                                                  <form onSubmit={handleSubmit}>
                                                                                                            <div>
                                                                                                                        <label htmlFor="email">Correo</label>

                                                                                                                                    <input
                                                                                                                                                  id="email"
                                                                                                                                                                type="email"
                                                                                                                                                                              value={email}
                                                                                                                                                                                            onChange={(event) => setEmail(event.target.value)}
                                                                                                                                                                                                          required
                                                                                                                                                                                                                      />
                                                                                                                                                                                                                                </div>

                                                                                                                                                                                                                                          <div>
                                                                                                                                                                                                                                                      <label htmlFor="password">Contraseña</label>

                                                                                                                                                                                                                                                                  <input
                                                                                                                                                                                                                                                                                id="password"
                                                                                                                                                                                                                                                                                              type="password"
                                                                                                                                                                                                                                                                                                            value={password}
                                                                                                                                                                                                                                                                                                                          onChange={(event) => setPassword(event.target.value)}
                                                                                                                                                                                                                                                                                                                                        required
                                                                                                                                                                                                                                                                                                                                                    />
                                                                                                                                                                                                                                                                                                                                                              </div>

                                                                                                                                                                                                                                                                                                                                                                        {error && <p>{error}</p>}

                                                                                                                                                                                                                                                                                                                                                                                  <button type="submit" disabled={loading}>
                                                                                                                                                                                                                                                                                                                                                                                              {loading ? 'Iniciando sesión...' : 'Iniciar sesión'}
                                                                                                                                                                                                                                                                                                                                                                                                        </button>
                                                                                                                                                                                                                                                                                                                                                                                                                </form>

                                                                                                                                                                                                                                                                                                                                                                                                                        <p>
                                                                                                                                                                                                                                                                                                                                                                                                                                  ¿No tienes cuenta? <Link to="/register">Crear cuenta</Link>
                                                                                                                                                                                                                                                                                                                                                                                                                                          </p>
                                                                                                                                                                                                                                                                                                                                                                                                                                                </div>
                                                                                                                                                                                                                                                                                                                                                                                                                                                    </main>
                                                                                                                                                                                                                                                                                                                                                                                                                                                      )
                                                                                                                                                                                                                                                                                                                                                                                                                                                      }