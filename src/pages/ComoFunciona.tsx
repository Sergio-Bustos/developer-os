import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { steps } from './siteContent'

export default function ComoFunciona() {
  const { user } = useAuth()

  return (
    <>
      <section className="page-head">
        <div className="wrap">
          <p className="hero-kicker">Cómo funciona</p>
          <h1 className="page-title">De la cuenta al primer resumen, en cuatro pasos</h1>
          <p className="page-lead">No hay nada que instalar. Entras desde el navegador y empiezas a trabajar.</p>
        </div>
      </section>

      <section className="band">
        <div className="wrap">
          <ol className="steps">
            {steps.map((step, index) => (
              <li key={step.title} className="step">
                <span className="step-n">{index + 1}</span>
                <div>
                  <h2 className="step-title">{step.title}</h2>
                  <p className="step-text">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="band band-alt">
        <div className="wrap cta-box">
          <div>
            <h2 className="site-h2">Listo para el paso uno</h2>
            <p className="cta-text">Crea tu cuenta y organiza tu primer proyecto hoy.</p>
          </div>
          <Link to={user ? '/dashboard' : '/register'} className="site-btn site-btn-solid site-btn-lg">
            {user ? 'Abrir app' : 'Crear cuenta'}
          </Link>
        </div>
      </section>
    </>
  )
}
