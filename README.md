# Asesor Pedagógico Inteligente

Plataforma web para autoevaluar y fortalecer las competencias de los laboratorios de las cohortes 1 y 2 del curso de Inteligencia Artificial (Universidad de Manizales · Profundización I).

La IA valora cada criterio de la rúbrica citando evidencias del trabajo del estudiante. Esas citas se verifican automáticamente, el código se revisa en un sandbox aislado y la nota (0,0 – 5,0) la calcula el backend con las ponderaciones de la rúbrica. El docente revisa, ajusta y aprueba cada valoración antes de publicarla.

## Arquitectura

```
Navegador ──► Next.js (apps/web) ──/api/*──► NestJS (apps/api) ──► PostgreSQL (Neon)
                 páginas + proxy               │
                                               ├─ Motor de evaluación (cola en segundo plano)
                                               │    ├─ Extracción de evidencias: PDF, ZIP, GitHub, DOCX, PPTX, notebooks, imágenes
                                               │    ├─ Sandbox: sintaxis, análisis estático (ast), pytest / node:test sin red
                                               │    ├─ LLM con salida estructurada (Zod → JSON Schema) + reintentos
                                               │    ├─ Verificación de citas contra el material
                                               │    └─ Cálculo determinista de la nota
                                               └─ Adaptadores de IA: Claude · OpenAI · Gemini · Ollama · demo
```

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS 4, React Flow (mapa mental), Recharts |
| Backend | NestJS 11, Drizzle ORM, Zod 4, pdfkit (informe PDF), unpdf (lectura de PDF) |
| Base de datos | PostgreSQL en Neon. Los archivos se guardan en la base (bytea) con hash SHA-256 |
| IA | Anthropic, OpenAI (o compatibles), Google Gemini, Ollama local y modo demo heurístico |
| Sandbox | Directorio temporal, `unshare -n` (sin red), `setpriv` (usuario nobody), `prlimit` (memoria, CPU, procesos, archivos), timeout y entorno sin secretos |

## Cumplimiento del enunciado

| Requisito | Dónde está |
|---|---|
| 1. Entrada: descripción y objetivos, rúbrica y solución | Laboratorios (`/app/laboratorios`), rúbricas versionadas, entregas (`/app/entregas/nueva`) |
| 2. Portafolio por estudiante y laboratorio (PDF, código ZIP/GitHub, rúbrica) | `/app/portafolio/:id`. Cada entrega guarda la versión de la rúbrica vigente y el commit de GitHub |
| 3. Gestión de rúbricas: cargar, interpretar, parametrizar y detectar inconsistencias | Importación PDF/DOCX (con IA), JSON y CSV. Editor de competencias, criterios, niveles y pesos. Validador con correcciones automáticas; solo se publica sin errores |
| 4. Evaluación inteligente con evidencias, fortalezas, debilidades, recomendaciones y nota 0–5 revisable | `apps/api/src/evaluations`, pantalla `/app/evaluaciones/:id` |
| 5. Informe integrado con evolución, brechas y plan, visualizable y descargable | `/app/informe/:id`, PDF en `/api/reports/student/:id/pdf` |
| 6. Mapa mental interactivo con navegación, exploración y descarga | `/app/mapa/:id` (zoom, arrastre, contraer categorías, panel de detalle, PNG y JSON) |
| 7. Abstract y equipo | Página pública `/`. Se edita en Administración → Equipo y proyecto |
| Uso intensivo de IA documentado | `/desarrollo` y [`docs/DESARROLLO_CON_IA.md`](docs/DESARROLLO_CON_IA.md) |
| Salida estructurada validada; nota calculada por el backend | `eval.schema.ts` (Zod), `rubric.ts → computeGrade` |
| Verificación objetiva del código en sandbox | `apps/api/src/sandbox` |
| Modelos locales o en la nube configurables | Administración → Modelo de IA (con prueba de conexión) |
| Despliegue, autenticación, usuarios, persistencia | JWT en cookie httpOnly, roles, Neon, `render.yaml` |
| Trazabilidad y supervisión docente | Cada evaluación guarda evidencias (SHA-256), rúbrica congelada, modelo, versión del prompt, verificación, citas, ajustes del docente y bitácora de auditoría |

## Ejecución local

Requisitos: Node 22, Python 3 con `pytest` (para las pruebas del sandbox) y PostgreSQL (local o Neon).

```bash
# 1. API
cd apps/api
cp .env.example .env          # completa DATABASE_URL y JWT_SECRET
npm ci
npm run build
node --env-file=.env dist/seed.js --demo --evaluate   # migra, crea datos de ejemplo y los evalúa
node --env-file=.env dist/main.js                     # http://localhost:4000/api/health

# 2. Web (otra terminal)
cd apps/web
npm ci
API_URL=http://localhost:4000 npm run dev             # http://localhost:3000
```

Las migraciones se aplican solas al iniciar la API, y el administrador inicial se crea si la base está vacía.

### Cuentas de ejemplo (solo si cargaste los datos demo)

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | admin@asesor.edu.co | `ADMIN_PASSWORD` (por defecto `Admin2026!`) |
| Docente | docente@asesor.edu.co | Demo2026! |
| Estudiante | laura.gomez@asesor.edu.co | Demo2026! |
| Estudiante | andres.restrepo@asesor.edu.co | Demo2026! |

Cambia estas contraseñas antes de compartir la URL pública.

### Pruebas

```bash
cd apps/api && npm test
```

Cubren el cálculo de la nota, la validación y normalización de rúbricas, la importación CSV, la verificación de citas, la lectura segura de ZIP y el sandbox (errores de sintaxis, ejecución de pytest y bloqueo de red).

## Despliegue (Neon + Render)

1. **Neon**: crea un proyecto y copia la *connection string* (incluye `sslmode=require`).
2. **GitHub**: sube este repositorio.
3. **Render** → *New* → *Blueprint* → elige el repositorio. Render lee `render.yaml` y crea dos servicios:
   - `asesor-api` (Docker): define `DATABASE_URL` (Neon), `ADMIN_PASSWORD` y, si usarás un modelo real, la clave del proveedor (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY` o `GEMINI_API_KEY`). `JWT_SECRET` se genera solo.
   - `asesor-web` (Node): toma `API_URL` de la API automáticamente.
4. Abre la URL de `asesor-web`, entra como administrador y, en **Administración → Modelo de IA**, elige el proveedor y usa **Probar conexión**.
5. Opcional: carga los datos de ejemplo desde la *Shell* del servicio API: `node dist/seed.js --demo --evaluate`.

**¿Vercel para el frontend?** Funciona: importa `apps/web` y define `API_URL` con la URL de la API en Render. La subida de archivos pasa por el proxy `/api/*`, y Vercel puede limitar el tamaño de esas peticiones. Si los ZIP o PDF son grandes, deja la web en Render.

**Plan gratuito de Render**: el servicio se suspende tras inactividad y la primera visita tarda unos segundos. Para la socialización conviene abrir la URL unos minutos antes o usar el plan *Starter*.

**Sandbox en la nube**: dentro de un contenedor sin privilegios, `unshare -n` puede no estar disponible. En ese caso la plataforma usa el respaldo (bloqueo de sockets en Python y Node) y lo muestra en Administración → Sandbox. Para un aislamiento completo, despliega la API en un VPS con Docker.

## Modelos de IA: requisitos y costos

| Proveedor | Requisitos | Observaciones |
|---|---|---|
| Claude (Anthropic) | `ANTHROPIC_API_KEY` | Muy buena adherencia al esquema y lectura de código. Pago por tokens |
| OpenAI | `OPENAI_API_KEY` o URL base compatible | Esquema JSON nativo. Pago por tokens |
| Gemini | `GEMINI_API_KEY` | Capa gratuita con límites de uso |
| NVIDIA NIM | `NVIDIA_API_KEY` (build.nvidia.com) | API compatible con OpenAI; créditos gratuitos al registrarse. Modelo por defecto `meta/llama-3.3-70b-instruct` |
| Ollama | Servidor con el modelo descargado (`OLLAMA_BASE_URL`) | Sin costo por uso. Se recomiendan modelos de 7B o más y reducir el contexto máximo |
| Demo | Ninguno | Heurística para probar el flujo; no reemplaza un LLM |

Una evaluación típica envía entre 20 000 y 40 000 tokens de entrada (rúbrica, informe y código recortado) y recibe entre 3 000 y 6 000 de salida.

## Estructura

```
apps/api/src
  ai/            adaptadores de proveedores, servicio con validación y reintentos, taxonomía de IA
  auth/ users/   autenticación y gestión de usuarios
  labs/ rubrics/ laboratorios, rúbricas (validación, normalización, importación, versiones)
  submissions/   portafolio, carga de evidencias y descarga de archivos
  evidence/      extracción de PDF, DOCX, PPTX, notebooks, ZIP y GitHub
  sandbox/       ejecución aislada y verificación del código
  evaluations/   motor, esquemas, verificación de citas, revisión docente
  reports/       informe integrado, plan de fortalecimiento, PDF y mapa mental
  team/ settings/ presentación del proyecto, configuración, auditoría y estadísticas
apps/web/app     páginas públicas (/, /desarrollo, /login) y aplicación (/app/...)
```
