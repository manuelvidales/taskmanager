"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import type { Task } from "@/lib/types";

const MONTHS = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

function isTask(value: unknown): value is Task {
  if (typeof value !== "object" || value === null) return false;
  const task = value as Record<string, unknown>;
  return (
    typeof task.id === "string" &&
    typeof task.title === "string" &&
    typeof task.completed === "boolean" &&
    typeof task.createdAt === "string"
  );
}

function isErrorBody(value: unknown): value is { error: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof value.error === "string" &&
    value.error.trim().length > 0
  );
}

async function readErrorMessage(response: Response, fallback: string) {
  try {
    const body: unknown = await response.json();
    if (isErrorBody(body)) return body.error;
  } catch {
    // El cuerpo de la respuesta no era JSON; se usa el mensaje genérico.
  }
  return fallback;
}

function formatCreatedAt(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return "";
  const [, year, month, day] = match;
  const monthName = MONTHS[Number(month) - 1] ?? month;
  return `${Number(day)} ${monthName} ${year}`;
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-3.5 w-3.5"
    >
      <path d="m4 10 4 4 8-8" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
      className="h-4 w-4"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-4 w-4"
    >
      <path d="M4 7h16" />
      <path d="M9 7V4h6v3" />
      <path d="M6 7l1 13h10l1-13" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-4 w-4"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function Spinner({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={`animate-spin ${className}`}
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
        className="opacity-20"
      />
      <path
        fill="currentColor"
        d="M4 12a8 8 0 0 1 8-8V0C5.4 0 0 5.4 0 12h4Z"
        className="opacity-90"
      />
    </svg>
  );
}

export default function TaskManager() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [busyIds, setBusyIds] = useState<string[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  const loadTasks = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/tasks", {
        cache: "no-store",
        signal,
      });
      if (!response.ok) {
        throw new Error(
          await readErrorMessage(response, "No se pudieron cargar las tareas."),
        );
      }
      const body: unknown = await response.json();
      setTasks(Array.isArray(body) ? body.filter(isTask) : []);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setLoadError(
        error instanceof Error
          ? error.message
          : "No se pudieron cargar las tareas.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    // La petición se programa como callback asíncrono: el cuerpo del effect
    // solo sincroniza con una fuente externa (la API) y actualiza estado en
    // el callback, evitando renders en cascada.
    void Promise.resolve().then(() => loadTasks(controller.signal));
    return () => controller.abort();
  }, [loadTasks]);

  useEffect(() => {
    if (!editingId) return;
    editInputRef.current?.focus();
    editInputRef.current?.select();
  }, [editingId]);

  const completedCount = tasks.filter((task) => task.completed).length;
  const pendingCount = tasks.length - completedCount;
  const isBusy = busyIds.length > 0;

  const liveMessage = isLoading
    ? "Cargando tareas…"
    : isCreating
      ? "Creando tarea…"
      : isBusy
        ? "Actualizando tarea…"
        : `${tasks.length} ${tasks.length === 1 ? "tarea" : "tareas"}: ${pendingCount} pendientes y ${completedCount} completadas.`;

  function handleTitleChange(value: string) {
    setTitle(value);
    if (formError) setFormError(null);
  }

  function handleRetry() {
    setIsLoading(true);
    setLoadError(null);
    void loadTasks();
  }

  function handleStartEdit(task: Task) {
    if (busyIds.includes(task.id)) return;
    setActionError(null);
    setEditError(null);
    setEditingId(task.id);
    setEditValue(task.title);
  }

  function handleCancelEdit() {
    setEditingId(null);
    setEditValue("");
    setEditError(null);
  }

  function handleEditValueChange(value: string) {
    setEditValue(value);
    if (editError) setEditError(null);
  }

  function handleEditKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      handleCancelEdit();
    }
  }

  async function handleSaveEdit(event: FormEvent<HTMLFormElement>, task: Task) {
    event.preventDefault();
    const trimmedTitle = editValue.trim();

    if (!trimmedTitle) {
      setEditError("Escribe un título antes de guardar.");
      return;
    }

    if (trimmedTitle === task.title) {
      handleCancelEdit();
      return;
    }

    const previousTitle = task.title;
    setEditError(null);
    setActionError(null);
    setBusyIds((ids) => [...ids, task.id]);
    setTasks((current) =>
      current.map((item) =>
        item.id === task.id ? { ...item, title: trimmedTitle } : item,
      ),
    );

    try {
      const response = await fetch(
        `/api/tasks/${encodeURIComponent(task.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: trimmedTitle }),
        },
      );
      if (!response.ok) {
        throw new Error(
          await readErrorMessage(response, "No se pudo actualizar el título."),
        );
      }
      const body: unknown = await response.json();
      if (!isTask(body)) {
        throw new Error("No se pudo actualizar el título.");
      }
      setTasks((current) =>
        current.map((item) => (item.id === body.id ? body : item)),
      );
      handleCancelEdit();
    } catch (error) {
      setTasks((current) =>
        current.map((item) =>
          item.id === task.id ? { ...item, title: previousTitle } : item,
        ),
      );
      setEditValue(previousTitle);
      setActionError(
        error instanceof Error
          ? error.message
          : "No se pudo actualizar el título.",
      );
    } finally {
      setBusyIds((ids) => ids.filter((id) => id !== task.id));
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      setFormError("Escribe un título antes de añadir la tarea.");
      return;
    }

    setFormError(null);
    setActionError(null);
    setIsCreating(true);
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmedTitle }),
      });
      if (!response.ok) {
        throw new Error(
          await readErrorMessage(response, "No se pudo crear la tarea."),
        );
      }
      const body: unknown = await response.json();
      if (!isTask(body)) {
        throw new Error("No se pudo crear la tarea.");
      }
      setTasks((current) => [body, ...current]);
      setTitle("");
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "No se pudo crear la tarea.",
      );
    } finally {
      setIsCreating(false);
    }
  }

  async function handleToggle(task: Task) {
    if (busyIds.includes(task.id)) return;
    const nextCompleted = !task.completed;

    setActionError(null);
    setBusyIds((ids) => [...ids, task.id]);
    setTasks((current) =>
      current.map((item) =>
        item.id === task.id ? { ...item, completed: nextCompleted } : item,
      ),
    );

    try {
      const response = await fetch(
        `/api/tasks/${encodeURIComponent(task.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ completed: nextCompleted }),
        },
      );
      if (!response.ok) {
        throw new Error(
          await readErrorMessage(response, "No se pudo actualizar la tarea."),
        );
      }
      const body: unknown = await response.json();
      if (!isTask(body)) {
        throw new Error("No se pudo actualizar la tarea.");
      }
      setTasks((current) =>
        current.map((item) => (item.id === body.id ? body : item)),
      );
    } catch (error) {
      setTasks((current) =>
        current.map((item) =>
          item.id === task.id ? { ...item, completed: task.completed } : item,
        ),
      );
      setActionError(
        error instanceof Error
          ? error.message
          : "No se pudo actualizar la tarea.",
      );
    } finally {
      setBusyIds((ids) => ids.filter((id) => id !== task.id));
    }
  }

  async function handleDelete(task: Task) {
    if (busyIds.includes(task.id)) return;

    setActionError(null);
    setBusyIds((ids) => [...ids, task.id]);
    try {
      const response = await fetch(
        `/api/tasks/${encodeURIComponent(task.id)}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        throw new Error(
          await readErrorMessage(response, "No se pudo eliminar la tarea."),
        );
      }
      setTasks((current) => current.filter((item) => item.id !== task.id));
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "No se pudo eliminar la tarea.",
      );
    } finally {
      setBusyIds((ids) => ids.filter((id) => id !== task.id));
    }
  }

  return (
    <div className="relative w-full max-w-2xl">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-28 left-1/2 h-64 w-[32rem] max-w-full -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl"
      />

      <div className="relative flex flex-col gap-6">
        <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="h-3.5 w-3.5"
              >
                <path d="m5 12 4 4L19 6" />
              </svg>
              Task Manager
            </span>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
              Tus tareas
            </h1>
            <p className="mt-2 text-sm text-zinc-400">
              Organiza tu día, una tarea a la vez.
            </p>
          </div>

          <dl className="flex gap-3" aria-label="Resumen de tareas">
            <div className="min-w-24 flex-1 rounded-2xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 sm:flex-none">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                Pendientes
              </dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums text-amber-300">
                {pendingCount}
              </dd>
            </div>
            <div className="min-w-24 flex-1 rounded-2xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 sm:flex-none">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                Completadas
              </dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums text-emerald-300">
                {completedCount}
              </dd>
            </div>
          </dl>
        </header>

        <section
          aria-label="Gestor de tareas"
          className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60 shadow-2xl shadow-black/40"
        >
          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-3 border-b border-zinc-800 p-4 sm:flex-row sm:items-start sm:p-5"
          >
            <div className="flex-1">
              <label
                htmlFor="task-title"
                className="mb-2 block text-sm font-medium text-zinc-300"
              >
                Nueva tarea
              </label>
              <input
                id="task-title"
                name="title"
                type="text"
                value={title}
                onChange={(event) => handleTitleChange(event.target.value)}
                placeholder="¿Qué necesitas hacer?"
                maxLength={200}
                disabled={isCreating}
                aria-invalid={formError ? true : undefined}
                aria-describedby={formError ? "task-title-error" : "task-title-hint"}
                className={`w-full rounded-xl border bg-zinc-950/60 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 disabled:opacity-60 ${
                  formError
                    ? "border-red-500/70 focus:border-red-500 focus:ring-red-500/30"
                    : "border-zinc-700 focus:border-emerald-500 focus:ring-emerald-500/30"
                }`}
              />
              {formError ? (
                <p
                  id="task-title-error"
                  role="alert"
                  className="mt-2 text-sm text-red-400"
                >
                  {formError}
                </p>
              ) : (
                <p id="task-title-hint" className="mt-2 text-xs text-zinc-500">
                  Pulsa Enter o el botón para añadirla.
                </p>
              )}
            </div>
            <button
              type="submit"
              disabled={isCreating}
              className="inline-flex h-[46px] shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 disabled:cursor-not-allowed disabled:opacity-60 sm:mt-[30px]"
            >
              {isCreating ? <Spinner className="h-4 w-4" /> : <PlusIcon />}
              <span>{isCreating ? "Añadiendo…" : "Añadir"}</span>
            </button>
          </form>

          <p className="sr-only" aria-live="polite">
            {liveMessage}
          </p>

          {actionError && (
            <div
              role="alert"
              className="mx-4 mt-4 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300 sm:mx-5"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
                className="mt-0.5 h-4 w-4 shrink-0"
              >
                <path d="M12 9v4M12 17h.01" />
                <path d="M10.3 3.9 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
              </svg>
              <span className="flex-1">{actionError}</span>
              <button
                type="button"
                onClick={() => setActionError(null)}
                aria-label="Cerrar aviso de error"
                className="rounded-md px-1 text-red-300/70 transition-colors hover:text-red-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>
          )}

          <div className="p-2 sm:p-3">
            {isLoading ? (
              <div
                role="status"
                className="flex flex-col items-center gap-3 px-4 py-14 text-sm text-zinc-400"
              >
                <Spinner className="h-6 w-6 text-emerald-400" />
                <span>Cargando tareas…</span>
              </div>
            ) : loadError ? (
              <div
                role="alert"
                className="flex flex-col items-center gap-3 px-4 py-12 text-center"
              >
                <span className="text-2xl" aria-hidden="true">
                  ⚠
                </span>
                <p className="text-sm text-red-300">{loadError}</p>
                <button
                  type="button"
                  onClick={handleRetry}
                  className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 transition-colors hover:border-zinc-600 hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                >
                  Reintentar
                </button>
              </div>
            ) : tasks.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
                <span className="text-3xl" aria-hidden="true">
                  ✓
                </span>
                <p className="text-sm font-medium text-zinc-300">
                  No hay tareas todavía
                </p>
                <p className="text-xs text-zinc-500">
                  Añade la primera tarea para empezar.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-zinc-800/80">
                {tasks.map((task) => {
                  const disabled = busyIds.includes(task.id);
                  const dateLabel = formatCreatedAt(task.createdAt);
                  const isEditing = editingId === task.id;
                  const checkboxId = `task-checkbox-${task.id}`;
                  const editInputId = `task-edit-${task.id}`;
                  const editErrorId = `task-edit-error-${task.id}`;

                  return (
                    <li
                      key={task.id}
                      className="group flex flex-col gap-2 rounded-xl px-2 py-3 transition-colors hover:bg-zinc-800/40 sm:px-3"
                    >
                      <div className="flex items-start gap-2 sm:gap-3">
                        <label className="mt-0.5 flex shrink-0 cursor-pointer items-start">
                          <input
                            id={checkboxId}
                            type="checkbox"
                            checked={task.completed}
                            disabled={disabled}
                            onChange={() => handleToggle(task)}
                            aria-label={`Marcar "${task.title}" como ${task.completed ? "pendiente" : "completada"}`}
                            className="peer sr-only"
                          />
                          <span
                            aria-hidden="true"
                            className={`flex h-5 w-5 items-center justify-center rounded-md border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-400 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-zinc-900 peer-disabled:opacity-50 ${
                              task.completed
                                ? "border-emerald-400 bg-emerald-500 text-zinc-950"
                                : "border-zinc-600 bg-zinc-800 text-transparent group-hover:border-zinc-500"
                            }`}
                          >
                            <CheckIcon />
                          </span>
                        </label>

                        {isEditing ? (
                          <form
                            onSubmit={(event) => handleSaveEdit(event, task)}
                            onKeyDown={handleEditKeyDown}
                            className="flex min-w-0 flex-1 flex-col gap-2"
                          >
                            <input
                              id={editInputId}
                              ref={editInputRef}
                              type="text"
                              value={editValue}
                              onChange={(event) =>
                                handleEditValueChange(event.target.value)
                              }
                              maxLength={200}
                              disabled={disabled}
                              aria-label="Editar título de la tarea"
                              aria-invalid={editError ? true : undefined}
                              aria-describedby={
                                editError ? editErrorId : undefined
                              }
                              className={`w-full rounded-lg border bg-zinc-950/60 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 disabled:opacity-60 ${
                                editError
                                  ? "border-red-500/70 focus:border-red-500 focus:ring-red-500/30"
                                  : "border-zinc-700 focus:border-emerald-500 focus:ring-emerald-500/30"
                              }`}
                            />
                            {editError && (
                              <p
                                id={editErrorId}
                                role="alert"
                                className="text-xs text-red-400"
                              >
                                {editError}
                              </p>
                            )}
                            <div className="flex items-center gap-2">
                              <button
                                type="submit"
                                disabled={disabled}
                                className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-emerald-500 px-3 text-xs font-semibold text-zinc-950 transition-colors hover:bg-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {disabled ? <Spinner className="h-3.5 w-3.5" /> : null}
                                Guardar
                              </button>
                              <button
                                type="button"
                                onClick={handleCancelEdit}
                                disabled={disabled}
                                className="inline-flex h-8 items-center justify-center rounded-lg border border-zinc-700 px-3 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-600 hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                Cancelar
                              </button>
                            </div>
                          </form>
                        ) : (
                          <label
                            htmlFor={checkboxId}
                            className="min-w-0 flex-1 cursor-pointer"
                          >
                            <span
                              className={`block break-words text-sm leading-6 ${
                                task.completed
                                  ? "text-zinc-500 line-through decoration-zinc-600"
                                  : "text-zinc-100"
                              }`}
                            >
                              {task.title}
                            </span>
                            {dateLabel && (
                              <span className="mt-0.5 block text-xs text-zinc-600">
                                {dateLabel}
                              </span>
                            )}
                          </label>
                        )}

                        {!isEditing && (
                          <div className="mt-0.5 flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleStartEdit(task)}
                              disabled={disabled}
                              aria-label={`Editar título de la tarea "${task.title}"`}
                              className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-emerald-500/10 hover:text-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <PencilIcon />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(task)}
                              disabled={disabled}
                              aria-label={`Eliminar tarea "${task.title}"`}
                              className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-red-500/10 hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <TrashIcon />
                            </button>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <footer className="flex items-center justify-between gap-2 border-t border-zinc-800 px-5 py-3 text-xs text-zinc-500">
            <span>
              {tasks.length} {tasks.length === 1 ? "tarea" : "tareas"} en total
            </span>
            <span>
              {pendingCount} {pendingCount === 1 ? "pendiente" : "pendientes"}
            </span>
          </footer>
        </section>

        <p className="text-center text-xs text-zinc-600">
          Tus cambios se guardan automáticamente.
        </p>
      </div>
    </div>
  );
}
