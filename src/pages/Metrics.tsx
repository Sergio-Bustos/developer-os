import { useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  Code2,
  GitBranch,
  GitCommit,
  Lock,
  RefreshCw,
  Star,
  GitFork,
  Globe2,
  AlertCircle,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

type Repository = {
  user_id: string
  name: string
  full_name: string
  html_url: string
  description: string | null
  private: boolean
  language: string | null
  stars: number | null
  forks: number | null
  updated_at: string
}

type LanguageMetric = {
  name: string
  count: number
  percent: number
}

function formatDate(value: string | null) {
  if (!value) return '—'

  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('es-CO').format(value)
}

export default function Metrics() {
  const { user } = useAuth()

  const [repositories, setRepositories] = useState<Repository[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  async function loadMetrics() {
    if (!user) return

    setError('')

    const { data, error: dbError } = await supabase
      .from('github_repositories')
      .select(
        'user_id, name, full_name, html_url, description, private, language, stars, forks, updated_at',
      )
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })

    if (dbError) {
      setError(dbError.message)
      setRepositories([])
    } else {
      setRepositories((data || []) as Repository[])
    }

    setLoading(false)
    setRefreshing(false)
  }

  async function refreshMetrics() {
    setRefreshing(true)
    await loadMetrics()
  }

  useEffect(() => {
    loadMetrics()
  }, [user?.id])

  const publicCount = repositories.filter((repo) => !repo.private).length
  const privateCount = repositories.filter((repo) => repo.private).length

  const totalStars = repositories.reduce(
    (total, repo) => total + Number(repo.stars || 0),
    0,
  )

  const totalForks = repositories.reduce(
    (total, repo) => total + Number(repo.forks || 0),
    0,
  )

  const languages = useMemo<LanguageMetric[]>(() => {
    const counts = new Map<string, number>()

    repositories.forEach((repo) => {
      const language = repo.language?.trim()

      if (!language) return

      counts.set(language, (counts.get(language) || 0) + 1)
    })

    const total = Array.from(counts.values()).reduce(
      (sum, value) => sum + value,
      0,
    )

    return Array.from(counts.entries())
      .map(([name, count]) => ({
        name,
        count,
        percent: total ? Math.round((count / total) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count)
  }, [repositories])

  const mostStarred = [...repositories]
    .sort((a, b) => Number(b.stars || 0) - Number(a.stars || 0))
    .slice(0, 5)

  const mostForked = [...repositories]
    .sort((a, b) => Number(b.forks || 0) - Number(a.forks || 0))
    .slice(0, 5)

  const recentRepositories = repositories.slice(0, 7)

  const lastUpdated = repositories.reduce<string | null>((latest, repo) => {
    if (!latest) return repo.updated_at

    return new Date(repo.updated_at) > new Date(latest)
      ? repo.updated_at
      : latest
  }, null)

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
        <header className="mb-8">
          <div className="mb-3 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-3">
                <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
                  <BarChart3 size={25} />
                </div>

                <h1 className="text-3xl font-bold text-white">
                  Metrics
                </h1>
              </div>

              <p className="max-w-2xl text-zinc-400">
                Métricas de tus repositorios de GitHub almacenados en
                Developer OS.
              </p>
            </div>

            <button
              onClick={refreshMetrics}
              disabled={refreshing}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
            >
              <RefreshCw
                size={16}
                className={refreshing ? 'animate-spin' : ''}
              />
              {refreshing ? 'Actualizando...' : 'Actualizar métricas'}
            </button>
          </div>

          <p className="text-xs text-zinc-600">
            Última actualización registrada:{' '}
            <span className="text-zinc-500">{formatDate(lastUpdated)}</span>
          </p>
        </header>

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-900/60 bg-red-950/30 p-4 text-sm text-red-300">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {repositories.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-10 text-center">
            <Code2 size={42} className="mx-auto mb-4 text-zinc-600" />

            <h2 className="mb-2 text-xl font-semibold text-white">
              No hay repositorios sincronizados
            </h2>

            <p className="mx-auto max-w-lg text-sm text-zinc-500">
              Ve a GitHub, conecta tu cuenta y sincroniza tus repositorios.
              Cuando estén guardados en Supabase aparecerán aquí
              automáticamente.
            </p>
          </div>
        ) : (
          <>
            <section
              className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5"
              aria-label="Resumen"
            >
              <MetricCard
                icon={<GitBranch size={18} />}
                label="Repositorios"
                value={formatNumber(repositories.length)}
              />

              <MetricCard
                icon={<Globe2 size={18} />}
                label="Públicos"
                value={formatNumber(publicCount)}
              />

              <MetricCard
                icon={<Lock size={18} />}
                label="Privados"
                value={formatNumber(privateCount)}
              />

              <MetricCard
                icon={<Star size={18} />}
                label="Stars"
                value={formatNumber(totalStars)}
              />

              <MetricCard
                icon={<GitFork size={18} />}
                label="Forks"
                value={formatNumber(totalForks)}
              />
            </section>

            <div className="grid gap-6 lg:grid-cols-2">
              <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
                <div className="mb-5">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-600">
                    Distribución
                  </p>

                  <h2 className="mt-1 text-xl font-semibold text-white">
                    Lenguajes
                  </h2>
                </div>

                {languages.length === 0 ? (
                  <p className="text-sm text-zinc-500">
                    No hay lenguajes registrados en los repositorios.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {languages.map((language) => (
                      <div key={language.name}>
                        <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                          <span className="text-zinc-300">
                            {language.name}
                          </span>

                          <span className="text-zinc-600">
                            {language.count} · {language.percent}%
                          </span>
                        </div>

                        <div className="h-2 overflow-hidden rounded-full bg-zinc-900">
                          <div
                            className="h-full rounded-full bg-white"
                            style={{ width: `${language.percent}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
                <div className="mb-5">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-600">
                    Actividad
                  </p>

                  <h2 className="mt-1 text-xl font-semibold text-white">
                    Repositorios actualizados recientemente
                  </h2>
                </div>

                <div className="space-y-3">
                  {recentRepositories.map((repo) => (
                    <a
                      key={repo.full_name}
                      href={repo.html_url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between gap-4 rounded-xl border border-zinc-900 bg-zinc-900/40 px-4 py-3 transition hover:border-zinc-700"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-zinc-200">
                          {repo.name}
                        </p>

                        <p className="mt-1 text-xs text-zinc-600">
                          {formatDate(repo.updated_at)}
                        </p>
                      </div>

                      <GitCommit
                        size={17}
                        className="shrink-0 text-zinc-600"
                      />
                    </a>
                  ))}
                </div>
              </section>

              <RepositoryRanking
                title="Más estrellas"
                icon={<Star size={18} />}
                repositories={mostStarred}
                metric="stars"
              />

              <RepositoryRanking
                title="Más forks"
                icon={<GitFork size={18} />}
                repositories={mostForked}
                metric="forks"
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-zinc-600">{icon}</span>
      </div>

      <p className="text-sm text-zinc-500">{label}</p>

      <p className="mt-2 text-3xl font-bold text-white">{value}</p>
    </article>
  )
}

function RepositoryRanking({
  title,
  icon,
  repositories,
  metric,
}: {
  title: string
  icon: React.ReactNode
  repositories: Repository[]
  metric: 'stars' | 'forks'
}) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
      <div className="mb-5 flex items-center gap-2">
        <span className="text-zinc-600">{icon}</span>

        <h2 className="text-xl font-semibold text-white">{title}</h2>
      </div>

      {repositories.length === 0 ? (
        <p className="text-sm text-zinc-500">
          Todavía no hay datos para mostrar.
        </p>
      ) : (
        <div className="space-y-3">
          {repositories.map((repo, index) => {
            const value = Number(repo[metric] || 0)

            return (
              <a
                key={repo.full_name}
                href={repo.html_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-4 rounded-xl border border-zinc-900 bg-zinc-900/40 px-4 py-3 transition hover:border-zinc-700"
              >
                <span className="w-5 text-sm text-zinc-700">
                  {index + 1}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-zinc-200">
                    {repo.name}
                  </p>

                  <p className="mt-1 truncate text-xs text-zinc-600">
                    {repo.full_name}
                  </p>
                </div>

                <span className="shrink-0 text-sm font-semibold text-zinc-400">
                  {formatNumber(value)}
                </span>
              </a>
            )
          })}
        </div>
      )}
    </section>
  )
}
