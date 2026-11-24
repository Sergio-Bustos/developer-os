import type { SVGProps } from 'react'

// Set de íconos propio: trazo fino de 1.5 px, esquinas rectas y formas
// geométricas. Solo existen los que la interfaz realmente necesita
// (acciones), el resto se resuelve con tipografía.
type IconProps = Omit<SVGProps<SVGSVGElement>, 'children'> & { size?: number }

function Glyph({ size = 18, d, ...props }: IconProps & { d: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="butt"
      strokeLinejoin="miter"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d={d} />
    </svg>
  )
}

export const Trash2 = (props: IconProps) => (
  <Glyph d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" {...props} />
)

export const ExternalLink = (props: IconProps) => (
  <Glyph d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6" {...props} />
)

export const RefreshCw = (props: IconProps) => (
  <Glyph
    d="M20 11a8 8 0 0 0-14-4L4 9M4 4v5h5M4 13a8 8 0 0 0 14 4l2-2M20 20v-5h-5"
    {...props}
  />
)

export const ArrowUpRight = (props: IconProps) => (
  <Glyph d="M6 18L18 6M8 6h10v10" {...props} />
)
