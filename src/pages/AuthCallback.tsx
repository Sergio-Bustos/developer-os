import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function AuthCallback() {
  const navigate = useNavigate()
    const [error, setError] = useState('')

      useEffect(() => {
          let active = true

              async function handleCallback() {
                    const { error: sessionError } = await supabase.auth.getSession()

                          if (sessionError) {
                                  if (active) {
                                            setError(sessionError.message)
                                                    }
                                                            return
                                                                  }

                                                                        const { data } = await supabase.auth.getSession()

                                                                              if (!data.session) {
                                                                                      if (active) {
                                                                                                setError('No se pudo recuperar la sesión de GitHub.')
                                                                                                        }
                                                                                                                return
                                                                                                                      }

                                                                                                                            navigate('/github', { replace: true })
                                                                                                                                }

                                                                                                                                    handleCallback()

                                                                                                                                        return () => {
                                                                                                                                              active = false
                                                                                                                                                  }
                                                                                                                                                    }, [navigate])

                                                                                                                                                      if (error) {
                                                                                                                                                          return (
                                                                                                                                                                <main className="flex min-h-screen items-center justify-center bg-zinc-950 p-6">
                                                                                                                                                                        <div className="w-full max-w-md rounded-2xl border border-red-900/60 bg-zinc-900 p-6">
                                                                                                                                                                                  <h1 className="mb-2 text-xl font-semibold text-white">
                                                                                                                                                                                              Error al conectar GitHub
                                                                                                                                                                                                        </h1>

                                                                                                                                                                                                                  <p className="text-sm text-red-300">
                                                                                                                                                                                                                              {error}
                                                                                                                                                                                                                                        </p>

                                                                                                                                                                                                                                                  <button
                                                                                                                                                                                                                                                              onClick={() => navigate('/github', { replace: true })}
                                                                                                                                                                                                                                                                          className="mt-5 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black"
                                                                                                                                                                                                                                                                                    >
                                                                                                                                                                                                                                                                                                Volver a GitHub
                                                                                                                                                                                                                                                                                                          </button>
                                                                                                                                                                                                                                                                                                                  </div>
                                                                                                                                                                                                                                                                                                                        </main>
                                                                                                                                                                                                                                                                                                                            )
                                                                                                                                                                                                                                                                                                                              }

                                                                                                                                                                                                                                                                                                                                return (
                                                                                                                                                                                                                                                                                                                                    <main className="flex min-h-screen items-center justify-center bg-zinc-950">
                                                                                                                                                                                                                                                                                                                                          <div className="text-center">
                                                                                                                                                                                                                                                                                                                                                  <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-white" />

                                                                                                                                                                                                                                                                                                                                                          <p className="text-sm text-zinc-400">
                                                                                                                                                                                                                                                                                                                                                                    Finalizando conexión con GitHub...
                                                                                                                                                                                                                                                                                                                                                                            </p>
                                                                                                                                                                                                                                                                                                                                                                                  </div>
                                                                                                                                                                                                                                                                                                                                                                                      </main>
                                                                                                                                                                                                                                                                                                                                                                                        )
                                                                                                                                                                                                                                                                                                                                                                                        }