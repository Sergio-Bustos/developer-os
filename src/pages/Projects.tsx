import { useEffect, useState, type FormEvent } from 'react'
import { Trash2, ExternalLink } from '../components/Icons'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

interface Project {
  id: string
  name: string
  description: string | null
  status: string | null
  priority: string | null
  repository_url: string | null
  start_date: string | null
  due_date: string | null
  created_at: string
}

export default function Projects() {
  const { user } = useAuth()

  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('medium')
  const [status, setStatus] = useState('active')
  const [repositoryUrl, setRepositoryUrl] = useState('')

  async function loadProjects() {
    if (!user) return

    setLoading(true)
    setError('')

    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      setError(error.message)
    } else {
      setProjects(data ?? [])
    }

    setLoading(false)
  }

  useEffect(() => {
    loadProjects()
  }, [user])

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!user) return

    if (!name.trim()) {
      setError('El proyecto necesita un nombre.')
      return
    }

    setCreating(true)
    setError('')

    const { error } = await supabase
      .from('projects')
      .insert({
        user_id: user.id,
        name: name.trim(),
        description: description.trim() || null,
        status,
        priority,
        repository_url: repositoryUrl.trim() || null,
      })

    if (error) {
      setError(error.message)
      setCreating(false)
      return
    }

    setName('')
    setDescription('')
    setPriority('medium')
    setStatus('active')
    setRepositoryUrl('')

    await loadProjects()

    setCreating(false)
  }

  async function handleDelete(id: string) {
    if (!user) return

    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      setError(error.message)
      return
    }

    setProjects((current) =>
      current.filter((project) => project.id !== id)
    )
  }

  return (
    <main className="space-y-6">
      <header>
        <div>
          <h1 className="text-3xl font-bold text-white">Projects</h1>
          <p className="mt-1 text-zinc-400">
            Gestiona tus proyectos de desarrollo.
          </p>
        </div>
      </header>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="mb-5 text-xl font-semibold text-white">Nuevo proyecto</h2>

        <form onSubmit={handleCreate} className="space-y-5">
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label
                htmlFor="name"
                className="mb-2 block text-sm font-medium text-zinc-200"
              >
                Nombre
              </label>
              <input
                id="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ej. Developer OS"
                required
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-white outline-none transition focus:border-zinc-500"
              />
            </div>

            <div>
              <label
                htmlFor="description"
                className="mb-2 block text-sm font-medium text-zinc-200"
              >
                Descripción
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Describe el proyecto"
                rows={1}
                className="w-full resize-none rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-white outline-none transition focus:border-zinc-500"
              />
            </div>

            <div>
              <label
                htmlFor="status"
                className="mb-2 block text-sm font-medium text-zinc-200"
              >
                Estado
              </label>
              <select
                id="status"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-white outline-none focus:border-zinc-500"
              >
                <option value="active">Activo</option>
                <option value="paused">Pausado</option>
                <option value="completed">Completado</option>
                <option value="archived">Archivado</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="priority"
                className="mb-2 block text-sm font-medium text-zinc-200"
              >
                Prioridad
              </label>
              <select
                id="priority"
                value={priority}
                onChange={(event) => setPriority(event.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-white outline-none focus:border-zinc-500"
              >
                <option value="low">Baja</option>
                <option value="medium">Media</option>
                <option value="high">Alta</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label
                htmlFor="repositoryUrl"
                className="mb-2 block text-sm font-medium text-zinc-200"
              >
                Repositorio GitHub
              </label>
              <input
                id="repositoryUrl"
                type="url"
                value={repositoryUrl}
                onChange={(event) => setRepositoryUrl(event.target.value)}
                placeholder="https://github.com/..."
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-white outline-none transition focus:border-zinc-500"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={creating}
            className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 font-medium text-zinc-900 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creating ? 'Creando...' : 'Crear proyecto'}
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold text-white">Mis proyectos</h2>

        {loading ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-zinc-400">
            Cargando proyectos...
          </div>
        ) : projects.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900 p-8 text-center text-zinc-500">
            Aún no tienes proyectos.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <article
                key={project.id}
                className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 transition hover:border-zinc-700"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-semibold text-white">
                      {project.name}
                    </h3>

                    {project.description && (
                      <p className="mt-2 line-clamp-3 text-sm text-zinc-400">
                        {project.description}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDelete(project.id)}
                    aria-label={`Eliminar ${project.name}`}
                    className="shrink-0 rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-800 hover:text-red-400"
                  >
                    <Trash2 size={17} />
                  </button>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300">
                    Estado: {project.status}
                  </span>

                  <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300">
                    Prioridad: {project.priority}
                  </span>
                </div>

                {project.repository_url && (
                  <a
                    href={project.repository_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-zinc-300 transition hover:text-white"
                  >
                    GitHub
                    <ExternalLink size={14} />
                  </a>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
