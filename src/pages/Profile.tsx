import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function Profile() {
  const navigate = useNavigate()
  const { user, updatePassword, signOut } = useAuth()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const displayName = String(user?.user_metadata?.display_name || 'Developer')

  async function handlePasswordChange(event: FormEvent) {
    event.preventDefault()
    setPasswordError('')
    setPasswordMessage('')

    if (password.length < 6) {
      setPasswordError('La contraseña debe tener al menos 6 caracteres.')
      return
    }

    if (password !== confirmPassword) {
      setPasswordError('Las contraseñas no coinciden.')
      return
    }

    setPasswordLoading(true)
    const result = await updatePassword(password)
    setPasswordLoading(false)

    if (result.error) {
      setPasswordError(result.error.message)
      return
    }

    setPassword('')
    setConfirmPassword('')
    setPasswordMessage('Contraseña actualizada correctamente.')
  }

  async function handleDeleteAccount() {
    if (!user || deleteConfirm !== 'ELIMINAR') return

    setDeleteLoading(true)
    setDeleteError('')

    const { data: userDocuments, error: documentsReadError } = await supabase
      .from('documents')
      .select('file_path')
      .eq('user_id', user.id)

    if (documentsReadError) {
      setDeleteLoading(false)
      setDeleteError(`No se pudieron preparar tus documentos para eliminar: ${documentsReadError.message}`)
      return
    }

    const documentPaths = (userDocuments ?? [])
      .map((item) => item.file_path)
      .filter((path): path is string => Boolean(path))

    if (documentPaths.length > 0) {
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove(documentPaths)

      if (storageError) {
        setDeleteLoading(false)
        setDeleteError(`No se pudieron eliminar tus archivos: ${storageError.message}`)
        return
      }
    }

    // La eliminación de los registros de PostgreSQL se hace dentro de una
    // única función SECURITY DEFINER para evitar dejar la cuenta a medias
    // si una de las tablas falla. Los archivos de Storage se eliminan antes
    // porque Storage no participa en la transacción de PostgreSQL.
    const { error: accountError } = await supabase.rpc('delete_current_user')

    if (accountError) {
      setDeleteLoading(false)
      setDeleteError(
        `Tus datos fueron eliminados, pero no se pudo eliminar la cuenta de autenticación: ${accountError.message}`,
      )
      return
    }

    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="space-y-8 text-zinc-100">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Perfil</h1>
        <p className="mt-2 text-zinc-400">Administra tu cuenta y tus opciones de seguridad.</p>
      </div>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="text-xl font-semibold">Información de la cuenta</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Nombre</p>
            <p className="mt-1 text-zinc-100">{displayName}</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Correo</p>
            <p className="mt-1 break-all text-zinc-100">{user?.email}</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="text-xl font-semibold">Cambiar contraseña</h2>
        <p className="mt-1 text-sm text-zinc-500">Establece una nueva contraseña para tu cuenta.</p>

        <form onSubmit={handlePasswordChange} className="mt-5 max-w-xl space-y-4">
          <div>
            <label htmlFor="new-password" className="mb-2 block text-sm font-medium text-zinc-300">Nueva contraseña</label>
            <input
              id="new-password"
              type="password"
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none focus:border-emerald-500"
              required
            />
          </div>
          <div>
            <label htmlFor="confirm-password" className="mb-2 block text-sm font-medium text-zinc-300">Confirmar contraseña</label>
            <input
              id="confirm-password"
              type="password"
              minLength={6}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none focus:border-emerald-500"
              required
            />
          </div>

          {passwordError && <p className="text-sm text-red-300">{passwordError}</p>}
          {passwordMessage && <p className="text-sm text-emerald-300">{passwordMessage}</p>}

          <button
            type="submit"
            disabled={passwordLoading}
            className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black hover:bg-zinc-200 disabled:opacity-50"
          >
            {passwordLoading ? 'Actualizando...' : 'Cambiar contraseña'}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-red-900/60 bg-red-950/20 p-6">
        <h2 className="text-xl font-semibold text-red-200">Eliminar cuenta</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-red-200/70">
          Esta acción elimina tus datos de Developer OS y tu cuenta. No se puede deshacer.
        </p>

        <div className="mt-5 max-w-xl space-y-4">
          <div>
            <label htmlFor="delete-confirm" className="mb-2 block text-sm font-medium text-red-200">
              Escribe ELIMINAR para confirmar
            </label>
            <input
              id="delete-confirm"
              value={deleteConfirm}
              onChange={(event) => setDeleteConfirm(event.target.value)}
              className="w-full rounded-xl border border-red-900/70 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none focus:border-red-500"
            />
          </div>

          {deleteError && <p className="text-sm text-red-300">{deleteError}</p>}

          <button
            type="button"
            onClick={() => void handleDeleteAccount()}
            disabled={deleteLoading || deleteConfirm !== 'ELIMINAR'}
            className="rounded-xl border border-red-700 bg-red-950/50 px-5 py-3 text-sm font-semibold text-red-200 hover:bg-red-900/40 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {deleteLoading ? 'Eliminando cuenta...' : 'Eliminar cuenta'}
          </button>
        </div>
      </section>
    </div>
  )
}
