/** Entidad compartida entre la API (Route Handlers) y la interfaz. */
export interface Task {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
}

/** Cambios parciales permitidos al editar una tarea (PATCH). */
export interface TaskUpdate {
  title?: string;
  completed?: boolean;
}
