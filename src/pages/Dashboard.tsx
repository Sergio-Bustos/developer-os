import type { CSSProperties, ReactNode } from 'react'
import {
  FolderKanban,
  CheckSquare,
  BookOpen,
  Target,
  ArrowUpRight,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// Cada módulo tiene su emblema dibujado a trazo: se "escribe" al entrar
// y vuelve a dibujarse al pasar el cursor.
const emblems: Record<string, ReactNode> = {
  Projects: (
    <>
      <rect x="22" y="58" width="76" height="34" rx="6" pathLength="1" />
      <rect x="16" y="40" width="76" height="34" rx="6" pathLength="1" />
      <rect x="10" y="22" width="76" height="34" rx="6" pathLength="1" />
    </>
  ),
  Tasks: (
    <>
      <rect x="14" y="14" width="92" height="92" rx="14" pathLength="1" />
      <path d="M36 62 L52 78 L86 42" pathLength="1" />
    </>
  ),
  Learning: (
    <>
      <path d="M60 30 C48 20 28 20 12 26 V92 C28 86 48 86 60 96 C72 86 92 86 108 92 V26 C92 20 72 20 60 30 Z" pathLength="1" />
      <path d="M60 30 V96" pathLength="1" />
    </>
  ),
  Goals: (
    <>
      <circle cx="60" cy="60" r="46" pathLength="1" />
      <circle cx="60" cy="60" r="29" pathLength="1" />
      <circle cx="60" cy="60" r="12" pathLength="1" />
      <path d="M60 4 V24 M60 96 V116 M4 60 H24 M96 60 H116" pathLength="1" />
    </>
  ),
}

const modules = [
  {
    title: 'Projects',
    description: 'Gestiona tus proyectos de desarrollo.',
    icon: FolderKanban,
    path: '/projects',
    value: '0',
    tone: 'gold',
  },
  {
    title: 'Tasks',
    description: 'Organiza y controla tu trabajo.',
    icon: CheckSquare,
    path: '/tasks',
    value: '0',
    tone: 'teal',
  },
  {
    title: 'Learning',
    description: 'Registra y sigue tu aprendizaje.',
    icon: BookOpen,
    path: '/learning',
    value: '0',
    tone: 'coral',
  },
  {
    title: 'Goals',
    description: 'Controla tus objetivos y progreso.',
    icon: Target,
    path: '/goals',
    value: '0',
    tone: 'bone',
  },
]

const weekDays = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

export default function Dashboard() {
  const { user } = useAuth()

  const now = new Date()
  const hour = now.getHours()
  const greeting =
    hour < 6
      ? 'Buenas noches'
      : hour < 12
        ? 'Buenos días'
        : hour < 19
          ? 'Buenas tardes'
          : 'Buenas noches'
  const firstName = String(user?.user_metadata?.display_name || '')
    .trim()
    .split(/\s+/)[0]
  const today = now.toLocaleDateString('es', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  const todayIndex = (now.getDay() + 6) % 7

  return (
    <div className="dash">
      <header className="dash-hero">
        <p className="dash-crumb">
          <span className="dash-dot" aria-hidden="true" />
          Dashboard · Overview · {today}
        </p>

        <h2 className="dash-title">
          {greeting}
          {firstName ? `, ${firstName}` : ''}.
        </h2>

        <p className="dash-lead">
          Tu centro de control para desarrollo, aprendizaje y
          productividad.
        </p>
      </header>

      <section className="dash-tiles">
        {modules.map((module, index) => {
          const Icon = module.icon

          return (
            <Link
              key={module.title}
              to={module.path}
              className={`tile tone-${module.tone}`}
              style={{ '--i': index } as CSSProperties}
            >
              <svg className="tile-emblem" viewBox="0 0 120 120" aria-hidden="true">
                {emblems[module.title]}
              </svg>

              <div className="tile-top">
                <span className="tile-icon">
                  <Icon size={18} />
                </span>

                <ArrowUpRight size={18} className="tile-arrow" />
              </div>

              <p className="tile-value">{module.value}</p>

              <h3 className="tile-title">{module.title}</h3>

              <p className="tile-desc">{module.description}</p>
            </Link>
          )
        })}
      </section>

      <section className="dash-panels">
        <div className="panel panel-wide" style={{ '--i': 4 } as CSSProperties}>
          <div className="panel-head">
            <p className="panel-kicker">Activity</p>

            <h3 className="panel-title">Recent activity</h3>
          </div>

          <div className="pulse-empty">
            <svg viewBox="0 0 400 60" preserveAspectRatio="none" aria-hidden="true">
              <path d="M0 30 H120 L140 30 L152 12 L168 50 L180 30 H400" pathLength="1" />
            </svg>

            <span>No recent activity</span>
          </div>
        </div>

        <div className="panel" style={{ '--i': 5 } as CSSProperties}>
          <div className="panel-head">
            <p className="panel-kicker">Productivity</p>

            <h3 className="panel-title">This week</h3>
          </div>

          <div className="week-bars" aria-hidden="true">
            {weekDays.map((day, i) => (
              <span key={i} className={i === todayIndex ? 'is-today' : ''}>
                <i />
                {day}
              </span>
            ))}
          </div>

          <div className="week-total">
            <p className="week-num">0</p>

            <p className="week-label">tracked activities</p>
          </div>
        </div>
      </section>
    </div>
  )
}
