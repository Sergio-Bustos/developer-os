import { useEffect, useState, type FormEvent } from 'react'
import { Plus, Target, Trash2, TrendingUp } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

interface Goal {
  id: string
  title: string
  description: string | null
  category: string
  status: string
  target_value: number
  current_value: number
  due_date: string | null
}

export default function Goals() {
  const { user } = useAuth()
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('Programación')
  const [targetValue, setTargetValue] = useState('100')
  const [dueDate, setDueDate] = useState('')

  const [selectedGoal, setSelectedGoal] = useState('')
  const [progressValue, setProgressValue] = useState('')
  const [progressNote, setProgressNote] = useState('')

  async function loadGoals() {
    if (!user) return
    setLoading(true)

    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) alert(error.message)

    setGoals(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    loadGoals()
  }, [user])

  async function createGoal(event: FormEvent) {
    event.preventDefault()
    if (!user || !title.trim()) return

    const { error } = await supabase.from('goals').insert({
      user_id: user.id,
      title: title.trim(),
      description: description.trim() || null,
      category,
      status: 'active',
      target_value: Number(targetValue) || 100,
      current_value: 0,
      due_date: dueDate || null,
    })

    if (error) {
      alert(error.message)
      return
    }

    setTitle('')
    setDescription('')
    setCategory('Programación')
    setTargetValue('100')
    setDueDate('')
    await loadGoals()
  }

  async function addProgress(event: FormEvent) {
    event.preventDefault()
    if (!user || !selectedGoal || !progressValue) return

    const goal = goals.find((item) => item.id === selectedGoal)
    if (!goal) return

    const value = Number(progressValue)
    const newCurrentValue = Math.min(
      goal.current_value + value,
      goal.target_value
    )

    const newStatus =
      newCurrentValue >= goal.target_value ? 'completed' : 'active'

    const { error: progressError } = await supabase
      .from('goal_progress')
      .insert({
        user_id: user.id,
        goal_id: selectedGoal,
        value,
        note: progressNote.trim() || null,
      })

    if (progressError) {
      alert(progressError.message)
      return
    }

    const { error: goalError } = await supabase
      .from('goals')
      .update({
        current_value: newCurrentValue,
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', selectedGoal)
      .eq('user_id', user.id)

    if (goalError) {
      alert(goalError.message)
      return
    }

    setSelectedGoal('')
    setProgressValue('')
    setProgressNote('')
    await loadGoals()
  }

  async function deleteGoal(id: string) {
    if (!confirm('¿Eliminar este objetivo?')) return

    const { error } = await supabase
      .from('goals')
      .delete()
      .eq('id', id)
      .eq('user_id', user?.id)

    if (error) {
      alert(error.message)
      return
    }

    await loadGoals()
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Goals</h1>
        <p className="mt-2 text-zinc-400">
          Define objetivos y registra tu progreso.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <Target className="mb-3 text-zinc-400" size={22} />
          <p className="text-sm text-zinc-500">Objetivos</p>
          <p className="mt-1 text-3xl font-bold text-white">{goals.length}</p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <TrendingUp className="mb-3 text-zinc-400" size={22} />
          <p className="text-sm text-zinc-500">Activos</p>
          <p className="mt-1 text-3xl font-bold text-white">
            {goals.filter((goal) => goal.status === 'active').length}
          </p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <Target className="mb-3 text-zinc-400" size={22} />
          <p className="text-sm text-zinc-500">Completados</p>
          <p className="mt-1 text-3xl font-bold text-white">
            {goals.filter((goal) => goal.status === 'completed').length}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <form
          onSubmit={createGoal}
          className="rounded-xl border border-zinc-800 bg-zinc-900 p-6"
        >
          <div className="mb-5 flex items-center gap-3">
            <Plus size={20} className="text-zinc-400" />
            <div>
              <h2 className="font-semibold text-white">Nuevo objetivo</h2>
              <p className="text-sm text-zinc-500">
                Define algo que quieras conseguir.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="goal-title" className="mb-2 block text-sm font-medium text-zinc-300">
                Título
              </label>
              <input
                id="goal-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Ej. Dominar React"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-zinc-500"
                required
              />
            </div>

            <div>
              <label htmlFor="goal-description" className="mb-2 block text-sm font-medium text-zinc-300">
                Descripción
              </label>
              <textarea
                id="goal-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Describe el objetivo..."
                rows={3}
                className="w-full resize-none rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-zinc-500"
              />
            </div>

            <div>
              <label htmlFor="goal-category" className="mb-2 block text-sm font-medium text-zinc-300">
                Categoría
              </label>
              <select
                id="goal-category"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none"
              >
                <option>Programación</option>
                <option>Universidad</option>
                <option>Estudio</option>
                <option>Personal</option>
                <option>Otros</option>
              </select>
            </div>

            <div>
              <label htmlFor="goal-target" className="mb-2 block text-sm font-medium text-zinc-300">
                Meta total
              </label>
              <input
                id="goal-target"
                type="number"
                min="1"
                value={targetValue}
                onChange={(event) => setTargetValue(event.target.value)}
                placeholder="Ej. 100"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-zinc-500"
                required
              />
            </div>

            <div>
              <label htmlFor="goal-due-date" className="mb-2 block text-sm font-medium text-zinc-300">
                Fecha límite
              </label>
              <input
                id="goal-due-date"
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none"
              />
            </div>

            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-white px-4 py-3 font-medium text-black transition hover:bg-zinc-200"
            >
              <Plus size={18} />
              Crear objetivo
            </button>
          </div>
        </form>

        <form
          onSubmit={addProgress}
          className="rounded-xl border border-zinc-800 bg-zinc-900 p-6"
        >
          <div className="mb-5 flex items-center gap-3">
            <TrendingUp size={20} className="text-zinc-400" />
            <div>
              <h2 className="font-semibold text-white">Registrar progreso</h2>
              <p className="text-sm text-zinc-500">
                Añade avance a un objetivo.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="progress-goal" className="mb-2 block text-sm font-medium text-zinc-300">
                Objetivo
              </label>
              <select
                id="progress-goal"
                value={selectedGoal}
                onChange={(event) => setSelectedGoal(event.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none"
                required
              >
                <option value="">Selecciona un objetivo</option>
                {goals
                  .filter((goal) => goal.status === 'active')
                  .map((goal) => (
                    <option key={goal.id} value={goal.id}>
                      {goal.title}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label htmlFor="progress-value" className="mb-2 block text-sm font-medium text-zinc-300">
                Cantidad de progreso
              </label>
              <input
                id="progress-value"
                type="number"
                min="1"
                value={progressValue}
                onChange={(event) => setProgressValue(event.target.value)}
                placeholder="Ej. 10"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-zinc-500"
                required
              />
            </div>

            <div>
              <label htmlFor="progress-note" className="mb-2 block text-sm font-medium text-zinc-300">
                Nota del progreso
              </label>
              <textarea
                id="progress-note"
                value={progressNote}
                onChange={(event) => setProgressNote(event.target.value)}
                placeholder="Nota sobre este avance..."
                rows={3}
                className="w-full resize-none rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-zinc-500"
              />
            </div>

            <button
              type="submit"
              disabled={goals.filter((goal) => goal.status === 'active').length === 0}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-800 px-4 py-3 font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <TrendingUp size={18} />
              Registrar progreso
            </button>
          </div>
        </form>
      </div>

      <section>
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-white">Mis objetivos</h2>
          <p className="text-sm text-zinc-500">
            Seguimiento de tus objetivos actuales.
          </p>
        </div>

        {loading ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-zinc-400">
            Cargando objetivos...
          </div>
        ) : goals.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/50 p-8 text-center">
            <Target size={28} className="mx-auto mb-3 text-zinc-600" />
            <p className="text-zinc-400">
              Todavía no tienes objetivos.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {goals.map((goal) => {
              const percentage =
                goal.target_value > 0
                  ? Math.min(
                      Math.max(
                        (goal.current_value / goal.target_value) * 100,
                        0
                      ),
                      100
                    )
                  : 0

              return (
                <div
                  key={goal.id}
                  className="rounded-xl border border-zinc-800 bg-zinc-900 p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="text-xs text-zinc-500">
                        {goal.category}
                      </span>

                      <h3 className="mt-1 text-lg font-semibold text-white">
                        {goal.title}
                      </h3>
                    </div>

                    <button
                      type="button"
                      onClick={() => deleteGoal(goal.id)}
                      className="text-zinc-600 transition hover:text-red-400"
                      title="Eliminar objetivo"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>

                  {goal.description && (
                    <p className="mt-3 text-sm text-zinc-400">
                      {goal.description}
                    </p>
                  )}

                  <div className="mt-5">
                    <div className="mb-2 flex justify-between text-xs">
                      <span className="text-zinc-500">Progreso</span>
                      <span className="text-zinc-400">
                        {goal.current_value} / {goal.target_value}
                      </span>
                    </div>

                    <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className="h-full rounded-full bg-white"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>

                    <p className="mt-2 text-xs text-zinc-500">
                      {Math.round(percentage)}%
                    </p>
                  </div>

                  {goal.due_date && (
                    <p className="mt-4 text-xs text-zinc-500">
                      Fecha límite: {goal.due_date}
                    </p>
                  )}

                  {goal.status === 'completed' && (
                    <span className="mt-4 inline-block rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-300">
                      Completado
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
