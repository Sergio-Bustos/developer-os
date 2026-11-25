// Texto de las páginas públicas. Todo lo que se describe aquí existe hoy en la app.
export interface ModuleInfo {
  name: string
  summary: string
  points: string[]
}

export const modules: ModuleInfo[] = [
  {
    name: 'Projects',
    summary: 'Un lugar para cada proyecto, con su estado, su prioridad y su repositorio.',
    points: [
      'Estados: activo, pausado, completado o archivado',
      'Prioridad baja, media o alta',
      'Enlace directo al repositorio de GitHub',
      'Edición y eliminación con confirmación',
    ],
  },
  {
    name: 'Tasks',
    summary: 'Las tareas de cada día, ligadas al proyecto al que pertenecen.',
    points: [
      'Cambia el estado desde la propia tarea: pendiente, en progreso, completada o cancelada',
      'Fecha límite y prioridad',
      'Asigna cada tarea a uno de tus proyectos',
      'Edita los datos cuando cambie el plan',
    ],
  },
  {
    name: 'Learning',
    summary: 'Registra lo que estudias y cuánto tiempo le dedicas.',
    points: [
      'Temas de aprendizaje con su progreso',
      'Sesiones de estudio por tema',
      'Actualiza el avance sin salir de la página',
    ],
  },
  {
    name: 'Goals',
    summary: 'Objetivos con una meta numérica, una fecha y un avance que se ve.',
    points: [
      'Meta total, categoría y fecha límite',
      'Registro de progreso con notas',
      'Barra de avance y porcentaje en cada objetivo',
    ],
  },
  {
    name: 'Documents',
    summary: 'Guarda archivos propios y vuelve a ellos cuando los necesites.',
    points: [
      'Subida de archivos con barra de progreso',
      'Categorías, búsqueda y filtros',
      'Apertura segura mediante enlaces temporales',
    ],
  },
  {
    name: 'GitHub y Metrics',
    summary: 'Conecta tu cuenta de GitHub y mira cómo trabajas de verdad.',
    points: [
      'Sincroniza tus repositorios con un clic',
      'Commits de los últimos 14 días',
      'Pull Requests e Issues abiertos y cerrados',
      'Distribución por lenguaje y rendimiento por repositorio',
    ],
  },
]

export const steps = [
  {
    title: 'Crea tu cuenta',
    text: 'Te registras con tu correo y entras a tu propio espacio. Si olvidas la contraseña, puedes recuperarla por correo.',
  },
  {
    title: 'Organiza tu trabajo',
    text: 'Crea tus proyectos, reparte las tareas y define objetivos. Todo queda en un solo lugar, listo en cualquier dispositivo.',
  },
  {
    title: 'Conecta GitHub',
    text: 'Autoriza tu cuenta y sincroniza tus repositorios. Developer OS lee tu actividad; no cambia nada en tu código.',
  },
  {
    title: 'Mira tu avance',
    text: 'El dashboard y las métricas resumen lo que hiciste esta semana y cómo evolucionan tus proyectos.',
  },
]

export const principles = [
  {
    title: 'Todo en un solo sitio',
    text: 'Proyectos, tareas, estudio, documentos y actividad de GitHub viven juntos, sin saltar entre herramientas.',
  },
  {
    title: 'Tus datos son tuyos',
    text: 'Cada registro pertenece a tu cuenta. Puedes cambiar tu contraseña o eliminar tu cuenta y tus datos cuando quieras.',
  },
  {
    title: 'Hecho para trabajar',
    text: 'Una interfaz sobria, rápida y con modo claro y oscuro, pensada para usarse todos los días y también desde el celular.',
  },
]
