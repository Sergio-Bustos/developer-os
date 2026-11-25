// Marca de Developer OS: tres rayas (dos de la tinta del tema y una azul).
export default function BrandMark({ size = 26 }: { size?: number }) {
  return (
    <svg viewBox="0 0 28 28" width={size} height={size} className="mark-bars" aria-hidden="true" focusable="false">
      <rect x="2" y="4" width="24" height="4" />
      <rect x="2" y="12" width="17" height="4" />
      <rect x="2" y="20" width="10" height="4" />
    </svg>
  )
}
