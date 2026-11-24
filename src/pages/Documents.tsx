import { useEffect, useState, type FormEvent } from 'react'
import { ExternalLink, Trash2 } from '../components/Icons'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

interface DocumentItem {
  id: string
  user_id: string
  title: string
  description: string | null
  category: string | null
  file_path: string | null
  file_type: string | null
  file_size: number | null
  created_at: string
}

const BUCKET = 'documents'
const TUS_CHUNK_SIZE = 6 * 1024 * 1024

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  tsx: 'text/plain',
  ts: 'text/plain',
  txt: 'text/plain',
  md: 'text/markdown',
  json: 'application/json',
  csv: 'text/csv',
  html: 'text/html',
  htm: 'text/html',
  css: 'text/css',
  js: 'text/javascript',
  jsx: 'text/javascript',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
}

function getExtension(fileName: string) {
  const lastDot = fileName.lastIndexOf('.')
  return lastDot >= 0 ? fileName.slice(lastDot + 1).toLowerCase() : ''
}

function getContentType(file: File) {
  const extension = getExtension(file.name)
  // La extensión conocida tiene prioridad: Android puede entregar un MIME
  // genérico para PDF aunque el archivo sí tenga extensión .pdf.
  return MIME_BY_EXTENSION[extension] || file.type?.trim() || 'application/octet-stream'
}

function encodeTusMetadata(value: string) {
  // Los valores enviados aquí son rutas generadas por la aplicación y MIME types,
  // por lo que son texto ASCII válido para btoa.
  return window.btoa(value)
}

function buildTusMetadata(values: Record<string, string>) {
  return Object.entries(values)
    .map(([key, value]) => `${key} ${encodeTusMetadata(value)}`)
    .join(',')
}

async function responseError(response: Response) {
  const body = await response.text().catch(() => '')
  let detail = body

  if (body) {
    try {
      const parsed = JSON.parse(body) as {
        message?: string
        error?: string
        error_description?: string
      }
      detail = parsed.message || parsed.error_description || parsed.error || body
    } catch {
      // El servidor también puede devolver texto plano.
    }
  }

  return detail
    ? `Supabase respondió ${response.status}: ${detail}`
    : `Supabase respondió ${response.status} ${response.statusText}`
}

function wait(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds))
}

async function getTusOffset(
  uploadUrl: string,
  authHeaders: Record<string, string>,
) {
  const response = await fetch(uploadUrl, {
    method: 'HEAD',
    headers: {
      ...authHeaders,
      'Tus-Resumable': '1.0.0',
    },
  })

  if (!response.ok) {
    throw new Error(await responseError(response))
  }

  const offsetHeader = response.headers.get('Upload-Offset')
  const offset = offsetHeader === null ? Number.NaN : Number(offsetHeader)

  if (!Number.isFinite(offset) || offset < 0) {
    throw new Error('Supabase no devolvió la posición actual de la subida.')
  }

  return offset
}

/**
* Sube el archivo usando TUS, el protocolo reanudable de Supabase Storage.
* Esto evita depender de una única petición para PDFs y otros archivos grandes.
*/
async function uploadWithSupabase(
  file: File,
  filePath: string,
  contentType: string,
) {
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType,
    })

  if (uploadError) {
    throw uploadError
  }
}

async function uploadWithTus(
  file: File,
  filePath: string,
  contentType: string,
  onProgress: (percentage: number) => void,
) {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  const session = sessionData.session

  if (sessionError) {
    throw new Error(`No se pudo validar la sesión: ${sessionError.message}`)
  }

  if (!session?.access_token) {
    throw new Error('La sesión expiró. Cierra sesión e inicia nuevamente.')
  }

  const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || '').trim()
  const supabasePublishableKey = String(
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '',
  ).trim()

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      'Faltan las variables VITE_SUPABASE_URL o VITE_SUPABASE_PUBLISHABLE_KEY.',
    )
  }

  const parsedProjectUrl = new URL(supabaseUrl)
  const projectRef = parsedProjectUrl.hostname.split('.')[0]
  const isHostedSupabase = parsedProjectUrl.hostname.endsWith('.supabase.co')
  const storageOrigin = isHostedSupabase
    ? `${parsedProjectUrl.protocol}//${projectRef}.storage.supabase.co`
    : parsedProjectUrl.origin
  const endpoint = `${storageOrigin}/storage/v1/upload/resumable`
  const authHeaders = {
    authorization: `Bearer ${session.access_token}`,
    apikey: supabasePublishableKey,
  }

  const metadata = buildTusMetadata({
    bucketName: BUCKET,
    objectName: filePath,
    contentType,
    cacheControl: '3600',
  })

  const createResponse = await fetch(endpoint, {
    method: 'POST',
    headers: {
      ...authHeaders,
      'Tus-Resumable': '1.0.0',
      'Upload-Length': String(file.size),
      'Upload-Metadata': metadata,
      'x-upsert': 'false',
    },
  })

  if (!createResponse.ok) {
    throw new Error(await responseError(createResponse))
  }

  const location = createResponse.headers.get('Location')
  if (!location) {
    throw new Error(
      'Supabase creó la sesión de subida, pero el navegador no recibió la dirección para enviar el archivo. Revisa la configuración CORS del proyecto.',
    )
  }

  const uploadUrl = new URL(location, endpoint).toString()
  let offset = 0
  onProgress(0)

  while (offset < file.size) {
    const chunk = file.slice(offset, Math.min(offset + TUS_CHUNK_SIZE, file.size))
    let completedChunk = false
    let attempts = 0

    while (!completedChunk && attempts < 5) {
      let patchResponse: Response

      try {
        patchResponse = await fetch(uploadUrl, {
          method: 'PATCH',
          headers: {
            ...authHeaders,
            'Tus-Resumable': '1.0.0',
            'Upload-Offset': String(offset),
            'Content-Type': 'application/offset+octet-stream',
          },
          body: chunk,
        })
      } catch {
        attempts += 1
        if (attempts >= 5) {
          throw new Error('Se perdió la conexión durante la subida. Inténtalo nuevamente con una conexión estable.')
        }
        await wait(Math.min(1000 * 2 ** (attempts - 1), 8000))
        continue
      }

      if (patchResponse.ok) {
        const returnedOffset = patchResponse.headers.get('Upload-Offset')
        const nextOffset = returnedOffset === null
          ? await getTusOffset(uploadUrl, authHeaders)
          : Number(returnedOffset)

        if (!Number.isFinite(nextOffset) || nextOffset <= offset) {
          throw new Error('La subida no avanzó. Supabase no confirmó los datos recibidos.')
        }

        offset = nextOffset
        completedChunk = true
        onProgress(Math.min(100, Math.round((offset / file.size) * 100)))
        continue
      }

      // Un conflicto puede ocurrir si el servidor recibió un bloque, pero
      // la conexión se cortó antes de que el navegador recibiera la respuesta.
      if (patchResponse.status === 409 || patchResponse.status === 408 || patchResponse.status === 429 || patchResponse.status >= 500) {
        try {
          const serverOffset = await getTusOffset(uploadUrl, authHeaders)
          if (serverOffset > offset) {
            offset = serverOffset
            completedChunk = true
            onProgress(Math.min(100, Math.round((offset / file.size) * 100)))
            continue
          }
        } catch {
          // Se reintenta el mismo bloque; el siguiente intento validará el offset.
        }

        attempts += 1
        if (attempts >= 5) {
          throw new Error(await responseError(patchResponse))
        }
        await wait(Math.min(1000 * 2 ** (attempts - 1), 8000))
        continue
      }

      throw new Error(await responseError(patchResponse))
    }
  }

  onProgress(100)
}

export default function Documents() {
  const { user } = useAuth()
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('general')
  const [file, setFile] = useState<File | null>(null)

  async function loadDocuments() {
    if (!user) {
      setDocuments([])
      setLoading(false)
      return
    }

    setLoading(true)
    const { data, error: queryError } = await supabase
      .from('documents')
      .select('id, user_id, title, description, category, file_path, file_type, file_size, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (queryError) {
      setError(`No se pudieron cargar los documentos: ${queryError.message}`)
      setDocuments([])
    } else {
      setDocuments((data ?? []) as DocumentItem[])
    }

    setLoading(false)
  }

  useEffect(() => {
    void loadDocuments()
    // La consulta debe volver a ejecutarse cuando cambie la cuenta activa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  function formatFileSize(size: number | null) {
    if (size === null || size === undefined) return 'Tamaño desconocido'
    if (size < 1024) return `${size} B`
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
    return `${(size / (1024 * 1024)).toFixed(1)} MB`
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!user) {
      setError('No hay una sesión activa. Inicia sesión nuevamente.')
      return
    }

    if (!title.trim()) {
      setError('Escribe un título para el documento.')
      return
    }

    if (!file) {
      setError('Selecciona el archivo que deseas subir.')
      return
    }

    if (file.size === 0) {
      setError('El archivo está vacío. Selecciona otro archivo.')
      return
    }

    setUploading(true)
    setUploadProgress(0)
    setError('')
    setSuccess('')

    const extension = getExtension(file.name)
    const fileName = `${crypto.randomUUID()}${extension ? `.${extension}` : ''}`
    const filePath = `${user.id}/${fileName}`
    const contentType = getContentType(file)

    try {
      if (file.size <= TUS_CHUNK_SIZE) {
        try {
          setUploadProgress(10)
          await uploadWithSupabase(file, filePath, contentType)
          setUploadProgress(100)
        } catch {
          await uploadWithTus(file, filePath, contentType, setUploadProgress)
        }
      } else {
        await uploadWithTus(file, filePath, contentType, setUploadProgress)
      }

      // Guardamos el registro y pedimos inmediatamente la fila creada.
      // Así no dependemos de que el estado local "parezca" actualizado:
      // el documento que mostramos después es el que realmente quedó
      // persistido en public.documents.
      const { data: insertedDocument, error: insertError } = await supabase
        .from('documents')
        .insert({
          user_id: user.id,
          title: title.trim(),
          description: description.trim() || null,
          category,
          file_path: filePath,
          file_type: contentType,
          file_size: file.size,
        })
        .select('id, user_id, title, description, category, file_path, file_type, file_size, created_at')
        .single()

      if (insertError || !insertedDocument) {
        const { error: cleanupError } = await supabase.storage
          .from(BUCKET)
          .remove([filePath])

        const cleanupMessage = cleanupError
          ? ` También hubo un problema limpiando el archivo: ${cleanupError.message}`
          : ''

        throw new Error(
          `El archivo llegó a Storage, pero no se pudo confirmar el registro en la tabla documents: ${insertError?.message || 'Supabase no devolvió la fila creada.'
          }.${cleanupMessage}`,
        )
      }

      // Insert confirmado: usamos la fila devuelta por PostgreSQL
      // y después sincronizamos nuevamente con la tabla.
      setDocuments((current) => [
        insertedDocument as DocumentItem,
        ...current.filter((item) => item.id !== insertedDocument.id),
      ])

      setTitle('')
      setDescription('')
      setCategory('general')
      setFile(null)

      const input = document.getElementById('document-file') as HTMLInputElement | null
      if (input) input.value = ''

      // Verificación final: volvemos a leer public.documents.
      // Si falla aquí, el usuario verá el error real en lugar de creer
      // que el documento quedó guardado solo en el estado de React.
      await loadDocuments()
      setSuccess('Documento subido correctamente y guardado en Supabase.')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message || 'No se pudo subir el documento.')
    } finally {
      setUploading(false)
    }
  }

  async function handleOpen(item: DocumentItem) {
    if (!item.file_path) {
      setError('Este documento no tiene un archivo asociado.')
      return
    }

    setError('')
    const newWindow = window.open('about:blank', '_blank')

    if (!newWindow) {
      setError('El navegador bloqueó la ventana. Permite las ventanas emergentes e inténtalo nuevamente.')
      return
    }

    const { data, error: urlError } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(item.file_path, 3600)

    if (urlError) {
      newWindow.close()
      setError(`No se pudo abrir el archivo: ${urlError.message}`)
      return
    }

    newWindow.opener = null
    newWindow.location.href = data.signedUrl
  }

  async function handleDelete(item: DocumentItem) {
    const confirmed = window.confirm(`¿Eliminar "${item.title}"?`)
    if (!confirmed || !user) return

    setError('')
    setSuccess('')

    if (item.file_path) {
      const { error: storageError } = await supabase.storage
        .from(BUCKET)
        .remove([item.file_path])

      if (storageError) {
        setError(`No se pudo eliminar el archivo: ${storageError.message}`)
        return
      }
    }

    const { error: deleteError } = await supabase
      .from('documents')
      .delete()
      .eq('id', item.id)
      .eq('user_id', user.id)

    if (deleteError) {
      setError(`No se pudo eliminar el registro: ${deleteError.message}`)
      return
    }

    setDocuments((current) => current.filter((doc) => doc.id !== item.id))
    setSuccess('Documento eliminado correctamente.')
  }

  return (
    <main className="text-zinc-100">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Documentos</h1>
              <p className="mt-1 text-sm text-zinc-400">
                Guarda y administra tus documentos en Developer OS.
              </p>
            </div>
          </div>
        </header>

        {error && (
          <div role="alert" className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {success && (
          <div role="status" className="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            {success}
          </div>
        )}

        <section className="mb-8 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 shadow-xl">
          <div className="mb-5 flex items-center gap-2">
            <h2 className="text-lg font-semibold">Subir documento</h2>
          </div>

          <form onSubmit={handleUpload} className="space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label htmlFor="document-title" className="mb-2 block text-sm font-medium text-zinc-300">
                  Título
                </label>
                <input
                  id="document-title"
                  type="text"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Ej. Informe mensual"
                  maxLength={150}
                  disabled={uploading}
                  required
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-emerald-500 disabled:opacity-60"
                />
              </div>

              <div>
                <label htmlFor="document-category" className="mb-2 block text-sm font-medium text-zinc-300">
                  Categoría
                </label>
                <select
                  id="document-category"
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  disabled={uploading}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-emerald-500 disabled:opacity-60"
                >
                  <option value="general">General</option>
                  <option value="academic">Académico</option>
                  <option value="work">Trabajo</option>
                  <option value="project">Proyecto</option>
                  <option value="personal">Personal</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="document-description" className="mb-2 block text-sm font-medium text-zinc-300">
                Descripción
              </label>
              <textarea
                id="document-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Descripción opcional"
                rows={3}
                maxLength={1000}
                disabled={uploading}
                className="w-full resize-none rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-emerald-500 disabled:opacity-60"
              />
            </div>

            <div>
              <label htmlFor="document-file" className="mb-2 block text-sm font-medium text-zinc-300">
                Archivo
              </label>
              <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-950 p-4">
                <input
                  id="document-file"
                  type="file"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                  disabled={uploading}
                  className="block w-full text-sm text-zinc-400 file:mr-4 file:rounded-lg file:border-0 file:bg-emerald-500/10 file:px-4 file:py-2 file:text-sm file:font-medium file:text-emerald-400 hover:file:bg-emerald-500/20 disabled:opacity-60"
                />
                {file && (
                  <p className="mt-3 break-all text-xs text-zinc-500">
                    {file.name} · {formatFileSize(file.size)}
                  </p>
                )}
              </div>
            </div>

            {uploading && (
              <div aria-live="polite">
                <div className="mb-2 flex items-center justify-between text-xs text-zinc-400">
                  <span>Subiendo archivo por bloques...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-200"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={uploading || !file || !title.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {uploading ? `Subiendo ${uploadProgress}%...` : 'Subir documento'}
            </button>
          </form>
        </section>

        <section>
          <div className="mb-4">
            <h2 className="text-xl font-semibold">Mis documentos</h2>
            <p className="text-sm text-zinc-500">
              {documents.length} documento{documents.length === 1 ? '' : 's'}
            </p>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 text-sm text-zinc-400">
              Cargando documentos...
            </div>
          ) : documents.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/40 p-10 text-center">
              <p className="text-zinc-400">Todavía no tienes documentos.</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {documents.map((item) => (
                <article
                  key={item.id}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 transition hover:border-zinc-700"
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="min-w-0">
                        <h3 className="break-words font-semibold text-zinc-100">{item.title}</h3>
                        <p className="mt-1 text-xs text-zinc-500">{item.category || 'General'}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => void handleDelete(item)}
                      className="shrink-0 rounded-lg p-2 text-zinc-500 transition hover:bg-red-500/10 hover:text-red-400"
                      title="Eliminar documento"
                      aria-label={`Eliminar ${item.title}`}
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>

                  {item.description && (
                    <p className="mb-4 line-clamp-3 text-sm text-zinc-400">{item.description}</p>
                  )}

                  <div className="mb-4 break-all text-xs text-zinc-500">
                    {item.file_type || 'Archivo'} · {formatFileSize(item.file_size)}
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleOpen(item)}
                    className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-200 transition hover:border-emerald-500/50 hover:text-emerald-400"
                  >
                    <ExternalLink size={15} />
                    Abrir archivo
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
