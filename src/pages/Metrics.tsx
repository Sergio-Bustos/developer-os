import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Activity,
  GitCommit,
  GitPullRequest,
  CircleDot,
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

type Count = {
  total: number
  open: number
  closed: number
}

type GHCommit = {
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

type GHSearch = {
  total_count: number
}

export default function Metrics() {
  const { user } = useAuth()
  const [repos, setRepos] = useState<Repo[]>([])
  const [commits, setCommits] = useState<Commit[]>([])
  const [pulls, setPulls] = useState<Count>({
    total: 0,
    open: 0,
    closed: 0,
  })
  const [issues, setIssues] = useState<Count>({
    total: 0,
    open: 0,
    closed: 0,
  })
  const [loading, setLoading] = useState(true)
  const [loadingGithub, setLoadingGithub] = useState(false)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  async function gh<T>(url: string, token: string): Promise<T> {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    })

    if (!response.ok) {
      const body = await response.json().catch(() => null)
      throw new Error(
        body?.message || `GitHub respondió con HTTP ${response.status}.`,
      )
    }

    return response.json() as Promise<T>
  }

  async function loadMetrics() {
    if (!user) return

    setError('')
    setLoading(true)

    const { data, error } = await supabase
      .from('github_repositories')
      .select(
        'github_repo_id,name,full_name,html_url,description,private,language,stars,forks,updated_at,default_branch',
      )
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })

    if (error) {
      setError(error.message)
      setRepos([])
    } else {
      setRepos((data || []) as Repo[])
    }

    setLastUpdated(new Date())
    setLoading(false)
  }

  async function loadGithub(repoList: Repo[]) {
    if (!repoList.length) {
      setCommits([])
      setPulls({ total: 0, open: 0, closed: 0 })
      setIssues({ total: 0, open: 0, closed: 0 })
      return
    }

    setLoadingGithub(true)

    try {
      const { data } = await supabase.auth.getSession()

      const token = data.session?.provider_token ?? ''

      if (!token) {
        throw new Error(
          'No hay token de GitHub disponible. Vuelve a conectar GitHub.',
        )
      }

      const commitResults = await Promise.allSettled(
        repoList.map(async (repo) => {
          const branch = repo.default_branch || 'HEAD'

          const data = await gh<GHCommit[]>(
            `https://api.github.com/repos/${encodeURIComponent(
              repo.full_name,
            )}/commits?sha=${encodeURIComponent(branch)}&per_page=10`,
            token,
          )

          return data.map((item) => ({
            sha: item.sha,
            message: item.commit.message.split('\n')[0],
            html_url: item.html_url,
            repo: repo.full_name,
            author: item.commit.author?.name || 'Autor desconocido',
            date:
              item.commit.author?.date || new Date().toISOString(),
          }))
        }),
      )

      const allCommits = commitResults.flatMap((result) =>
        result.status === 'fulfilled' ? result.value : [],
      )

      allCommits.sort(
        (a, b) =>
          new Date(b.date).getTime() - new Date(a.date).getTime(),
      )

      setCommits(allCommits)

      async function count(
        repo: Repo,
        kind: 'pr' | 'issue',
      ): Promise<Count> {
        const base = `repo:${repo.full_name} is:${kind}`

        const [all, open, closed] = await Promise.all([
          gh<GHSearch>(
            `https://api.github.com/search/issues?q=${encodeURIComponent(
              base,
            )}`,
            token,
          ),
          gh<GHSearch>(
            `https://api.github.com/search/issues?q=${encodeURIComponent(
              `${base} is:open`,
            )}`,
            token,
          ),
          gh<GHSearch>(
            `https://api.github.com/search/issues?q=${encodeURIComponent(
              `${base} is:closed`,
            )}`,
            token,
          ),
        ])

        return {
          total: all.total_count,
          open: open.total_count,
          closed: closed.total_count,
        }
      }

      function sum(
        results: PromiseSettledResult<Count>[],
      ): Count {
        return results.reduce(
          (acc, result) =>
            result.status === 'fulfilled'
              ? {
                  total: acc.total + result.value.total,
                  open: acc.open + result.value.open,
                  closed: acc.closed + result.value.closed,
                }
              : acc,
          { total: 0, open: 0, closed: 0 },
        )
      }

      const [prResults, issueResults] = await Promise.all([
        Promise.allSettled(repoList.map((repo) => count(repo, 'pr'))),
        Promise.allSettled(repoList.map((repo) => count(repo, 'issue'))),
      ])

      setPulls(sum(prResults))
      setIssues(sum(issueResults))
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'No se pudo cargar la actividad de GitHub.',
      )
    } finally {
      setLoadingGithub(false)
    }
  }

  useEffect(() => {
    loadMetrics()
  }, [user?.id])

  useEffect(() => {
    loadGithub(repos)
  }, [repos])

  const publicRepos = repos.filter((repo) => !repo.private).length
  const privateRepos = repos.length - publicRepos
  const stars = repos.reduce((sum, repo) => sum + (repo.stars || 0), 0)
  const forks = repos.reduce((sum, repo) => sum + (repo.forks || 0), 0)

  const languages = useMemo(() => {
    const counts = new Map<string, number>()

    repos.forEach((repo) => {
      const language = repo.language || 'Sin lenguaje'
      counts.set(language, (counts.get(language) || 0) + 1)
    })

    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [repos])

  const recentRepos = [...repos]
    .sort(
      (a, b) =>
        new Date(b.updated_at || 0).getTime() -
        new Date(a.updated_at || 0).getTime(),
    )
    .slice(0, 5)

  const recentCommits = commits.slice(0, 8)

  const fmt = (value: string) =>
    new Intl.DateTimeFormat('es-CO', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value))

  if (loading) {
    return <div className="p-6 text-zinc-400">Cargando métricas...</div>
  }

  return (
    <div className="min-h-full p-6 md:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="mb-2 text-3xl font-bold text-white">
              Metrics
            </h1>

            <p className="text-zinc-400">
              Estadísticas de tus repositorios y actividad reciente de GitHub.
            </p>

            {lastUpdated && (
              <p className="mt-2 text-xs text-zinc-600">
                Actualizado: {fmt(lastUpdated.toISOString())}
              </p>
            )}
          </div>

          <button
            onClick={loadMetrics}
            disabled={loadingGithub}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
          >
            <RefreshCw
              size={16}
              className={loadingGithub ? 'animate-spin' : ''}
            />
            {loadingGithub ? 'Actualizando...' : 'Actualizar'}
          </button>
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-900/60 bg-red-950/30 p-4 text-sm text-red-300">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {repos.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-10 text-center">
            <h2 className="text-xl font-semibold text-white">
              No hay repositorios sincronizados
            </h2>
            <p className="mt-2 text-sm text-zinc-500">
              Ve a GitHub y sincroniza tus repositorios para generar métricas.
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-7">
              <Card
                label="Repositorios"
                value={repos.length}
                icon={<Activity size={20} />}
              />
              <Card
                label="Públicos"
                value={publicRepos}
                icon={<Globe size={20} />}
              />
              <Card
                label="Privados"
                value={privateRepos}
                icon={<Lock size={20} />}
              />
              <Card
                label="Stars"
                value={stars}
                icon={<Star size={20} />}
              />
              <Card
                label="Forks"
                value={forks}
                icon={<GitFork size={20} />}
              />
              <Card
                label="Pull Requests"
                value={pulls.total}
                icon={<GitPullRequest size={20} />}
              />
              <Card
                label="Issues"
                value={issues.total}
                icon={<CircleDot size={20} />}
              />
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-3">
              <Status title="Pull Requests" data={pulls} />
              <Status title="Issues" data={issues} />

              <Section title="Lenguajes">
                <div className="space-y-3">
                  {languages.map(([language, count]) => (
                    <div key={language}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span className="text-zinc-300">
                          {language}
                        </span>
                        <span className="text-zinc-500">
                          {count}
                        </span>
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
              </Section>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <Section title="Actividad reciente">
                {recentCommits.length ? (
                  recentCommits.map((commit) => (
                    <a
                      key={commit.sha}
                      href={commit.html_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mb-3 block rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 hover:border-zinc-700"
                    >
                      <div className="flex gap-3">
                        <GitCommit
                          size={17}
                          className="mt-0.5 text-zinc-500"
                        />

                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-zinc-200">
                            {commit.message}
                          </p>

                          <p className="mt-1 text-xs text-zinc-500">
                            {commit.repo} · {commit.author}
                          </p>

                          <p className="mt-1 text-xs text-zinc-600">
                            {fmt(commit.date)}
                          </p>
                        </div>
                      </div>
                    </a>
                  ))
                ) : (
                  <p className="text-sm text-zinc-500">
                    {loadingGithub
                      ? 'Cargando actividad...'
                      : 'No se encontraron commits recientes.'}
                  </p>
                )}
              </Section>

              <Section title="Repositorios actualizados recientemente">
                <div className="divide-y divide-zinc-800">
                  {recentRepos.map((repo) => (
                    <a
                      key={repo.full_name}
                      href={repo.html_url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex flex-col gap-2 py-4 md:flex-row md:items-center md:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-zinc-200">
                          {repo.full_name}
                        </p>

                        <p className="mt-1 truncate text-sm text-zinc-500">
                          {repo.description || 'Sin descripción.'}
                        </p>
                      </div>

                      <div className="flex shrink-0 gap-4 text-xs text-zinc-500">
                        <span>
                          {repo.language || 'Sin lenguaje'}
                        </span>
                        <span>
                          {repo.updated_at
                            ? fmt(repo.updated_at)
                            : 'Sin fecha'}
                        </span>
                      </div>
                    </a>
                  ))}
                </div>
              </Section>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Card({
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

      <p className="text-3xl font-bold text-white">
        {value.toLocaleString('es-CO')}
      </p>
    </div>
  )
}

function Status({
  title,
  data,
}: {
  title: string
  data: Count
}) {
  return (
    <Section title={title}>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
          <p className="text-xs text-zinc-500">Abiertos</p>
          <p className="mt-1 text-2xl font-bold text-white">
            {data.open}
          </p>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
          <p className="text-xs text-zinc-500">Cerrados</p>
          <p className="mt-1 text-2xl font-bold text-white">
            {data.closed}
          </p>
        </div>
      </div>
    </Section>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
      <h2 className="mb-5 text-lg font-semibold text-white">
        {title}
      </h2>
      {children}
    </section>
  )
}
