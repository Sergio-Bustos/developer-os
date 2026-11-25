import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { RefreshCw } from '../components/Icons'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Loader from '../components/Loader'

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

type Count = {
  total: number
  open: number
  closed: number
}

type Commit = {
  sha: string
  message: string
  html_url: string
  repo: string
  author: string
  date: string
}

type ActivityItem = {
  id: string
  type: 'commit' | 'pull' | 'issue'
  title: string
  repo: string
  author: string
  date: string
  html_url: string
  state?: string
  number?: number
}

type RepoInsight = {
  pullRequests: Count
  issues: Count
  commits30Days: number | null
  available: boolean
}

type GraphNode = {
  id: string
  number: number
  title: string
  state: string
  url: string
  updatedAt: string
  author: { login: string } | null
}

type GraphConnection = {
  totalCount: number
  nodes?: GraphNode[] | null
}

type GraphRepo = {
  pullRequestsOpen: { totalCount: number }
  pullRequestsClosed: { totalCount: number }
  recentPullRequests: GraphConnection
  issuesOpen: { totalCount: number }
  issuesClosed: { totalCount: number }
  recentIssues: GraphConnection
}

type GraphResponse = {
  data?: Record<string, GraphRepo | null> | null
  errors?: Array<{ message: string; path?: Array<string | number> }>
}

type CommitResponse = {
  sha: string
  html_url: string
  commit: {
    message: string
    author: { name: string; date: string } | null
    committer: { date: string } | null
  }
  author: { login: string } | null
}

type CommitFetchResult = {
  commits: Commit[]
  countByRepo: Record<string, number | null>
  warnings: string[]
}

type GraphFetchResult = {
  insights: Record<string, RepoInsight>
  activity: ActivityItem[]
  warnings: string[]
}

const DAYS_FOR_CHART = 14
const COMMIT_WINDOW_DAYS = 30
const COMMITS_PER_REPOSITORY = 100
const GRAPHQL_BATCH_SIZE = 10

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results = new Array<PromiseSettledResult<R>>(items.length)
  let nextIndex = 0

  const worker = async () => {
    while (true) {
      const index = nextIndex
      nextIndex += 1
      if (index >= items.length) return

      try {
        results[index] = {
          status: 'fulfilled',
          value: await mapper(items[index]),
        }
      } catch (reason) {
        results[index] = { status: 'rejected', reason }
      }
    }
  }

  const workerCount = Math.min(Math.max(1, limit), items.length)
  await Promise.all(Array.from({ length: workerCount }, () => worker()))
  return results
}

async function githubRest<T>(url: string, token: string): Promise<T> {
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

function buildGraphQLQuery(repositories: Repo[]): string {
  const fields = repositories.map((repo, index) => {
    const [owner, ...nameParts] = repo.full_name.split('/')
    const repositoryName = nameParts.join('/')

    return `
      repository${index}: repository(
        owner: ${JSON.stringify(owner)}
        name: ${JSON.stringify(repositoryName)}
      ) {
        pullRequestsOpen: pullRequests(states: [OPEN]) {
          totalCount
        }
        pullRequestsClosed: pullRequests(states: [CLOSED, MERGED]) {
          totalCount
        }
        recentPullRequests: pullRequests(
          first: 5
          orderBy: { field: UPDATED_AT, direction: DESC }
        ) {
          nodes {
            id
            number
            title
            state
            url
            updatedAt
            author { login }
          }
        }
        issuesOpen: issues(states: [OPEN]) {
          totalCount
        }
        issuesClosed: issues(states: [CLOSED]) {
          totalCount
        }
        recentIssues: issues(
          first: 5
          orderBy: { field: UPDATED_AT, direction: DESC }
        ) {
          nodes {
            id
            number
            title
            state
            url
            updatedAt
            author { login }
          }
        }
      }
    `
  })

  return `query DeveloperOSMetrics { ${fields.join('\n')} }`
}

async function fetchGraphQLMetrics(
  repositories: Repo[],
  token: string,
): Promise<GraphFetchResult> {
  const insights: Record<string, RepoInsight> = {}
  const activity: ActivityItem[] = []
  const warnings: string[] = []

  for (let offset = 0; offset < repositories.length; offset += GRAPHQL_BATCH_SIZE) {
    const batch = repositories.slice(offset, offset + GRAPHQL_BATCH_SIZE)
    const query = buildGraphQLQuery(batch)

    const response = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({ query }),
    })

    const payload = (await response.json().catch(() => null)) as GraphResponse | null

    if (!response.ok) {
      const message = payload?.errors?.map((item) => item.message).join('; ')
      throw new Error(
        message || `GitHub GraphQL respondió con HTTP ${response.status}.`,
      )
    }

    if (!payload?.data) {
      const message = payload?.errors?.map((item) => item.message).join('; ')
      throw new Error(message || 'GitHub no devolvió datos de Pull Requests e Issues.')
    }

    if (payload.errors?.length) {
      warnings.push(
        ...payload.errors.map((item) => item.message).filter(Boolean),
      )
    }

    batch.forEach((repo, index) => {
      const repoData = payload.data?.[`repository${index}`]

      if (!repoData) {
        insights[repo.full_name] = {
          pullRequests: { total: 0, open: 0, closed: 0 },
          issues: { total: 0, open: 0, closed: 0 },
          commits30Days: null,
          available: false,
        }
        warnings.push(`No se pudieron consultar PR e Issues de ${repo.full_name}.`)
        return
      }

      const pullOpen = repoData.pullRequestsOpen?.totalCount ?? 0
      const pullClosed = repoData.pullRequestsClosed?.totalCount ?? 0
      const issueOpen = repoData.issuesOpen?.totalCount ?? 0
      const issueClosed = repoData.issuesClosed?.totalCount ?? 0

      insights[repo.full_name] = {
        pullRequests: {
          total: pullOpen + pullClosed,
          open: pullOpen,
          closed: pullClosed,
        },
        issues: {
          total: issueOpen + issueClosed,
          open: issueOpen,
          closed: issueClosed,
        },
        commits30Days: null,
        available: true,
      }

      const pullItems = repoData.recentPullRequests?.nodes ?? []
      pullItems.forEach((item) => {
        activity.push({
          id: `pr-${item.id}`,
          type: 'pull',
          title: item.title,
          repo: repo.full_name,
          author: item.author?.login || 'Autor desconocido',
          date: item.updatedAt,
          html_url: item.url,
          state: item.state,
          number: item.number,
        })
      })

      const issueItems = repoData.recentIssues?.nodes ?? []
      issueItems.forEach((item) => {
        activity.push({
          id: `issue-${item.id}`,
          type: 'issue',
          title: item.title,
          repo: repo.full_name,
          author: item.author?.login || 'Autor desconocido',
          date: item.updatedAt,
          html_url: item.url,
          state: item.state,
          number: item.number,
        })
      })
    })
  }

  return { insights, activity, warnings }
}

async function fetchRecentCommits(
  repositories: Repo[],
  token: string,
): Promise<CommitFetchResult> {
  const since = new Date(
    Date.now() - COMMIT_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString()

  const results = await mapWithConcurrency(
    repositories,
    4,
    async (repo) => {
      const [owner, ...nameParts] = repo.full_name.split('/')
      const repositoryName = nameParts.join('/')

      if (!owner || !repositoryName) {
        throw new Error(`Nombre de repositorio no válido: ${repo.full_name}`)
      }

      const url =
        `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repositoryName)}` +
        `/commits?since=${encodeURIComponent(since)}&per_page=${COMMITS_PER_REPOSITORY}`

      const data = await githubRest<CommitResponse[]>(url, token)
      const commits = data.map((item) => ({
        sha: item.sha,
        message: item.commit.message.split('\n')[0] || 'Commit sin mensaje',
        html_url: item.html_url,
        repo: repo.full_name,
        author:
          item.author?.login ||
          item.commit.author?.name ||
          'Autor desconocido',
        date:
          item.commit.committer?.date ||
          item.commit.author?.date ||
          new Date().toISOString(),
      }))

      return { repo: repo.full_name, commits }
    },
  )

  const commits: Commit[] = []
  const countByRepo: Record<string, number | null> = {}
  const warnings: string[] = []

  results.forEach((result, index) => {
    const repo = repositories[index]

    if (result.status === 'fulfilled') {
      countByRepo[result.value.repo] = result.value.commits.length
      commits.push(...result.value.commits)
    } else {
      countByRepo[repo.full_name] = null
      const message =
        result.reason instanceof Error
          ? result.reason.message
          : 'Error desconocido al consultar commits.'
      warnings.push(`${repo.full_name}: ${message}`)
    }
  })

  commits.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  return { commits, countByRepo, warnings }
}

function formatDate(value: string, withTime = true): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Fecha no disponible'

  return new Intl.DateTimeFormat('es-CO',
    withTime
      ? { dateStyle: 'medium', timeStyle: 'short' }
      : { day: '2-digit', month: 'short' },
  ).format(date)
}

function dateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getStateLabel(state?: string): string {
  if (state === 'MERGED') return 'Fusionado'
  if (state === 'CLOSED') return 'Cerrado'
  if (state === 'OPEN') return 'Abierto'
  return 'Actualizado'
}

function getActivityLabel(type: ActivityItem['type']): string {
  if (type === 'pull') return 'Pull Request'
  if (type === 'issue') return 'Issue'
  return 'Commit'
}

export default function Metrics() {
  const { user, loading: authLoading } = useAuth()

  const [repos, setRepos] = useState<Repo[]>([])
  const [commits, setCommits] = useState<Commit[]>([])
  const [repoInsights, setRepoInsights] = useState<Record<string, RepoInsight>>({})
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingGithub, setLoadingGithub] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const requestId = useRef(0)

  async function refreshMetrics(initial = false) {
    if (!user?.id) {
      if (!authLoading) setLoading(false)
      return
    }

    const currentRequest = requestId.current + 1
    requestId.current = currentRequest

    if (initial) setLoading(true)
    else setRefreshing(true)

    setErrors([])

    try {
      const { data, error: databaseError } = await supabase
        .from('github_repositories')
        .select(
          'github_repo_id,name,full_name,html_url,description,private,language,stars,forks,updated_at,default_branch',
        )
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })

      if (currentRequest !== requestId.current) return

      if (databaseError) {
        throw new Error(`No se pudieron cargar los repositorios guardados: ${databaseError.message}`)
      }

      const repositoryList = (data || []) as Repo[]
      setRepos(repositoryList)

      if (repositoryList.length === 0) {
        setCommits([])
        setActivity([])
        setRepoInsights({})
        setLastUpdated(new Date())
        return
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) throw new Error(sessionError.message)

      const token = sessionData.session?.provider_token ?? ''
      if (!token) {
        setCommits([])
        setActivity([])
        setRepoInsights({})
        setErrors([
          'No hay un token de GitHub disponible. Ve a GitHub, desconecta la integración y vuelve a conectarla para autorizar la lectura de repositorios y actividad.',
        ])
        return
      }

      setLoadingGithub(true)

      const [commitResult, graphResult] = await Promise.allSettled([
        fetchRecentCommits(repositoryList, token),
        fetchGraphQLMetrics(repositoryList, token),
      ])

      if (currentRequest !== requestId.current) return

      const nextErrors: string[] = []
      let nextCommits: Commit[] = []
      let nextInsights: Record<string, RepoInsight> = {}
      let nextActivity: ActivityItem[] = []

      if (commitResult.status === 'fulfilled') {
        nextCommits = commitResult.value.commits
        nextErrors.push(...commitResult.value.warnings)
      } else {
        nextErrors.push(
          commitResult.reason instanceof Error
            ? commitResult.reason.message
            : 'No se pudieron consultar los commits.',
        )
      }

      if (graphResult.status === 'fulfilled') {
        nextInsights = graphResult.value.insights
        nextActivity = graphResult.value.activity
        nextErrors.push(...graphResult.value.warnings)
      } else {
        nextErrors.push(
          graphResult.reason instanceof Error
            ? graphResult.reason.message
            : 'No se pudieron consultar Pull Requests e Issues.',
        )
      }

      const insightsWithCommitCounts = { ...nextInsights }
      Object.entries(
        commitResult.status === 'fulfilled'
          ? commitResult.value.countByRepo
          : {},
      ).forEach(([fullName, count]) => {
        const previous = insightsWithCommitCounts[fullName] || {
          pullRequests: { total: 0, open: 0, closed: 0 },
          issues: { total: 0, open: 0, closed: 0 },
          commits30Days: null,
          available: false,
        }
        insightsWithCommitCounts[fullName] = {
          ...previous,
          commits30Days: count,
        }
      })

      setCommits(nextCommits)
      setRepoInsights(insightsWithCommitCounts)
      setActivity(nextActivity)
      setErrors([...new Set(nextErrors)])
      setLastUpdated(new Date())
    } catch (error) {
      if (currentRequest !== requestId.current) return
      setErrors([
        error instanceof Error ? error.message : 'No se pudieron actualizar las métricas.',
      ])
    } finally {
      if (currentRequest === requestId.current) {
        setLoading(false)
        setRefreshing(false)
        setLoadingGithub(false)
        setLastUpdated((current) => current || new Date())
      }
    }
  }

  useEffect(() => {
    if (authLoading) return
    if (!user?.id) {
      setLoading(false)
      return
    }

    void refreshMetrics(true)

    return () => {
      requestId.current += 1
    }
  }, [user?.id, authLoading])

  const publicRepos = repos.filter((repo) => !repo.private).length
  const privateRepos = repos.length - publicRepos
  const totalStars = repos.reduce((sum, repo) => sum + (repo.stars || 0), 0)
  const totalForks = repos.reduce((sum, repo) => sum + (repo.forks || 0), 0)

  const aggregate = useMemo(() => {
    const available = Object.values(repoInsights).filter((item) => item.available)
    return available.reduce(
      (totals, item) => ({
        pullRequests: {
          total: totals.pullRequests.total + item.pullRequests.total,
          open: totals.pullRequests.open + item.pullRequests.open,
          closed: totals.pullRequests.closed + item.pullRequests.closed,
        },
        issues: {
          total: totals.issues.total + item.issues.total,
          open: totals.issues.open + item.issues.open,
          closed: totals.issues.closed + item.issues.closed,
        },
      }),
      {
        pullRequests: { total: 0, open: 0, closed: 0 },
        issues: { total: 0, open: 0, closed: 0 },
      },
    )
  }, [repoInsights])

  const languageStats = useMemo(() => {
    const counts = new Map<string, number>()
    repos.forEach((repo) => {
      const language = repo.language || 'Sin lenguaje'
      counts.set(language, (counts.get(language) || 0) + 1)
    })
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [repos])

  const activityByDay = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const days = Array.from({ length: DAYS_FOR_CHART }, (_, index) => {
      const date = new Date(today)
      date.setDate(today.getDate() - (DAYS_FOR_CHART - 1 - index))
      return { date, key: dateKey(date), count: 0 }
    })

    const counts = new Map(days.map((day) => [day.key, 0]))
    commits.forEach((commit) => {
      const date = new Date(commit.date)
      if (Number.isNaN(date.getTime())) return
      const key = dateKey(date)
      if (counts.has(key)) counts.set(key, (counts.get(key) || 0) + 1)
    })

    return days.map((day) => ({ ...day, count: counts.get(day.key) || 0 }))
  }, [commits])

  const maxDailyCommits = Math.max(1, ...activityByDay.map((day) => day.count))

  const recentActivity = useMemo(() => {
    const commitActivity: ActivityItem[] = commits.slice(0, 12).map((commit) => ({
      id: `commit-${commit.sha}`,
      type: 'commit',
      title: commit.message,
      repo: commit.repo,
      author: commit.author,
      date: commit.date,
      html_url: commit.html_url,
    }))

    return [...commitActivity, ...activity]
      .filter((item) => !Number.isNaN(new Date(item.date).getTime()))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 15)
  }, [commits, activity])

  const repoRows = useMemo(() => {
    return [...repos].sort((a, b) => {
      const aActivity = repoInsights[a.full_name]
      const bActivity = repoInsights[b.full_name]
      const aScore = (aActivity?.pullRequests.open || 0) + (aActivity?.issues.open || 0)
      const bScore = (bActivity?.pullRequests.open || 0) + (bActivity?.issues.open || 0)
      return bScore - aScore || (b.stars || 0) - (a.stars || 0)
    })
  }, [repos, repoInsights])

  const activityRepos = repoRows.slice(0, 8)
  const maxOpenItems = Math.max(
    1,
    ...activityRepos.map((repo) => {
      const insight = repoInsights[repo.full_name]
      return (insight?.pullRequests.open || 0) + (insight?.issues.open || 0)
    }),
  )

  const availableRepos = Object.values(repoInsights).filter((item) => item.available).length
  const hasActivityAccess = availableRepos > 0

  if (loading) {
    return <Loader label="Cargando métricas..." />
  }

  if (!user) {
    return <div className="p-6 text-zinc-400">Inicia sesión para consultar tus métricas.</div>
  }

  return (
    <div className="min-h-full">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="mb-2 text-3xl font-bold text-white">Metrics</h1>
            <p className="text-zinc-400">
              Estadísticas, actividad y rendimiento de tus repositorios de GitHub.
            </p>
            {lastUpdated && (
              <p className="mt-2 text-xs text-zinc-600">
                Última actualización: {formatDate(lastUpdated.toISOString())}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => void refreshMetrics(false)}
            disabled={refreshing || loadingGithub}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-200 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw
              size={16}
              className={refreshing || loadingGithub ? 'animate-spin' : ''}
            />
            {refreshing || loadingGithub ? 'Actualizando...' : 'Actualizar'}
          </button>
        </header>

        {errors.length > 0 && (
          <div className="mb-6 rounded-xl border border-amber-900/60 bg-amber-950/20 p-4 text-sm text-amber-200">
            <div className="mb-2 font-medium">Algunas métricas necesitan atención</div>
            <ul className="list-disc space-y-1 pl-5 text-amber-100/80">
              {errors.slice(0, 5).map((message, index) => (
                <li key={`${index}-${message}`}>{message}</li>
              ))}
            </ul>
            {errors.length > 5 && (
              <p className="mt-2 text-xs text-amber-100/70">
                Y {errors.length - 5} aviso(s) adicional(es).
              </p>
            )}
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
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-7">
              <MetricCard label="Repositorios" value={repos.length} />
              <MetricCard label="Públicos" value={publicRepos} />
              <MetricCard label="Privados" value={privateRepos} />
              <MetricCard label="Stars" value={totalStars} />
              <MetricCard label="Forks" value={totalForks} />
              <MetricCard label="Pull Requests" value={hasActivityAccess ? aggregate.pullRequests.total : '—'} />
              <MetricCard label="Issues" value={hasActivityAccess ? aggregate.issues.total : '—'} />
            </section>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <StatusPanel
                title="Pull Requests"
                total={hasActivityAccess ? aggregate.pullRequests.total : null}
                open={hasActivityAccess ? aggregate.pullRequests.open : null}
                closed={hasActivityAccess ? aggregate.pullRequests.closed : null}
                helper="Cerrados incluye los fusionados."
              />
              <StatusPanel
                title="Issues"
                open={hasActivityAccess ? aggregate.issues.open : null}
                closed={hasActivityAccess ? aggregate.issues.closed : null}
                total={hasActivityAccess ? aggregate.issues.total : null}
                helper="Conteo de Issues; no incluye Pull Requests."
              />
            </div>

            {hasActivityAccess && availableRepos < repos.length && (
              <p className="mt-3 text-xs text-zinc-600">
                PR e Issues disponibles en {availableRepos} de {repos.length} repositorios. Los repositorios sin acceso no se suman como cero.
              </p>
            )}

            <div className="mt-6 grid gap-6 xl:grid-cols-2">
              <Section title="Commits · últimos 14 días" subtitle={`Basado en hasta ${COMMITS_PER_REPOSITORY} commits por repositorio durante los últimos ${COMMIT_WINDOW_DAYS} días.`}>
                <div className="flex h-52 items-end gap-1.5 sm:gap-2">
                  {activityByDay.map((day, dayIndex) => {
                    const height = day.count === 0
                      ? 3
                      : Math.max(8, (day.count / maxDailyCommits) * 100)

                    return (
                      <div key={day.key} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
                        <span className="text-[10px] tabular-nums text-zinc-500">
                          {day.count > 0 ? day.count : ''}
                        </span>
                        <div
                          className="w-full max-w-7 rounded-t-md bg-zinc-400/80 transition-all"
                          style={{ height: `${height}%` }}
                          title={`${formatDate(day.date.toISOString(), false)}: ${day.count} commits`}
                        />
                        <span className={`whitespace-nowrap text-[9px] text-zinc-600 sm:text-[10px] ${dayIndex % 3 === 1 ? '' : 'invisible'}`}>
                          {formatDate(day.date.toISOString(), false)}
                        </span>
                      </div>
                    )
                  })}
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-zinc-800 pt-3 text-xs text-zinc-500">
                  <span>Commits consultados</span>
                  <span className="font-medium tabular-nums text-zinc-300">{commits.length}</span>
                </div>
              </Section>

              <Section title="Lenguajes" subtitle="Distribución por lenguaje principal de cada repositorio.">
                {languageStats.length === 0 ? (
                  <p className="text-sm text-zinc-500">Todavía no hay datos de lenguajes.</p>
                ) : (
                  <div className="space-y-4">
                    {languageStats.map(([language, count]) => (
                      <div key={language}>
                        <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                          <span className="truncate text-zinc-300">{language}</span>
                          <span className="shrink-0 tabular-nums text-zinc-500">
                            {count} · {Math.round((count / repos.length) * 100)}%
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                          <div
                            className="h-full rounded-full bg-zinc-400"
                            style={{ width: `${(count / repos.length) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Section>
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-2">
              <Section title="Actividad reciente" subtitle="Últimos commits, Pull Requests e Issues detectados.">
                {recentActivity.length === 0 ? (
                  <p className="text-sm text-zinc-500">
                    {loadingGithub ? 'Cargando actividad de GitHub...' : 'No hay actividad reciente disponible.'}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {recentActivity.map((item) => (
                      <a
                        key={item.id}
                        href={item.html_url}
                        target="_blank"
                        rel="noreferrer"
                        className="block rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 transition hover:border-zinc-700 hover:bg-zinc-900"
                      >
                        <div className="flex items-start gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex flex-wrap items-center gap-2">
                              <span className="text-[10px] uppercase tracking-wide text-zinc-500">
                                {getActivityLabel(item.type)}
                              </span>
                              {item.state && (
                                <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-400">
                                  {getStateLabel(item.state)}
                                </span>
                              )}
                            </div>
                            <p className="break-words text-sm font-medium text-zinc-200">{item.title}</p>
                            <p className="mt-1 truncate text-xs text-zinc-500">
                              {item.repo} · {item.author}
                              {item.number ? ` · #${item.number}` : ''}
                            </p>
                            <p className="mt-1 text-[11px] text-zinc-600">{formatDate(item.date)}</p>
                          </div>
                        </div>
                      </a>
                    ))}
                  </div>
                )}
              </Section>

              <Section title="Repositorios con más trabajo abierto" subtitle="Suma de Pull Requests e Issues abiertos por repositorio.">
                {activityRepos.length === 0 ? (
                  <p className="text-sm text-zinc-500">No hay repositorios para mostrar.</p>
                ) : (
                  <div className="space-y-4">
                    {activityRepos.map((repo) => {
                      const insight = repoInsights[repo.full_name]
                      const openCount = (insight?.pullRequests.open || 0) + (insight?.issues.open || 0)
                      const width = (openCount / maxOpenItems) * 100

                      return (
                        <div key={repo.full_name}>
                          <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                            <a href={repo.html_url} target="_blank" rel="noreferrer" className="min-w-0 truncate text-zinc-300 hover:text-white">
                              {repo.full_name}
                            </a>
                            <span className="shrink-0 tabular-nums text-zinc-500">
                              {insight?.available ? openCount : '—'}
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                            <div className="h-full rounded-full bg-zinc-400" style={{ width: `${insight?.available ? width : 0}%` }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </Section>
            </div>

            <Section title="Rendimiento por repositorio" subtitle="Commits de los últimos 30 días y estado de Pull Requests e Issues." className="mt-6">
              <div className="grid gap-3 md:grid-cols-2">
                {repoRows.map((repo) => {
                  const insight = repoInsights[repo.full_name]
                  const commitCount = insight?.commits30Days
                  const hasGraphData = insight?.available === true

                  return (
                    <article key={repo.full_name} className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
                      <div className="mb-4 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <a href={repo.html_url} target="_blank" rel="noreferrer" className="block truncate font-semibold text-zinc-200 hover:text-white">
                            {repo.full_name}
                          </a>
                          <p className="mt-1 text-xs text-zinc-500">
                            {repo.private ? 'Privado' : 'Público'} · {repo.language || 'Sin lenguaje'}
                          </p>
                        </div>
                        <span className="shrink-0 text-xs text-zinc-500">{repo.updated_at ? formatDate(repo.updated_at, false) : 'Sin fecha'}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <MiniStat label="Stars" value={repo.stars ?? 0} />
                        <MiniStat label="Forks" value={repo.forks ?? 0} />
                        <MiniStat label="Commits · 30 d" value={commitCount} />
                        <MiniStat label="PR abiertos" value={hasGraphData ? insight.pullRequests.open : null} />
                      </div>

                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
                        <span>PR cerrados: {hasGraphData ? insight.pullRequests.closed : '—'}</span>
                        <span>Issues abiertas: {hasGraphData ? insight.issues.open : '—'}</span>
                        <span>Issues cerradas: {hasGraphData ? insight.issues.closed : '—'}</span>
                      </div>
                    </article>
                  )
                })}
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
}: {
  label: string
  value: number | string
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
      <div className="mb-3">
        <span className="text-sm text-zinc-500">{label}</span>
      </div>
      <p className="text-3xl font-bold tabular-nums text-white">
        {typeof value === 'number' ? value.toLocaleString('es-CO') : value}
      </p>
    </div>
  )
}

function StatusPanel({
  title,
  open,
  closed,
  total,
  helper,
}: {
  title: string
  open: number | null
  closed: number | null
  total: number | null
  helper: string
}) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <span className="text-sm tabular-nums text-zinc-500">{total === null ? '—' : total.toLocaleString('es-CO')} en total</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
          <p className="text-xs text-zinc-500">Abiertos</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-white">{open === null ? '—' : open.toLocaleString('es-CO')}</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
          <p className="text-xs text-zinc-500">Cerrados</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-white">{closed === null ? '—' : closed.toLocaleString('es-CO')}</p>
        </div>
      </div>
      <p className="mt-3 text-xs text-zinc-600">{helper}</p>
    </section>
  )
}

function Section({
  title,
  subtitle,
  children,
  className = '',
}: {
  title: string
  subtitle?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`rounded-2xl border border-zinc-800 bg-zinc-950 p-5 ${className}`}>
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        {subtitle && <p className="mt-1 text-xs text-zinc-500">{subtitle}</p>}
      </div>
      {children}
    </section>
  )
}

function MiniStat({
  label,
  value,
}: {
  label: string
  value: number | null | undefined
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
      <p className="text-[10px] text-zinc-600">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-200">
        {value === null || value === undefined ? '—' : value.toLocaleString('es-CO')}
      </p>
    </div>
  )
}

