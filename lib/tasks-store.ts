import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Task, TaskUpdate } from "@/lib/types";

const STORE_PATH = join(process.cwd(), "data", "tasks.json");
const DATA_DIR = dirname(STORE_PATH);

let queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const result = queue.then(operation, operation);
  queue = result.catch(() => undefined);
  return result;
}

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

async function ensureStore(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  try {
    await writeFile(STORE_PATH, "[]\n", { encoding: "utf8", flag: "wx" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
}

async function readAll(): Promise<Task[]> {
  await ensureStore();
  const content = await readFile(STORE_PATH, "utf8");
  if (!content.trim()) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return [];
  }
  return Array.isArray(parsed) ? parsed.filter(isTask) : [];
}

async function writeAll(tasks: Task[]): Promise<void> {
  const tempPath = `${STORE_PATH}.${randomUUID()}.tmp`;
  try {
    await writeFile(tempPath, `${JSON.stringify(tasks, null, 2)}\n`, "utf8");
    await rename(tempPath, STORE_PATH);
  } catch (error) {
    await unlink(tempPath).catch(() => undefined);
    throw error;
  }
}

export function listTasks(): Promise<Task[]> {
  return enqueue(() => readAll());
}

export function createTask(title: string): Promise<Task> {
  return enqueue(async () => {
    const tasks = await readAll();
    const task: Task = {
      id: randomUUID(),
      title,
      completed: false,
      createdAt: new Date().toISOString(),
    };
    tasks.push(task);
    await writeAll(tasks);
    return task;
  });
}

export function updateTask(id: string, changes: TaskUpdate): Promise<Task | null> {
  return enqueue(async () => {
    const tasks = await readAll();
    const index = tasks.findIndex((task) => task.id === id);
    if (index === -1) return null;

    const updated: Task = {
      ...tasks[index],
      ...(changes.title !== undefined ? { title: changes.title } : {}),
      ...(changes.completed !== undefined ? { completed: changes.completed } : {}),
    };
    tasks[index] = updated;
    await writeAll(tasks);
    return updated;
  });
}

export function deleteTask(id: string): Promise<boolean> {
  return enqueue(async () => {
    const tasks = await readAll();
    const remaining = tasks.filter((task) => task.id !== id);
    if (remaining.length === tasks.length) return false;

    await writeAll(remaining);
    return true;
  });
}
