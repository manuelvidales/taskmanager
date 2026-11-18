import { connection } from "next/server";
import { createTask, listTasks } from "@/lib/tasks-store";

export async function GET() {
  await connection();
  try {
    return Response.json(await listTasks());
  } catch {
    return Response.json({ error: "No se pudieron leer las tareas" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo JSON inválido" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return Response.json({ error: "El cuerpo debe ser un objeto" }, { status: 400 });
  }

  const rawTitle = (body as Record<string, unknown>).title;
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

  try {
    return Response.json(await createTask(title), { status: 201 });
  } catch {
    return Response.json({ error: "No se pudo crear la tarea" }, { status: 500 });
  }
}
