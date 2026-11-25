import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { modules, principles } from './siteContent'

export default function Landing() {
  const { user } = useAuth()

  return (
    <>
      <section className="hero">
        <div className="wrap hero-in">
          <div className="hero-copy">
            <p className="hero-kicker">Espacio de trabajo para desarrolladores</p>
            <h1 className="hero-title">Todo lo que construyes y aprendes, en un solo lugar.</h1>
            <p className="hero-lead">
              Developer OS reúne tus proyectos, tareas, objetivos, documentos y la actividad de GitHub en una
              aplicación ordenada y rápida. Sin hojas de cálculo sueltas ni diez pestañas abiertas.
            </p>
            <div className="hero-cta">
              {user ? (
                <Link to="/dashboard" className="site-btn site-btn-solid site-btn-lg">Abrir app</Link>
              ) : (
                <>
                  <Link to="/register" className="site-btn site-btn-solid site-btn-lg">Crear cuenta gratis</Link>
                  <Link to="/producto" className="site-btn site-btn-lg">Ver el producto</Link>
                </>
              )}
            </div>
          </div>

          <ol className="hero-index" aria-label="Módulos de la aplicación">
            {modules.map((item, index) => (
              <li key={item.name} style={{ '--i': index } as CSSProperties}>
                <span className="hero-index-name">{item.name}</span>
                <span className="hero-index-text">{item.summary}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="band">
        <div className="wrap">
          <h2 className="site-h2">Pensado para el trabajo de todos los días</h2>
          <div className="cols-3">
            {principles.map((item) => (
              <article key={item.title} className="site-card">
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="band band-alt">
        <div className="wrap">
          <div className="band-head">
            <h2 className="site-h2">Seis módulos, una sola cuenta</h2>
            <Link to="/producto" className="site-more">Ver todos los detalles</Link>
          </div>
          <div className="cols-3">
            {modules.map((item) => (
              <article key={item.name} className="site-card">
                <h3>{item.name}</h3>
                <p>{item.summary}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="band">
        <div className="wrap cta-box">
          <div>
            <h2 className="site-h2">Empieza a ordenar tu trabajo</h2>
            <p className="cta-text">Crear una cuenta toma un minuto. Funciona en el computador y en el celular.</p>
          </div>
          <Link to={user ? '/dashboard' : '/register'} className="site-btn site-btn-solid site-btn-lg">
            {user ? 'Abrir app' : 'Crear cuenta'}
          </Link>
        </div>
      </section>
    </>
  )
}
