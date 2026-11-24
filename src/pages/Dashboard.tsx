import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight } from '../components/Icons'
import { useAuth } from '../context/AuthContext'

const modules = [
  {
    title: 'Projects',
    description: 'Gestiona tus proyectos de desarrollo.',
    path: '/projects',
    value: '0',
  },
  {
    title: 'Tasks',
    description: 'Organiza y controla tu trabajo.',
    path: '/tasks',
    value: '0',
  },
  {
    title: 'Learning',
    description: 'Registra y sigue tu aprendizaje.',
    path: '/learning',
    value: '0',
  },
  {
    title: 'Goals',
    description: 'Controla tus objetivos y progreso.',
    path: '/goals',
    value: '0',
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

  // Cuánto del día ya pasó (dato real, calculado con la hora local)
  const dayPercent = Math.round(((hour * 60 + now.getMinutes()) / 1440) * 100)

  return (
    <div className="dash">
      <header className="dash-hero">
        <p className="dash-crumb">Dashboard · Overview · {today}</p>

        <h2 className="dash-title">
          {greeting}
          {firstName ? `, ${firstName}` : ''}.
        </h2>

        <p className="dash-lead">
          Tu centro de control para desarrollo, aprendizaje y
          productividad.
        </p>

        <div className="day" style={{ '--p': dayPercent / 100 } as CSSProperties}>
          <div className="day-track" aria-hidden="true">
            <i />
          </div>

          <p className="day-label">
            <strong>{dayPercent}%</strong> del día transcurrido
          </p>
        </div>
      </header>

      <section className="index" aria-label="Módulos">
        {modules.map((module, index) => (
          <Link
            key={module.title}
            to={module.path}
            className="index-row"
            style={{ '--i': index } as CSSProperties}
          >
            <h3 className="index-name">{module.title}</h3>

            <p className="index-desc">{module.description}</p>

            <p className="index-value">{module.value}</p>

            <ArrowUpRight size={22} className="index-arrow" />
          </Link>
        ))}
      </section>

      <section className="dash-panels">
        <div className="panel panel-wide" style={{ '--i': 4 } as CSSProperties}>
          <p className="panel-kicker">Activity</p>

          <h3 className="panel-title">Recent activity</h3>

          <div className="pulse-empty">
            <svg viewBox="0 0 400 60" preserveAspectRatio="none" aria-hidden="true">
              <path d="M0 30 H120 L140 30 L152 12 L168 50 L180 30 H400" pathLength="1" />
            </svg>

            <span>No recent activity</span>
          </div>
        </div>

        <div className="panel" style={{ '--i': 5 } as CSSProperties}>
          <p className="panel-kicker">Productivity</p>

          <h3 className="panel-title">This week</h3>

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
