import BrandMark from './BrandMark'

// Pantalla de carga única: marca + nombre + el texto del contexto
// ("Cargando proyectos...", "Cargando métricas...", etc.).
export default function Loader({
  label,
  fullscreen = false,
}: {
  label: string
  fullscreen?: boolean
}) {
  return (
    <div className={fullscreen ? 'loader loader-full' : 'loader'} role="status" aria-live="polite">
      <span className="loader-mark">
        <BrandMark size={34} />
      </span>
      <p className="loader-name">Developer OS</p>
      <p className="loader-label">{label}</p>
    </div>
  )
}
