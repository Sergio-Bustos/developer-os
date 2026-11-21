import { useEffect, useState } from 'react'
import {
  Code2,
  GitBranch,
  GitCommit,
  ExternalLink,
  RefreshCw,
  Unplug,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

type GithubConnection = {
  id: string
  user_id: string
  github_username: string | null
  connected_at: string
  updated_at: string
}

type GithubRepo = {
  id: number
  name: string
  full_name: string
  html_url: string
  description: string | null
  private: boolean
  default_branch: string
  language: string | null
  stargazers_count: number
  forks_count: number
  updated_at: string
}

const GITHUB_SCOPE = 'read:user repo'

export default function GithubPage() {
  const { user } = useAuth()

  const [connection, setConnection] = useState<GithubConnection | null>(null)
  const [repos, setRepos] = useState<GithubRepo[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingRepos, setLoadingRepos] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const connected = Boolean(connection)


  async function loadConnection() {
    if (!user) return

    setLoading(true)
    setError('')

    const { data, error: dbError } = await supabase
      .from('github_connections')
      .select(
        'id, user_id, github_username, connected_at, updated_at',
      )
      .eq('user_id', user.id)
      .maybeSingle()

    if (dbError) {
      setError(dbError.message)
    } else {
      setConnection(data)
    }

    setLoading(false)
  }

  async function connectGithub() {
    setError('')
    setSuccess('')

    const redirectTo = `${window.location.origin}/auth/callback`

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo,
        scopes: GITHUB_SCOPE,
        skipBrowserRedirect: false,
      },
    })

    if (oauthError) {
      setError(oauthError.message)
    }
  }

  async function saveConnectionAfterOAuth() {
    if (!user) return

    const { data: sessionData } = await supabase.auth.getSession()
    const currentUser = sessionData.session?.user

    if (!currentUser) return

    const identities = currentUser.identities || []
    const githubIdentity = identities.find(
      (identity: any) => identity.provider === 'github',
    )

    if (!githubIdentity) return

    const identityData = githubIdentity.identity_data || {}
    const githubUsername =
      identityData.user_name ||
      identityData.preferred_username ||
      identityData.login ||
      currentUser.user_metadata?.user_name ||
      currentUser.user_metadata?.preferred_username ||
      null

    const { data, error: upsertError } = await supabase
      .from('github_connections')
      .upsert(
        {
          user_id: currentUser.id,
          github_username: githubUsername,
          connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      )
      .select('id, user_id, github_username, connected_at, updated_at')
      .single()

    if (upsertError) {
      setError(upsertError.message)
      return
    }

    setConnection(data)
    setSuccess('GitHub conectado correctamente.')
  }

  async function loadRepositories() {
    setError('')
    setSuccess('')
    setLoadingRepos(true)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const session = sessionData.session

      const token = session?.provider_token

      if (!token) {
        throw new Error(
          'No hay token de GitHub disponible en esta sesión. Desconecta y vuelve a conectar GitHub.',
        )
      }

      const response = await fetch(
        'https://api.github.com/user/repos?per_page=100&sort=updated&direction=desc',
        {
          headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${token}`,
            'X-GitHub-Api-Version': '2022-11-28',
          },
        },
      )

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(
          body?.message || `GitHub respondió con HTTP ${response.status}.`,
        )
      }

      const data = (await response.json()) as GithubRepo[]
      setRepos(data)

      if (user) {
        const rows = data.map((repo) => ({
          user_id: user.id,
          github_repo_id: String(repo.id),
          name: repo.name,
          full_name: repo.full_name,
          html_url: repo.html_url,
          description: repo.description,
          private: repo.private,
          default_branch: repo.default_branch,
          language: repo.language,
          stars: repo.stargazers_count,
          forks: repo.forks_count,
          updated_at: repo.updated_at,
        }))

        if (rows.length > 0) {
          const { error: repoError } = await supabase
            .from('github_repositories')
            .upsert(rows, {
              onConflict: 'user_id,github_repo_id',
            })

          if (repoError) {
            throw new Error(
              `Los repositorios llegaron desde GitHub, pero no se pudieron guardar en Supabase: ${repoError.message}`,
            )
          }
        }
      }

      setSuccess(`${data.length} repositorio(s) sincronizado(s).`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los repositorios.')
    } finally {
      setLoadingRepos(false)
    }
  }

  async function disconnectGithub() {
    setError('')
    setSuccess('')

    if (!user) return

    await supabase.from('github_repositories').delete().eq('user_id', user.id)
    await supabase.from('github_connections').delete().eq('user_id', user.id)

    setConnection(null)
    setRepos([])
    setSuccess('GitHub desconectado.')
  }

  useEffect(() => {
    let active = true

    async function init() {
      await loadConnection()

      const { data } = await supabase.auth.getSession()
      const hasGithubIdentity = Boolean(
        data.session?.user?.identities?.some(
          (identity) => identity.provider === 'github',
        ),
      )

      if (active && hasGithubIdentity) {
        await saveConnectionAfterOAuth()
      }
    }

    init()

    return () => {
      active = false
    }
  }, [user?.id])

  if (loading) {
    return (
      <div className="p-6 text-zinc-400">
        Cargando integración de GitHub...
      </div>
    )
  }

  return (
    <div className="min-h-full p-6 md:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-3">
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
                <Code2 size={25} />
              </div>
              <h1 className="text-3xl font-bold text-white">GitHub</h1>
            </div>
            <p className="text-zinc-400">
              Conecta GitHub y sincroniza tus repositorios con Developer OS.
            </p>
          </div>

          {connected ? (
            <button
              onClick={disconnectGithub}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-900/60 bg-red-950/30 px-4 py-2 text-sm font-medium text-red-300 hover:bg-red-950/50"
            >
              <Unplug size={17} />
              Desconectar
            </button>
          ) : (
            <button
              onClick={connectGithub}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-black hover:bg-zinc-200"
            >
              <Code2 size={18} />
              Conectar GitHub
            </button>
          )}
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-900/60 bg-red-950/30 p-4 text-sm text-red-300">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-emerald-900/60 bg-emerald-950/30 p-4 text-sm text-emerald-300">
            <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {!connected ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-8 text-center">
            <Code2 size={48} className="mx-auto mb-4 text-zinc-500" />
            <h2 className="mb-2 text-xl font-semibold text-white">
              GitHub no está conectado
            </h2>
            <p className="mx-auto mb-6 max-w-lg text-sm text-zinc-400">
              Conecta tu cuenta para consultar tus repositorios y comenzar a
              sincronizar tu actividad con Developer OS.
            </p>
            <button
              onClick={connectGithub}
              className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-black"
            >
              <Code2 size={18} />
              Conectar GitHub
            </button>
          </div>
        ) : (
          <>
            <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800">
                    <Code2 size={24} />
                  </div>

                  <div>
                    <p className="font-semibold text-white">
                      @{connection?.github_username || 'GitHub'}
                    </p>
                    <p className="text-sm text-zinc-500">
                      Cuenta conectada
                    </p>
                  </div>
                </div>

                <button
                  onClick={loadRepositories}
                  disabled={loadingRepos}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
                >
                  <RefreshCw
                    size={16}
                    className={loadingRepos ? 'animate-spin' : ''}
                  />
                  {loadingRepos ? 'Sincronizando...' : 'Sincronizar repositorios'}
                </button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
                <p className="text-sm text-zinc-500">Repositorios</p>
                <p className="mt-2 text-3xl font-bold text-white">
                  {repos.length}
                </p>
              </div>

              <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
                <p className="text-sm text-zinc-500">Privados</p>
                <p className="mt-2 text-3xl font-bold text-white">
                  {repos.filter((repo) => repo.private).length}
                </p>
              </div>

              <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
                <p className="text-sm text-zinc-500">Públicos</p>
                <p className="mt-2 text-3xl font-bold text-white">
                  {repos.filter((repo) => !repo.private).length}
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    Repositorios
                  </h2>
                  <p className="text-sm text-zinc-500">
                    Repositorios disponibles en tu cuenta de GitHub.
                  </p>
                </div>
              </div>

              {repos.length === 0 ? (
                <div className="py-10 text-center text-sm text-zinc-500">
                  Todavía no hay repositorios sincronizados.
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {repos.map((repo) => (
                    <div
                      key={repo.id}
                      className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5"
                    >
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate font-semibold text-white">
                            {repo.name}
                          </h3>
                          <p className="mt-1 text-xs text-zinc-500">
                            {repo.private ? 'Privado' : 'Público'} ·{' '}
                            {repo.default_branch}
                          </p>
                        </div>

                        <a
                          href={repo.html_url}
                          target="_blank"
                          rel="noreferrer"
                          className="shrink-0 text-zinc-500 hover:text-white"
                          title="Abrir en GitHub"
                        >
                          <ExternalLink size={17} />
                        </a>
                      </div>

                      <p className="mb-4 min-h-10 text-sm text-zinc-400">
                        {repo.description || 'Sin descripción.'}
                      </p>

                      <div className="flex flex-wrap gap-4 text-xs text-zinc-500">
                        <span className="inline-flex items-center gap-1.5">
                          <GitBranch size={14} />
                          {repo.language || 'Sin lenguaje'}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <GitCommit size={14} />
                          {repo.default_branch}
                        </span>
                        <span>★ {repo.stargazers_count}</span>
                        <span>Forks {repo.forks_count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
