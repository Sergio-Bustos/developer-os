import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Loader from '../components/Loader'

export default function AuthCallback() {
  const navigate = useNavigate()
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function handleCallback() {
      const { data, error: sessionError } =
        await supabase.auth.getSession()

      if (sessionError) {
        if (active) {
          setError(sessionError.message)
        }
        return
      }

      if (data.session) {
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname,
        )

        navigate('/github', { replace: true, state: { githubOAuth: true } })
        return
      }

      const timeout = window.setTimeout(async () => {
        const { data: retryData, error: retryError } =
          await supabase.auth.getSession()

        if (retryError) {
          if (active) {
            setError(retryError.message)
          }
          return
        }

        if (retryData.session) {
          navigate('/github', { replace: true, state: { githubOAuth: true } })
        } else if (active) {
          setError('No se pudo completar la conexión con GitHub.')
        }
      }, 1000)

      return () => window.clearTimeout(timeout)
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

  return <Loader fullscreen label="Finalizando conexión con GitHub..." />
}
