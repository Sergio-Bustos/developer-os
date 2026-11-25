import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { principles } from './siteContent'

export default function Meta() {
  const { user } = useAuth()

  return (
    <>
      <section className="page-head">
        <div className="wrap">
          <p className="hero-kicker">Meta</p>
          <h1 className="page-title">Una herramienta para quien construye software</h1>
          <p className="page-lead">
            Developer OS nace de una idea sencilla: quien programa, estudia y lleva varios proyectos a la vez necesita
            un solo sitio donde ver todo, no una herramienta distinta para cada cosa.
          </p>
        </div>
      </section>

      <section className="band">
        <div className="wrap prose">
          <h2 className="site-h2">Qué buscamos</h2>
          <p>
            Que abrir la aplicación te diga, en pocos segundos, qué tienes en marcha, qué sigue y cómo vas. Los
            proyectos, las tareas, el estudio y la actividad de GitHub se relacionan entre sí, y verlos juntos ayuda a
            decidir mejor en qué invertir el tiempo.
          </p>
          <h2 className="site-h2">Para quién es</h2>
          <p>
            Para desarrolladores y estudiantes de programación que llevan proyectos propios, practican con regularidad
            y quieren medir su avance con datos reales, no con la memoria.
          </p>
        </div>
      </section>

      <section className="band band-alt">
        <div className="wrap">
          <h2 className="site-h2">Nuestros principios</h2>
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

      <section className="band">
        <div className="wrap cta-box">
          <div>
            <h2 className="site-h2">Pruébalo con tu propio trabajo</h2>
            <p className="cta-text">Empieza con un proyecto y deja que el resto se acomode.</p>
          </div>
          <Link to={user ? '/dashboard' : '/register'} className="site-btn site-btn-solid site-btn-lg">
            {user ? 'Abrir app' : 'Crear cuenta'}
          </Link>
        </div>
      </section>
    </>
  )
}
