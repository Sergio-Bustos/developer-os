import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight } from '../components/Icons'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

type Project = { id: string; name: string; status: string | null; created_at: string }
type Task = { id: string; title: string; status: string | null; priority: string | null; due_date: string | null; created_at: string }
type Goal = { id: string; title: string; status: string | null; current_value: number | null; target_value: number | null; created_at: string }
type Topic = { id: string; title: string; status: string | null; progress: number | null; created_at: string }
type StudySession = { id: string; duration_minutes: number | null; notes: string | null; session_date: string; started_at: string | null }
type DocumentItem = { id: string; title: string; category: string | null; created_at: string }
type GithubRepo = { full_name: string; stars: number | null; forks: number | null }
type GithubCommit = {
  sha: string
  html_url: string
  commit: { message: string; author: { name: string; date: string } | null; committer: { date: string } | null }
  author: { login: string } | null
}
type GraphNode = { id: string; number: number; title: string; state: string; url: string; updatedAt: string; author: { login: string } | null }
type GraphRepo = {
  openPullRequests: { totalCount: number }
  openIssues: { totalCount: number }
  recentPullRequests: { nodes: GraphNode[] | null }
  recentIssues: { nodes: GraphNode[] | null }
}
type GraphResponse = { data?: Record<string, GraphRepo | null> | null; errors?: Array<{ message: string }> }
type ActivityItem = {
  id: string
  title: string
  detail: string
  date: string
  href: string
  external?: boolean
}
type SourceName = 'projects' | 'tasks' | 'goals' | 'learning_topics' | 'study_sessions' | 'documents' | 'github_repositories'

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

function dateKey(value: string | null | undefined): string {
  if (!value) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Fecha no disponible'
  return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date)
}

function durationLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return hours ? `${hours} h ${rest} min` : `${rest} min`
}

function taskStatus(status: string | null): string {
  if (status === 'todo') return 'Pendiente'
  if (status === 'in_progress') return 'En progreso'
  if (status === 'completed') return 'Completada'
  if (status === 'cancelled') return 'Cancelada'
  return 'Sin estado'
}

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [topics, setTopics] = useState<Topic[]>([])
  const [sessions, setSessions] = useState<StudySession[]>([])
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [repositories, setRepositories] = useState<GithubRepo[]>([])
  const [githubEvents, setGithubEvents] = useState<ActivityItem[]>([])
  const [openPRs, setOpenPRs] = useState<number | null>(null)
  const [openIssues, setOpenIssues] = useState<number | null>(null)
  const [sourceErrors, setSourceErrors] = useState<SourceName[]>([])
  const [githubNotice, setGithubNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const loadDashboard = useCallback(async (initial = false) => {
    if (authLoading) return
    if (!user?.id) {
      setLoading(false)
      setRefreshing(false)
      return
    }

    if (initial) setLoading(true)
    else setRefreshing(true)
    setSourceErrors([])
    setGithubNotice('')

    const today = new Date()
    const todayKey = dateKey(today.toISOString())
    const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
    const mondayKey = dateKey(monday.toISOString())

    try {
      const [projectResult, taskResult, goalResult, topicResult, sessionResult, documentResult, repoResult] = await Promise.all([
        supabase.from('projects').select('id,name,status,created_at').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('tasks').select('id,title,status,priority,due_date,created_at').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('goals').select('id,title,status,current_value,target_value,created_at').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('learning_topics').select('id,title,status,progress,created_at').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('study_sessions').select('id,duration_minutes,notes,session_date,started_at').eq('user_id', user.id).gte('session_date', mondayKey).lte('session_date', todayKey).order('session_date', { ascending: false }),
        supabase.from('documents').select('id,title,category,created_at').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('github_repositories').select('full_name,stars,forks').eq('user_id', user.id).order('updated_at', { ascending: false }),
      ])

      const failed: SourceName[] = []
      if (projectResult.error) failed.push('projects')
      if (taskResult.error) failed.push('tasks')
      if (goalResult.error) failed.push('goals')
      if (topicResult.error) failed.push('learning_topics')
      if (sessionResult.error) failed.push('study_sessions')
      if (documentResult.error) failed.push('documents')
      if (repoResult.error) failed.push('github_repositories')
      setSourceErrors(failed)

      const nextProjects = (projectResult.data ?? []) as Project[]
      const nextTasks = (taskResult.data ?? []) as Task[]
      const nextGoals = (goalResult.data ?? []) as Goal[]
      const nextTopics = (topicResult.data ?? []) as Topic[]
      const nextSessions = (sessionResult.data ?? []) as StudySession[]
      const nextDocuments = (documentResult.data ?? []) as DocumentItem[]
      const nextRepos = (repoResult.data ?? []) as GithubRepo[]

      setProjects(nextProjects)
      setTasks(nextTasks)
      setGoals(nextGoals)
      setTopics(nextTopics)
      setSessions(nextSessions)
      setDocuments(nextDocuments)
      setRepositories(nextRepos)
      setLastUpdated(new Date())

      const nextEvents: ActivityItem[] = []
      if (repoResult.error) {
        setOpenPRs(null)
        setOpenIssues(null)
      } else if (nextRepos.length === 0) {
        setOpenPRs(0)
        setOpenIssues(0)
      } else {
        const { data: sessionData } = await supabase.auth.getSession()
        const token = sessionData.session?.provider_token

        if (!token) {
          setOpenPRs(null)
          setOpenIssues(null)
          setGithubNotice('Tus repositorios siguen guardados. Para mostrar la actividad de GitHub, vuelve a autorizar la integración desde GitHub.')
        } else {
          // Los commits se consultan solo en los cuatro repositorios actualizados más recientemente.
          const recentRepos = nextRepos.slice(0, 4)
          const commitResults = await Promise.allSettled(recentRepos.map(async (repo) => {
            const [owner, ...parts] = repo.full_name.split('/')
            const name = parts.join('/')
            if (!owner || !name) return []
            const response = await fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/commits?per_page=4`, {
              headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28' },
            })
            if (!response.ok) return []
            const rows = (await response.json()) as GithubCommit[]
            return rows.map((commit) => ({
              id: `commit-${commit.sha}`,
              title: commit.commit.message.split('\n')[0] || 'Commit sin mensaje',
              detail: `Commit · ${repo.full_name} · ${commit.author?.login || commit.commit.author?.name || 'Autor desconocido'}`,
              date: commit.commit.committer?.date || commit.commit.author?.date || new Date().toISOString(),
              href: commit.html_url,
              external: true,
            }))
          }))
          commitResults.forEach((result) => {
            if (result.status === 'fulfilled') nextEvents.push(...result.value)
          })

          // Los totales de PR e Issues cubren todos los repositorios; la actividad reciente usa los cuatro destacados.
          const graphRepos = nextRepos.flatMap((repo) => {
            const [owner, ...parts] = repo.full_name.split('/')
            const name = parts.join('/')
            return owner && name ? [{ owner, name, fullName: repo.full_name }] : []
          })
          const recentNames = new Set(recentRepos.map((repo) => repo.full_name))
          let prTotal = 0
          let issueTotal = 0
          let reposRead = 0
          const graphWarnings: string[] = []

          for (let offset = 0; offset < graphRepos.length; offset += 10) {
            const batch = graphRepos.slice(offset, offset + 10)
            const fields = batch.map((repo, index) => `
              repository${index}: repository(owner: ${JSON.stringify(repo.owner)}, name: ${JSON.stringify(repo.name)}) {
                openPullRequests: pullRequests(states: [OPEN]) { totalCount }
                openIssues: issues(states: [OPEN]) { totalCount }
                recentPullRequests: pullRequests(first: 3, orderBy: { field: UPDATED_AT, direction: DESC }) {
                  nodes { id number title state url updatedAt author { login } }
                }
                recentIssues: issues(first: 3, orderBy: { field: UPDATED_AT, direction: DESC }) {
                  nodes { id number title state url updatedAt author { login } }
                }
              }
            `).join('\n')

            try {
              const response = await fetch('https://api.github.com/graphql', {
                method: 'POST',
                headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28' },
                body: JSON.stringify({ query: `query DashboardActivity { ${fields} }` }),
              })
              const payload = (await response.json().catch(() => null)) as GraphResponse | null
              if (!response.ok || !payload?.data) {
                throw new Error(payload?.errors?.map((item) => item.message).join('; ') || `GitHub respondió con HTTP ${response.status}.`)
              }
              if (payload.errors?.length) graphWarnings.push(...payload.errors.map((item) => item.message))

              batch.forEach((repo, index) => {
                const data = payload.data?.[`repository${index}`]
                if (!data) {
                  graphWarnings.push(`No se pudieron consultar PR e Issues de ${repo.fullName}.`)
                  return
                }
                reposRead += 1
                prTotal += data.openPullRequests?.totalCount ?? 0
                issueTotal += data.openIssues?.totalCount ?? 0
                if (!recentNames.has(repo.fullName)) return

                ;(data.recentPullRequests?.nodes ?? []).forEach((item) => {
                  const state = item.state === 'MERGED' ? 'Fusionado' : item.state === 'CLOSED' ? 'Cerrado' : 'Abierto'
                  nextEvents.push({ id: `pr-${item.id}`, title: item.title, detail: `Pull Request #${item.number} · ${state} · ${repo.fullName} · ${item.author?.login || 'Autor desconocido'}`, date: item.updatedAt, href: item.url, external: true })
                })
                ;(data.recentIssues?.nodes ?? []).forEach((item) => {
                  const state = item.state === 'CLOSED' ? 'Cerrado' : 'Abierto'
                  nextEvents.push({ id: `issue-${item.id}`, title: item.title, detail: `Issue #${item.number} · ${state} · ${repo.fullName} · ${item.author?.login || 'Autor desconocido'}`, date: item.updatedAt, href: item.url, external: true })
                })
              })
            } catch (error) {
              graphWarnings.push(error instanceof Error ? error.message : 'Error consultando GitHub GraphQL.')
            }
          }

          const allReposWereRead = reposRead === graphRepos.length && graphWarnings.length === 0
          setOpenPRs(allReposWereRead ? prTotal : null)
          setOpenIssues(allReposWereRead ? issueTotal : null)
          if (graphWarnings.length) setGithubNotice([...new Set(graphWarnings)].slice(0, 3).join(' · '))
        }
      }

      setGithubEvents(nextEvents)
      setLastUpdated(new Date())
    } catch (error) {
      setGithubNotice(error instanceof Error ? `No se pudo completar la actualización: ${error.message}` : 'No se pudo actualizar el Dashboard.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [authLoading, user?.id])

  useEffect(() => { void loadDashboard(true) }, [loadDashboard])

  const activeProjects = projects.filter((project) => project.status === 'active').length
  const openTasks = tasks.filter((task) => task.status === 'todo' || task.status === 'in_progress').length
  const completedTasks = tasks.filter((task) => task.status === 'completed').length
  const overdueTasks = tasks.filter((task) => task.due_date && task.due_date < dateKey(new Date().toISOString()) && task.status !== 'completed' && task.status !== 'cancelled').length
  const activeGoals = goals.filter((goal) => goal.status === 'active').length
  const completedGoals = goals.filter((goal) => goal.status === 'completed').length
  const averageGoalProgress = goals.length
    ? Math.round(goals.reduce((sum, goal) => {
        const target = goal.target_value || 0
        const value = goal.current_value || 0
        return sum + (target > 0 ? Math.min((value / target) * 100, 100) : 0)
      }, 0) / goals.length)
    : 0
  const totalStars = repositories.reduce((sum, repo) => sum + (repo.stars || 0), 0)
  const totalForks = repositories.reduce((sum, repo) => sum + (repo.forks || 0), 0)
  const totalStudyMinutes = sessions.reduce((sum, session) => sum + (session.duration_minutes || 0), 0)

  const weekStart = useMemo(() => {
    const date = new Date()
    date.setHours(0, 0, 0, 0)
    date.setDate(date.getDate() - ((date.getDay() + 6) % 7))
    return date
  }, [lastUpdated])

  const weeklyActivity = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(weekStart)
      date.setDate(weekStart.getDate() + index)
      const key = dateKey(date.toISOString())
      return { key, label: WEEKDAYS[index], count: 0, isToday: key === dateKey(new Date().toISOString()) }
    })
    const lookup = new Map(days.map((day) => [day.key, day]))
    const increment = (date: string) => {
      const day = lookup.get(dateKey(date))
      if (day) day.count += 1
    }
    projects.forEach((item) => increment(item.created_at))
    tasks.forEach((item) => increment(item.created_at))
    goals.forEach((item) => increment(item.created_at))
    topics.forEach((item) => increment(item.created_at))
    documents.forEach((item) => increment(item.created_at))
    sessions.forEach((item) => increment(item.session_date))
    githubEvents.forEach((item) => increment(item.date))
    return days
  }, [documents, goals, githubEvents, projects, sessions, tasks, topics, weekStart])
  const maxWeekly = Math.max(1, ...weeklyActivity.map((day) => day.count))
  const weeklyTotal = weeklyActivity.reduce((sum, day) => sum + day.count, 0)

  const recentActivity = useMemo(() => {
    const items: ActivityItem[] = [
      ...projects.slice(0, 5).map((item) => ({ id: `project-${item.id}`, title: item.name, detail: 'Proyecto registrado', date: item.created_at, href: '/projects' })),
      ...tasks.slice(0, 7).map((item) => ({ id: `task-${item.id}`, title: item.title, detail: `Tarea · ${taskStatus(item.status)}`, date: item.created_at, href: '/tasks' })),
      ...goals.slice(0, 4).map((item) => ({ id: `goal-${item.id}`, title: item.title, detail: 'Objetivo registrado', date: item.created_at, href: '/goals' })),
      ...topics.slice(0, 4).map((item) => ({ id: `topic-${item.id}`, title: item.title, detail: 'Tema de aprendizaje', date: item.created_at, href: '/learning' })),
      ...sessions.slice(0, 6).map((item) => ({ id: `session-${item.id}`, title: item.notes?.trim().split('\n')[0] || 'Sesión de estudio', detail: `Aprendizaje · ${item.duration_minutes || 0} minutos`, date: item.started_at || `${item.session_date}T12:00:00`, href: '/learning' })),
      ...documents.slice(0, 5).map((item) => ({ id: `document-${item.id}`, title: item.title, detail: `Documento guardado${item.category ? ` · ${item.category}` : ''}`, date: item.created_at, href: '/documents' })),
      ...githubEvents,
    ]
    return items.filter((item) => item.date && !Number.isNaN(new Date(item.date).getTime())).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 8)
  }, [documents, githubEvents, goals, projects, sessions, tasks, topics])

  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 6 ? 'Buenas noches' : hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches'
  const firstName = String(user?.user_metadata?.display_name || '').trim().split(/\s+/)[0]
  const today = now.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
  const dayPercent = Math.round(((hour * 60 + now.getMinutes()) / 1440) * 100)
  const sourceFailed = (source: SourceName) => sourceErrors.includes(source)

  const moduleRows = [
    { title: 'Projects', description: sourceFailed('projects') ? 'Datos no disponibles' : `${activeProjects} activos · ${projects.length} en total`, path: '/projects', value: sourceFailed('projects') ? '—' : String(projects.length) },
    { title: 'Tasks', description: sourceFailed('tasks') ? 'Datos no disponibles' : `${completedTasks} completadas · ${overdueTasks} vencidas`, path: '/tasks', value: sourceFailed('tasks') ? '—' : String(openTasks) },
    { title: 'Learning', description: sourceFailed('study_sessions') ? 'Sesiones no disponibles' : `${sessions.length} sesiones esta semana · ${durationLabel(totalStudyMinutes)}`, path: '/learning', value: sourceFailed('learning_topics') ? '—' : String(topics.length) },
    { title: 'Goals', description: sourceFailed('goals') ? 'Datos no disponibles' : `${activeGoals} activos · ${completedGoals} completados`, path: '/goals', value: sourceFailed('goals') ? '—' : String(goals.length) },
    { title: 'Documents', description: sourceFailed('documents') ? 'Datos no disponibles' : 'Archivos guardados en tu workspace', path: '/documents', value: sourceFailed('documents') ? '—' : String(documents.length) },
    { title: 'GitHub', description: sourceFailed('github_repositories') ? 'Datos no disponibles' : `${totalStars} stars · ${totalForks} forks`, path: '/github', value: sourceFailed('github_repositories') ? '—' : String(repositories.length) },
    { title: 'Metrics', description: 'Commits, Pull Requests e Issues', path: '/metrics', value: 'Abrir' },
  ]

  if (authLoading || loading) return <div className="p-6 text-zinc-400">Cargando tu espacio de trabajo...</div>

  return (
    <div className="dash">
      <header className="dash-hero">
        <p className="dash-crumb">Dashboard · Overview · {today}</p>
        <h2 className="dash-title">{greeting}{firstName ? `, ${firstName}` : ''}.</h2>
        <p className="dash-lead">Tu centro de control para desarrollo, aprendizaje y productividad.</p>
        <div className="day" style={{ '--p': dayPercent / 100 } as CSSProperties}>
          <div className="day-track" aria-hidden="true"><i /></div>
          <p className="day-label"><strong>{dayPercent}%</strong> del día transcurrido</p>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
          {lastUpdated && <span>Datos actualizados {formatDate(lastUpdated.toISOString())}</span>}
          <button type="button" onClick={() => void loadDashboard(false)} disabled={refreshing} className="rounded-full border border-zinc-700 px-3 py-1.5 text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:opacity-50">
            {refreshing ? 'Actualizando...' : 'Actualizar datos'}
          </button>
        </div>
      </header>

      {sourceErrors.length > 0 && <div role="status" className="rounded-xl border border-amber-900/50 bg-amber-950/20 px-4 py-3 text-sm text-amber-200">No se pudieron cargar algunos datos ({sourceErrors.join(', ')}). Los valores afectados aparecen como “—”.</div>}
      {githubNotice && <div role="status" className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-400">{githubNotice}</div>}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6" aria-label="Resumen">
        <SummaryCard label="Tareas pendientes" value={sourceFailed('tasks') ? '—' : String(openTasks)} note={sourceFailed('tasks') ? 'Datos no disponibles' : `${completedTasks} completadas`} />
        <SummaryCard label="Proyectos activos" value={sourceFailed('projects') ? '—' : String(activeProjects)} note={sourceFailed('projects') ? 'Datos no disponibles' : `${projects.length} registrados`} />
        <SummaryCard label="Progreso de objetivos" value={sourceFailed('goals') ? '—' : `${averageGoalProgress}%`} note="Promedio de avance" />
        <SummaryCard label="Repositorios GitHub" value={sourceFailed('github_repositories') ? '—' : String(repositories.length)} note={sourceFailed('github_repositories') ? 'Datos no disponibles' : `${totalStars} stars · ${totalForks} forks`} />
        <SummaryCard label="Pull Requests abiertos" value={openPRs === null ? '—' : String(openPRs)} note="En repositorios sincronizados" />
        <SummaryCard label="Issues abiertas" value={openIssues === null ? '—' : String(openIssues)} note="En repositorios sincronizados" />
      </section>

      <section className="index" aria-label="Módulos">
        {moduleRows.map((module, index) => (
          <Link key={module.title} to={module.path} className="index-row" style={{ '--i': index } as CSSProperties}>
            <h3 className="index-name">{module.title}</h3>
            <p className="index-desc">{module.description}</p>
            <p className="index-value">{module.value}</p>
            <ArrowUpRight size={22} className="index-arrow" />
          </Link>
        ))}
      </section>

      <section className="dash-panels">
        <div className="panel panel-wide" style={{ '--i': 8 } as CSSProperties}>
          <p className="panel-kicker">Activity</p>
          <h3 className="panel-title">Actividad reciente</h3>
          {recentActivity.length === 0 ? (
            <div className="pulse-empty">
              <svg viewBox="0 0 400 60" preserveAspectRatio="none" aria-hidden="true"><path d="M0 30 H120 L140 30 L152 12 L168 50 L180 30 H400" pathLength="1" /></svg>
              <span>Todavía no hay actividad registrada</span>
            </div>
          ) : (
            <div className="mt-5 divide-y divide-zinc-800">
              {recentActivity.map((item) => {
                const content = <div className="flex min-w-0 items-start justify-between gap-4 py-3"><div className="min-w-0"><p className="truncate font-medium text-zinc-200">{item.title}</p><p className="mt-1 truncate text-xs text-zinc-500">{item.detail}</p></div><time className="shrink-0 text-right text-xs text-zinc-600">{formatDate(item.date)}</time></div>
                return item.external ? <a key={item.id} href={item.href} target="_blank" rel="noreferrer" className="block transition hover:bg-zinc-900/40">{content}</a> : <Link key={item.id} to={item.href} className="block transition hover:bg-zinc-900/40">{content}</Link>
              })}
            </div>
          )}
        </div>

        <div className="panel" style={{ '--i': 9 } as CSSProperties}>
          <p className="panel-kicker">Productivity</p>
          <h3 className="panel-title">Esta semana</h3>
          <div className="week-bars" aria-label="Actividad de lunes a domingo">
            {weeklyActivity.map((day) => <span key={day.key} className={day.isToday ? 'is-today' : ''} title={`${day.count} actividades`} style={{ height: '100%', gridTemplateRows: '1fr auto' }}><i style={{ height: `${Math.max(day.count ? 12 : 4, (day.count / maxWeekly) * 100)}%` }} />{day.label}</span>)}
          </div>
          <div className="week-total">
            <p className="week-num">{weeklyTotal}</p>
            <p className="week-label">registros de actividad</p>
            <p className="mt-3 text-sm text-zinc-500">{sourceFailed('study_sessions') ? 'Tiempo de estudio no disponible' : `${durationLabel(totalStudyMinutes)} de estudio registrados`}</p>
            {sourceErrors.length > 0 && <p className="mt-1 text-xs text-zinc-600">El gráfico muestra los registros que se pudieron cargar.</p>}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5"><div className="flex items-center justify-between gap-3"><div><p className="text-sm text-zinc-500">Tareas vencidas</p><p className="mt-1 text-2xl font-bold text-white">{sourceFailed('tasks') ? '—' : overdueTasks}</p></div><Link to="/tasks" className="text-sm text-zinc-400 underline decoration-zinc-700 underline-offset-4 hover:text-white">Ver tareas</Link></div></div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5"><div className="flex items-center justify-between gap-3"><div><p className="text-sm text-zinc-500">Objetivos completados</p><p className="mt-1 text-2xl font-bold text-white">{sourceFailed('goals') ? '—' : `${completedGoals} / ${goals.length}`}</p></div><Link to="/goals" className="text-sm text-zinc-400 underline decoration-zinc-700 underline-offset-4 hover:text-white">Ver objetivos</Link></div></div>
      </section>
    </div>
  )
}

function SummaryCard({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-5"><p className="text-sm text-zinc-500">{label}</p><p className="mt-1 text-3xl font-bold text-white">{value}</p><p className="mt-1 text-xs text-zinc-500">{note}</p></div>
}
