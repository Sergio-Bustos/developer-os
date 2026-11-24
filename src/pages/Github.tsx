import { useEffect, useState } from 'react'
import { ExternalLink, RefreshCw } from '../components/Icons'
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

// Color de cada lenguaje (los mismos que usa GitHub)
const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572a5',
  HTML: '#e34c26',
  CSS: '#663399',
  Java: '#b07219',
  'C#': '#178600',
  'C++': '#f34b7d',
  C: '#555555',
  PHP: '#4f5d95',
  Go: '#00add8',
  Rust: '#dea584',
  Shell: '#89e051',
  Vue: '#41b883',
  Dart: '#00b4ab',
  Kotlin: '#a97bff',
  Swift: '#f05138',
}

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
    return <p className="gh-loading">Cargando integración de GitHub...</p>
  }

  const privateCount = repos.filter((repo) => repo.private).length

  return (
    <div className="gh">
      <header className="gh-head">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold text-white">GitHub</h1>
          <p className="mt-2 text-zinc-400">
            Conecta GitHub y sincroniza tus repositorios con Developer OS.
          </p>
        </div>

        {connected ? (
          <button onClick={disconnectGithub} className="btn-quiet btn-danger">
            Desconectar
          </button>
        ) : (
          <button onClick={connectGithub} className="btn-main bg-white">
            Conectar GitHub
          </button>
        )}
      </header>

      {error && (
        <div role="alert" className="note note-error">
          {error}
        </div>
      )}

      {success && (
        <div role="status" className="note note-ok">
          {success}
        </div>
      )}

      {!connected ? (
        <section className="gh-empty">
          <h2>GitHub no está conectado</h2>
          <p>
            Conecta tu cuenta para consultar tus repositorios y comenzar a
            sincronizar tu actividad con Developer OS.
          </p>
          <button onClick={connectGithub} className="btn-main bg-white">
            Conectar GitHub
          </button>
        </section>
      ) : (
        <>
          <section className="gh-account">
            <div className="gh-user">
              <span className="gh-avatar" aria-hidden="true">
                {(connection?.github_username || 'G').charAt(0).toUpperCase()}
              </span>

              <div className="min-w-0">
                <p className="gh-handle">
                  @{connection?.github_username || 'GitHub'}
                </p>
                <p className="gh-sub">Cuenta conectada</p>
              </div>
            </div>

            <button
              onClick={loadRepositories}
              disabled={loadingRepos}
              className="btn-quiet"
            >
              <RefreshCw size={15} className={loadingRepos ? 'animate-spin' : ''} />
              {loadingRepos ? 'Sincronizando...' : 'Sincronizar repositorios'}
            </button>
          </section>

          <section className="gh-stats">
            <div>
              <p className="gh-stat-n">{repos.length}</p>
              <p className="gh-stat-l">Repositorios</p>
            </div>
            <div>
              <p className="gh-stat-n">{privateCount}</p>
              <p className="gh-stat-l">Privados</p>
            </div>
            <div>
              <p className="gh-stat-n">{repos.length - privateCount}</p>
              <p className="gh-stat-l">Públicos</p>
            </div>
          </section>

          <section>
            <div className="gh-list-head">
              <h2>Repositorios</h2>
              <p>Repositorios disponibles en tu cuenta de GitHub.</p>
            </div>

            {repos.length === 0 ? (
              <p className="gh-none">Todavía no hay repositorios sincronizados.</p>
            ) : (
              <ul className="repo-list">
                {repos.map((repo) => (
                  <li key={repo.id} className="repo">
                    <div className="repo-top">
                      <div className="min-w-0">
                        <h3 className="repo-name">{repo.name}</h3>
                        <p className="repo-meta">
                          {repo.private ? 'Privado' : 'Público'} · {repo.default_branch}
                        </p>
                      </div>

                      <a
                        href={repo.html_url}
                        target="_blank"
                        rel="noreferrer"
                        className="repo-link"
                        title="Abrir en GitHub"
                        aria-label={`Abrir ${repo.name} en GitHub`}
                      >
                        <ExternalLink size={17} />
                      </a>
                    </div>

                    <p className="repo-desc">
                      {repo.description || 'Sin descripción.'}
                    </p>

                    <dl className="repo-stats">
                      <div className="repo-lang">
                        <span
                          className="lang-dot"
                          style={{
                            background: repo.language
                              ? LANGUAGE_COLORS[repo.language] || '#8b98a3'
                              : 'transparent',
                            borderColor: repo.language ? 'transparent' : undefined,
                          }}
                        />
                        <dd>{repo.language || 'Sin lenguaje'}</dd>
                      </div>
                      <div>
                        <dt>Estrellas</dt>
                        <dd>{repo.stargazers_count}</dd>
                      </div>
                      <div>
                        <dt>Forks</dt>
                        <dd>{repo.forks_count}</dd>
                      </div>
                    </dl>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}
