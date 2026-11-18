# Task Manager

Aplicación de gestión de tareas construida con **Next.js 16** (App Router), **React 19**, **Tailwind CSS v4** y **TypeScript**. Interfaz responsive en **modo oscuro**, con persistencia local en un archivo JSON y una API REST propia mediante Route Handlers.

## Funcionalidades

- **Crear** tareas con un título (máximo 200 caracteres, no vacío).
- **Listar** todas las tareas con fecha de creación y contadores de pendientes/completadas.
- **Completar / descompletar** tareas marcando un checkbox (actualización optimista con rollback si falla).
- **Editar el título** de una tarea desde la propia lista: botón *Editar*, input inline, Guardar/Cancelar, Enter/Escape y validación.
- **Eliminar** tareas con confirmación visual inmediata (optimista).
- Estados de carga, error (con reintento) y lista vacía, mensajes accesibles (`aria-live`, `role="alert"`) y diseño adaptable a móvil y escritorio.

## Stack técnico

| Tecnología | Versión | Uso |
|---|---|---|
| Next.js | 16.4.6 | App Router, Route Handlers, Cache Components |
| React | 19.3.0 | Interfaz (Client Components) |
| Tailwind CSS | 4.3.3 | Estilos (tema oscuro forzado) |
| TypeScript | 5.x | Tipado estricto en todo el proyecto |

No se añadieron dependencias externas más allá de las del proyecto inicial.

## Requisitos

- **Node.js 20.9 o superior** (necesario para Next.js 16 y `crypto.randomUUID()`).
- **npm** (incluido con Node.js).

## Ejecución desde cero

```bash
# 1. Instalar dependencias (solo la primera vez o tras clonar el repo)
npm install

# 2. Arrancar el servidor de desarrollo
npm run dev

# 3. Abrir en el navegador
# http://localhost:3000
```

La carpeta `data/` y el archivo `data/tasks.json` se crean automáticamente en el primer acceso si no existen, con contenido inicial `[]`. No hace falta configurar base de datos ni variables de entorno.

### Modo producción

```bash
npm run build   # compila y verifica tipos
npm run start   # sirve la build de producción (http://localhost:3000)
```

### Verificaciones disponibles

```bash
npx tsc --noEmit   # comprobación de tipos
npm run lint       # ESLint (configuración de next/eslint-config-next)
npm run build      # build de producción + typecheck
```

## API REST

Todas las respuestas son JSON. Los errores usan la forma `{ "error": "mensaje" }`.

| Método | Ruta | Body | Respuesta | Descripción |
|---|---|---|---|---|
| `GET` | `/api/tasks` | — | `Task[]` (200) | Lista todas las tareas |
| `POST` | `/api/tasks` | `{ "title": string }` | `Task` (201) | Crea una tarea |
| `PATCH` | `/api/tasks/:id` | `{ "title"?: string, "completed"?: boolean }` | `Task` (200) | Edita el título y/o el estado (al menos un campo) |
| `DELETE` | `/api/tasks/:id` | — | `{ "success": true }` (200) | Elimina una tarea |

Formato de `Task`:

```json
{
  "id": "uuid",
  "title": "Comprar leche",
  "completed": false,
  "createdAt": "2026-11-18T10:00:00.000Z"
}
```

Códigos de error: `400` validación inválida, `404` tarea no encontrada, `500` error de persistencia.

Ejemplos con `curl`:

```bash
# Listar
curl http://localhost:3000/api/tasks

# Crear
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"Comprar leche"}'

# Editar el título (sustituye <id> por el id devuelto)
curl -X PATCH http://localhost:3000/api/tasks/<id> \
  -H "Content-Type: application/json" \
  -d '{"title":"Comprar leche y pan"}'

# Marcar como completada
curl -X PATCH http://localhost:3000/api/tasks/<id> \
  -H "Content-Type: application/json" \
  -d '{"completed":true}'

# Eliminar
curl -X DELETE http://localhost:3000/api/tasks/<id>
```

## Estructura del proyecto

```text
app/
  api/tasks/
    route.ts              # GET (listar) y POST (crear)
    [id]/route.ts         # PATCH (editar/completar) y DELETE (eliminar)
  layout.tsx              # metadata, idioma es, fuentes y modo oscuro
  page.tsx                # página principal (server component delgado)
  globals.css             # Tailwind v4 + tema oscuro
components/
  TaskManager.tsx         # UI interactiva (client component)
lib/
  types.ts                # Task y TaskUpdate (contrato compartido)
  tasks-store.ts          # persistencia JSON con cola de escrituras y writes atómicos
data/
  tasks.json              # almacenamiento local (se crea automáticamente)
.opencode/agents/
  frontend.md             # especialista en UI (subagente)
  backend.md              # especialista en API REST (subagente)
  testing.md              # revisión de integración (subagente)
```

### Persistencia

`lib/tasks-store.ts` lee y escribe `data/tasks.json` usando `node:fs/promises` con rutas basadas en `process.cwd()`. Las operaciones pasan por una cola de promesas a nivel de proceso para evitar condiciones de carrera, y las escrituras usan un archivo temporal seguido de `rename` (atómico). Si el archivo está corrupto o vacío, se trata como una lista vacía en lugar de fallar. Es una persistencia sencilla pensada para una sola instancia; para producción con varios workers se recomendaría una base de datos.

### Nota sobre Cache Components

`next.config.ts` habilita `cacheComponents: true`. Por ese motivo los Route Handlers **no** exportan `runtime` ni `dynamic` (Next.js 16 lo prohíbe): el runtime Node.js es el predeterminado y `await connection()` en el `GET` declara explícitamente la ejecución por petición.
