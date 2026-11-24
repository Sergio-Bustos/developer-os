import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Activity,
  GitCommit,
  RefreshCw,
  Star,
  GitFork,
  Lock,
  Globe,
  AlertCircle,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

type Repo = {
  github_repo_id?: string | null
  name: string
  full_name: string
  html_url: string
  description: string | null
  private: boolean
  language: string | null
  stars: number | null
  forks: number | null
  updated_at: string | null
  default_branch?: string | null
}

type Commit = {
  sha: string
  message: string
  html_url: string
  repo: string
  author: string
  date: string
}

type GithubCommit = {
  sha: string
  html_url: string
  commit: {
    message: string
    author: {
      name: string
      date: string
    } | null
  }
}

export default function Metrics() {
  const { user } = useAuth()

  const [repos, setRepos] = useState<Repo[]>([])
  const [commits, setCommits] = useState<Commit[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingCommits, setLoadingCommits] = useState(false)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  async function loadMetrics() {
    if (!user) return

    setError('')
    setLoading(true)

    const { data, error: dbError } = await supabase
      .from('github_repositories')
      .select(
        'github_repo_id, name, full_name, html_url, description, private, language, stars, forks, updated_at, default_branch',
      )
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })

    if (dbError) {
      setError(dbError.message)
      setRepos([])
    } else {
      setRepos((data || []) as Repo[])
    }

    setLastUpdated(new Date())
    setLoading(false)
  }

  async function loadCommits(repoList: Repo[]) {
    setLoadingCommits(true)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.provider_token

      if (!token) {
        throw new Error(
          'No hay token de GitHub disponible. Vuelve a conectar GitHub.',
        )
      }

      const headers = {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      }

      const results = await Promise.allSettled(
        repoList.map(async (repo) => {
          const branch = repo.default_branch || 'HEAD'
          const response = await fetch(
            `https://api.github.com/repos/${encodeURIComponent(
              repo.full_name,
            )}/commits?sha=${encodeURIComponent(branch)}&per_page=10`,
            { headers },
          )

          if (!response.ok) {
            return []
          }

          const data = (await response.json()) as GithubCommit[]

          return data.map((item) => ({
            sha: item.sha,
            message: item.commit.message.split('\n')[0],
            html_url: item.html_url,
            repo: repo.full_name,
            author: item.commit.author?.name || 'Autor desconocido',
            date:
              item.commit.author?.date ||
              new Date().toISOString(),
          }))
        }),
      )

      const allCommits = results.flatMap((result) =>
        result.status === 'fulfilled' ? result.value : [],
      )

      allCommits.sort(
        (a, b) =>
          new Date(b.date).getTime() - new Date(a.date).getTime(),
      )

      setCommits(allCommits)
    } catch (err) {
      setCommits([])
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudieron cargar los commits.',
      )
    } finally {
      setLoadingCommits(false)
    }
  }

  async function refresh() {
    await loadMetrics()
  }

  useEffect(() => {
    loadMetrics()
  }, [user?.id])

  useEffect(() => {
    if (repos.length > 0) {
      loadCommits(repos)
    } else {
      setCommits([])
    }
  }, [repos])

  const publicRepos = repos.filter((repo) => !repo.private).length
  const privateRepos = repos.filter((repo) => repo.private).length
  const totalStars = repos.reduce((sum, repo) => sum + (repo.stars || 0), 0)
  const totalForks = repos.reduce((sum, repo) => sum + (repo.forks || 0), 0)

  const languageStats = useMemo(() => {
    const counts = new Map<string, number>()

    repos.forEach((repo) => {
      const language = repo.language || 'Sin lenguaje'
      counts.set(language, (counts.get(language) || 0) + 1)
    })

    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [repos])

  const topStars = [...repos]
    .sort((a, b) => (b.stars || 0) - (a.stars || 0))
    .slice(0, 5)

  const topForks = [...repos]
    .sort((a, b) => (b.forks || 0) - (a.forks || 0))
    .slice(0, 5)

  const recentRepos = [...repos]
    .sort(
      (a, b) =>
        new Date(b.updated_at || 0).getTime() -
        new Date(a.updated_at || 0).getTime(),
    )
    .slice(0, 5)

  const formatDate = (value: string) =>
    new Intl.DateTimeFormat('es-CO', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value))

  if (loading) {
    return (
      <div className="p-6 text-zinc-400">
        Cargando métricas...
      </div>
    )
  }

  return (
    <div className="min-h-full p-6 md:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-3">
              <h1 className="mb-2 text-3xl font-bold text-white">Metrics</h1>
            </div>

            <p className="text-zinc-400">
              Estadísticas de tus repositorios y actividad reciente de GitHub.
            </p>

            {lastUpdated && (
              <p className="mt-2 text-xs text-zinc-600">
                Actualizado: {formatDate(lastUpdated.toISOString())}
              </p>
            )}
          </div>

          <button
            onClick={refresh}
            disabled={loading || loadingCommits}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
          >
            <RefreshCw
              size={16}
              className={loadingCommits ? 'animate-spin' : ''}
            />
            {loadingCommits ? 'Actualizando...' : 'Actualizar'}
          </button>
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-900/60 bg-red-950/30 p-4 text-sm text-red-300">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {repos.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-10 text-center">
            <Activity size={42} className="mx-auto mb-4 text-zinc-600" />
            <h2 className="text-xl font-semibold text-white">
              No hay repositorios sincronizados
            </h2>
            <p className="mt-2 text-sm text-zinc-500">
              Ve a GitHub y sincroniza tus repositorios para generar métricas.
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <MetricCard
                label="Repositorios"
                value={repos.length}
                icon={<Activity size={20} />}
              />
              <MetricCard
                label="Públicos"
                value={publicRepos}
                icon={<Globe size={20} />}
              />
              <MetricCard
                label="Privados"
                value={privateRepos}
                icon={<Lock size={20} />}
              />
              <MetricCard
                label="Stars"
                value={totalStars}
                icon={<Star size={20} />}
              />
              <MetricCard
                label="Forks"
                value={totalForks}
                icon={<GitFork size={20} />}
              />
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <Section title="Lenguajes">
                {languageStats.length === 0 ? (
                  <p className="text-sm text-zinc-500">Sin datos.</p>
                ) : (
                  <div className="space-y-3">
                    {languageStats.map(([language, count]) => (
                      <div key={language}>
                        <div className="mb-1 flex justify-between text-sm">
                          <span className="text-zinc-300">{language}</span>
                          <span className="text-zinc-500">{count}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                          <div
                            className="h-full rounded-full bg-zinc-400"
                            style={{
                              width: `${Math.max(
                                6,
                                (count / repos.length) * 100,
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              <Section title="Actividad reciente">
                {commits.length === 0 ? (
                  <p className="text-sm text-zinc-500">
                    {loadingCommits
                      ? 'Cargando commits...'
                      : 'No se encontraron commits recientes.'}
                  </p>
                ) : (
                  <div className="space-y-4">
                    {commits.slice(0, 8).map((commit) => (
                      <a
                        key={commit.sha}
                        href={commit.html_url}
                        target="_blank"
                        rel="noreferrer"
                        className="block rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 transition hover:border-zinc-700 hover:bg-zinc-900"
                      >
                        <div className="flex gap-3">
                          <GitCommit
                            size={17}
                            className="mt-0.5 shrink-0 text-zinc-500"
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-zinc-200">
                              {commit.message}
                            </p>
                            <p className="mt-1 text-xs text-zinc-500">
                              {commit.repo} · {commit.author}
                            </p>
                            <p className="mt-1 text-xs text-zinc-600">
                              {formatDate(commit.date)}
                            </p>
                          </div>
                        </div>
                      </a>
                    ))}
                  </div>
                )}
              </Section>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <RepoRanking
                title="Repositorios con más stars"
                icon={<Star size={18} />}
                repos={topStars}
                metric="stars"
              />

              <RepoRanking
                title="Repositorios con más forks"
                icon={<GitFork size={18} />}
                repos={topForks}
                metric="forks"
              />
            </div>

            <Section title="Repositorios actualizados recientemente" className="mt-6">
              <div className="divide-y divide-zinc-800">
                {recentRepos.map((repo) => (
                  <a
                    key={repo.full_name}
                    href={repo.html_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex flex-col gap-2 py-4 transition hover:bg-zinc-900/30 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-zinc-200">
                        {repo.full_name}
                      </p>
                      <p className="mt-1 truncate text-sm text-zinc-500">
                        {repo.description || 'Sin descripción.'}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-4 text-xs text-zinc-500">
                      <span>{repo.language || 'Sin lenguaje'}</span>
                      <span>{repo.updated_at ? formatDate(repo.updated_at) : 'Sin fecha'}</span>
                    </div>
                  </a>
                ))}
              </div>
            </Section>
          </>
        )}
      </div>
    </div>
  )
}

function MetricCard({
  label,
  value,
  icon,
}: {
  label: string
  value: number
  icon: ReactNode
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm text-zinc-500">{label}</span>
        <span className="text-zinc-600">{icon}</span>
      </div>
      <p className="text-3xl font-bold text-white">{value.toLocaleString('es-CO')}</p>
    </div>
  )
}

function Section({
  title,
  children,
  className = '',
}: {
  title: string
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={`rounded-2xl border border-zinc-800 bg-zinc-950 p-5 ${className}`}
    >
      <h2 className="mb-5 text-lg font-semibold text-white">{title}</h2>
      {children}
    </section>
  )
}

function RepoRanking({
  title,
  icon,
  repos,
  metric,
}: {
  title: string
  icon: ReactNode
  repos: Repo[]
  metric: 'stars' | 'forks'
}) {
  return (
    <Section title={title}>
      <div className="space-y-3">
        {repos.map((repo, index) => (
          <a
            key={repo.full_name}
            href={repo.html_url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 hover:border-zinc-700"
          >
            <span className="w-5 text-sm text-zinc-600">{index + 1}</span>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-zinc-200">
                {repo.full_name}
              </p>
              <p className="text-xs text-zinc-600">
                {repo.private ? 'Privado' : 'Público'}
              </p>
            </div>

            <span className="inline-flex items-center gap-1.5 text-sm text-zinc-400">
              {icon}
              {metric === 'stars' ? repo.stars || 0 : repo.forks || 0}
            </span>
          </a>
        ))}
      </div>
    </Section>
  )
}
