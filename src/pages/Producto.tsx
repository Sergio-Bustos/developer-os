import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { modules } from './siteContent'

export default function Producto() {
  const { user } = useAuth()

  return (
    <>
      <section className="page-head">
        <div className="wrap">
          <p className="hero-kicker">Producto</p>
          <h1 className="page-title">Qué puedes hacer con Developer OS</h1>
          <p className="page-lead">
            Cada módulo resuelve una parte de tu trabajo y todos comparten la misma cuenta. Esto es lo que incluye hoy.
          </p>
        </div>
      </section>

      <section className="band">
        <div className="wrap">
          <div className="module-list">
            {modules.map((item) => (
              <article key={item.name} className="module">
                <div>
                  <h2 className="module-name">{item.name}</h2>
                  <p className="module-summary">{item.summary}</p>
                </div>
                <ul className="module-points">
                  {item.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>

          <article className="module module-extra">
            <div>
              <h2 className="module-name">Cuenta y seguridad</h2>
              <p className="module-summary">Controlas tu acceso y tus datos desde la página de perfil.</p>
            </div>
            <ul className="module-points">
              <li>Recuperación de contraseña por correo</li>
              <li>Cambio de contraseña desde el perfil</li>
              <li>Eliminación de la cuenta y de tus datos</li>
              <li>Modo claro y modo oscuro</li>
            </ul>
          </article>
        </div>
      </section>

      <section className="band band-alt">
        <div className="wrap cta-box">
          <div>
            <h2 className="site-h2">¿Quieres verlo por dentro?</h2>
            <p className="cta-text">Crea una cuenta y recorre cada módulo con tus propios datos.</p>
          </div>
          <Link to={user ? '/dashboard' : '/register'} className="site-btn site-btn-solid site-btn-lg">
            {user ? 'Abrir app' : 'Crear cuenta'}
          </Link>
        </div>
      </section>
    </>
  )
}
