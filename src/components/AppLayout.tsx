import { useLayoutEffect, useRef } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import ThemeToggle from './ThemeToggle'
import SoundToggle from './SoundToggle'
import BrandMark from './BrandMark'

const navigation = [
  {
    name: 'Dashboard',
    path: '/dashboard',
  },
  {
    name: 'Projects',
    path: '/projects',
  },
  {
    name: 'Tasks',
    path: '/tasks',
  },
  {
    name: 'Learning',
    path: '/learning',
  },
  {
    name: 'Goals',
    path: '/goals',
  },
  {
    name: 'Documents',
    path: '/documents',
  },
  {
    name: 'GitHub',
    path: '/github',
  },
  {
    name: 'Metrics',
    path: '/metrics',
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
            <BrandMark size={26} />
          </span>

          <div className="min-w-0">
            <h1 className="brand-name">Developer OS</h1>

            <p className="brand-sub">Personal workspace</p>
          </div>

          <div className="rail-compact">
            <NavLink to="/profile" className="rail-avatar" aria-label="Perfil y cuenta">
              {displayName.trim().charAt(0).toUpperCase() || 'D'}
            </NavLink>
            <SoundToggle />
            <ThemeToggle />
            <button
              onClick={handleSignOut}
              className="rail-out-compact"
              aria-label="Cerrar sesión"
            >
              Salir
            </button>
          </div>
        </div>

        <nav ref={navRef} className="rail-nav" aria-label="Principal">
          <span ref={indicatorRef} className="nav-ind" aria-hidden="true" />

          {navigation.map((item) => {
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `rail-link${isActive ? ' is-active' : ''}`
                }
              >
                {item.name}
              </NavLink>
            )
          })}

          <NavLink
            to="/profile"
            className={({ isActive }) =>
              `rail-link rail-link-profile${isActive ? ' is-active' : ''}`
            }
          >
            Perfil
          </NavLink>
        </nav>

        <div className="rail-user">
          <NavLink
            to="/profile"
            className={({ isActive }) => `user-card${isActive ? ' is-active' : ''}`}
          >
            <p className="user-name">{displayName}</p>

            <p className="user-mail">{user?.email}</p>
            <span className="user-profile-link">Perfil y cuenta</span>
          </NavLink>

          <div className="rail-actions">
            <button onClick={handleSignOut} className="rail-out">
              Cerrar sesión
            </button>
            <SoundToggle />
            <ThemeToggle />
          </div>
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
