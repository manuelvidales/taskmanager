import type { TaskUpdate } from "@/lib/types";
import { deleteTask, updateTask } from "@/lib/tasks-store";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo JSON inválido" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return Response.json({ error: "El cuerpo debe ser un objeto" }, { status: 400 });
  }

  const values = body as Record<string, unknown>;
  const hasTitle = Object.prototype.hasOwnProperty.call(values, "title");
  const hasCompleted = Object.prototype.hasOwnProperty.call(values, "completed");

  if (!hasTitle && !hasCompleted) {
    return Response.json(
      { error: "Se requiere al menos title o completed" },
      { status: 400 },
    );
  }

  const changes: TaskUpdate = {};

  if (hasTitle) {
    const rawTitle = values.title;
    if (typeof rawTitle !== "string" || rawTitle.trim().length === 0) {
      return Response.json({ error: "El título es obligatorio" }, { status: 400 });
    }
    const title = rawTitle.trim();
    if (title.length > 200) {
      return Response.json(
        { error: "El título no puede superar los 200 caracteres" },
        { status: 400 },
      );
    }
    changes.title = title;
  }

  if (hasCompleted) {
    const completed = values.completed;
    if (typeof completed !== "boolean") {
      return Response.json({ error: "completed debe ser un booleano" }, { status: 400 });
    }
    changes.completed = completed;
  }

  try {
    const task = await updateTask(id, changes);
    if (!task) {
      return Response.json({ error: "Tarea no encontrada" }, { status: 404 });
    }
    return Response.json(task);
  } catch {
    return Response.json({ error: "No se pudo actualizar la tarea" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { id } = await params;

  try {
    if (!(await deleteTask(id))) {
      return Response.json({ error: "Tarea no encontrada" }, { status: 404 });
    }
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "No se pudo eliminar la tarea" }, { status: 500 });
  }
}
