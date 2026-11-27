import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import BrandMark from './BrandMark'
import ThemeToggle from './ThemeToggle'
import SoundToggle from './SoundToggle'

const links = [
  { name: 'Inicio', path: '/', end: true },
  { name: 'Producto', path: '/producto' },
  { name: 'Cómo funciona', path: '/como-funciona' },
  { name: 'Meta', path: '/meta' },
]

// Estructura de las páginas públicas: barra superior y pie.
export default function SiteLayout() {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setOpen(false)
    window.scrollTo({ top: 0 })
  }, [pathname])

  return (
    <div className="site">
      <header className="site-bar">
        <div className="site-bar-in">
          <Link to="/" className="site-brand" aria-label="Developer OS, inicio">
            <BrandMark size={24} />
            <span>Developer OS</span>
          </Link>

          <nav id="site-menu" className={`site-nav${open ? ' is-open' : ''}`} aria-label="Principal">
            {links.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.end}
                className={({ isActive }) => `site-link${isActive ? ' is-active' : ''}`}
              >
                {item.name}
              </NavLink>
            ))}

            <div className="site-nav-cta">
              {user ? (
                <Link to="/dashboard" className="site-btn site-btn-solid">Abrir app</Link>
              ) : (
                <>
                  <Link to="/login" className="site-btn">Iniciar sesión</Link>
                  <Link to="/register" className="site-btn site-btn-solid">Crear cuenta</Link>
                </>
              )}
            </div>
          </nav>

          <div className="site-tools">
            <SoundToggle />
            <ThemeToggle />
            <button
              type="button"
              className="site-burger"
              aria-expanded={open}
              aria-controls="site-menu"
              aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
              onClick={() => setOpen((value) => !value)}
            >
              <span /><span />
            </button>
          </div>
        </div>
      </header>

      <main className="site-main">
        <Outlet />
      </main>

      <footer className="site-foot">
        <div className="site-foot-in">
          <div>
            <p className="site-foot-name">Developer OS</p>
            <p className="site-foot-text">Tu espacio de trabajo personal para proyectos, aprendizaje y productividad.</p>
          </div>
          <nav aria-label="Pie">
            {links.map((item) => (
              <Link key={item.path} to={item.path}>{item.name}</Link>
            ))}
            <Link to={user ? '/dashboard' : '/login'}>{user ? 'Abrir app' : 'Iniciar sesión'}</Link>
          </nav>
        </div>
        <p className="site-foot-legal">© {new Date().getFullYear()} Developer OS</p>
      </footer>
    </div>
  )
}
