import { useLayoutEffect, useRef } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  BarChart3,
  BookOpen,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Target,
  CheckSquare,
  FileText,
  GitBranch,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const navigation = [
  {
    name: 'Dashboard',
    path: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    name: 'Projects',
    path: '/projects',
    icon: FolderKanban,
  },
  {
    name: 'Tasks',
    path: '/tasks',
    icon: CheckSquare,
  },
  {
    name: 'Learning',
    path: '/learning',
    icon: BookOpen,
  },
  {
    name: 'Goals',
    path: '/goals',
    icon: Target,
  },
  {
    name: 'Documents',
    path: '/documents',
    icon: FileText,
  },
  {
    name: 'GitHub',
    path: '/github',
    icon: GitBranch,
  },
  {
    name: 'Metrics',
    path: '/metrics',
    icon: BarChart3,
  },
]

export default function AppLayout() {
  const { user, signOut } = useAuth()
  const { pathname } = useLocation()
  const navRef = useRef<HTMLElement>(null)
  const indicatorRef = useRef<HTMLSpanElement>(null)

  async function handleSignOut() {
    await signOut()
  }

  const displayName = String(user?.user_metadata?.display_name || 'Developer')
  const initial = displayName.trim().charAt(0).toUpperCase() || 'D'

  // El indicador de la sección activa se desliza entre opciones
  useLayoutEffect(() => {
    const nav = navRef.current
    const indicator = indicatorRef.current
    if (!nav || !indicator) return

    function place(animate: boolean) {
      const active = nav!.querySelector<HTMLElement>('a[aria-current="page"]')
      if (!active) {
        indicator!.style.opacity = '0'
        return
      }
      indicator!.style.opacity = '1'
      indicator!.style.setProperty('--ix', `${active.offsetLeft}px`)
      indicator!.style.setProperty('--iy', `${active.offsetTop}px`)
      indicator!.style.setProperty('--iw', `${active.offsetWidth}px`)
      indicator!.style.setProperty('--ih', `${active.offsetHeight}px`)
      if (!animate) {
        void indicator!.offsetWidth
        indicator!.dataset.ready = '1'
      }
      // En celular el menú se desplaza: mantén visible la sección activa
      if (nav!.scrollWidth > nav!.clientWidth) {
        nav!.scrollTo({
          left: active.offsetLeft - (nav!.clientWidth - active.offsetWidth) / 2,
          behavior: 'smooth',
        })
      }
    }

    place(indicator.dataset.ready === '1')

    const onResize = () => place(true)
    window.addEventListener('resize', onResize)
    document.fonts?.ready.then(() => place(true))

    return () => window.removeEventListener('resize', onResize)
  }, [pathname])

  return (
    <div className="shell">
      <aside className="rail">
        <div className="rail-brand">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 32 32" width="30" height="30">
              <circle
                cx="16"
                cy="16"
                r="12"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeDasharray="52 24"
                strokeLinecap="round"
                className="mark-ring"
              />
              <circle cx="16" cy="16" r="4.2" className="mark-core" />
            </svg>
          </span>

          <div className="min-w-0">
            <h1 className="brand-name">Developer OS</h1>

            <p className="brand-sub">Personal workspace</p>
          </div>

          <button
            onClick={handleSignOut}
            className="rail-out-compact"
            aria-label="Cerrar sesión"
          >
            <LogOut size={18} />
          </button>
        </div>

        <nav ref={navRef} className="rail-nav" aria-label="Principal">
          <span ref={indicatorRef} className="nav-ind" aria-hidden="true" />

          {navigation.map((item) => {
            const Icon = item.icon

            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `rail-link${isActive ? ' is-active' : ''}`
                }
              >
                <Icon size={18} />
                <span>{item.name}</span>
              </NavLink>
            )
          })}
        </nav>

        <div className="rail-user">
          <div className="user-card">
            <span className="avatar" aria-hidden="true">
              {initial}
            </span>

            <div className="min-w-0">
              <p className="user-name">{displayName}</p>

              <p className="user-mail">{user?.email}</p>
            </div>
          </div>

          <button onClick={handleSignOut} className="rail-out">
            <LogOut size={18} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="stage">
        <div className="stage-inner">
          <div key={pathname} className="page-enter">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  )
}
