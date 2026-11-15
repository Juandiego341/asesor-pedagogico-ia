# Desarrollo de software aumentado con IA

Este documento registra cómo se usaron los asistentes de IA en cada etapa del proyecto. Las secciones marcadas con ✍️ deben completarlas los integrantes con su experiencia propia (otras herramientas, problemas y aprendizajes).

## Herramientas

| Herramienta | Etapas | Aporte | Limitaciones encontradas |
|---|---|---|---|
| Claude (agente de codificación) | Requisitos, arquitectura, backend, frontend, pruebas, documentación, despliegue | Analizó el enunciado, propuso la arquitectura, generó los módulos NestJS y las pantallas Next.js, escribió las pruebas y los archivos de despliegue, y revisó visualmente las pantallas con capturas | Requiere supervisión en decisiones de seguridad (sandbox, permisos) y en los supuestos del dominio pedagógico; no tiene acceso a las rúbricas reales del curso |
| ✍️ Otras (ChatGPT, Gemini, Copilot, Cursor…) | | | |

## Etapas

### 1. Ingeniería de requisitos
- Se extrajeron del enunciado las 7 funcionalidades obligatorias y las 6 condiciones de ingeniería, y se convirtieron en una matriz de cumplimiento (ver README).
- Decisiones de alcance: una sola evaluación publicada por entrega; el estudiante solo ve resultados aprobados por el docente (configurable).

### 2. Arquitectura
Alternativas evaluadas:

| Opción | Ventaja | Desventaja | Decisión |
|---|---|---|---|
| Todo en Next.js (rutas API) | Un solo despliegue | Las evaluaciones largas superan los tiempos de las funciones serverless; sin sandbox de procesos | Descartada |
| Next.js + NestJS + Neon | Evaluaciones en segundo plano, sandbox con procesos del sistema, tipado de extremo a extremo | Dos servicios | **Elegida** |
| Backend en Python (FastAPI + Pydantic) | Pydantic nativo | El equipo pidió NestJS | Descartada |

### 3. Decisiones de confiabilidad
1. **El LLM nunca calcula la nota.** Solo elige `levelId` por criterio; `computeGrade` aplica Σ(peso × valor).
2. **Esquema estricto.** Los identificadores de criterios y niveles válidos se inyectan como `enum` en el JSON Schema. Si la salida no cumple, se reintenta hasta 3 veces indicándole los errores al modelo.
3. **Citas verificables.** Cada cita se busca (normalizada) en el informe y el código. Las no encontradas generan alertas para el docente.
4. **Inyección de instrucciones.** El prompt indica ignorar instrucciones contenidas en las evidencias del estudiante; la nota sigue dependiendo de niveles validados.
5. **Sandbox.** Sin red, usuario sin privilegios, límites de recursos y tiempo. El análisis estático usa `ast` (no ejecuta código).
6. **Trazabilidad.** Se congela la rúbrica en la evaluación y se guardan los hashes de las evidencias, el modelo, la versión del prompt, los tokens, la verificación y los ajustes del docente.

### 4. Pruebas
- Pruebas unitarias (`npm test` en `apps/api`): cálculo de nota, validación de rúbricas, CSV, citas, ZIP y sandbox.
- Pruebas de punta a punta ejecutadas durante el desarrollo: carga de entrega, evaluación en segundo plano, ajuste docente, publicación y visibilidad para el estudiante; importación de rúbrica con pesos inválidos, bloqueo de publicación y corrección automática; adaptador de IA contra un servidor simulado con salida inválida y reintento exitoso.
- Revisión visual de las pantallas con capturas en navegador sin interfaz.

### 5. Problemas encontrados
- La clasificación de temáticas por palabras clave confundía "Preprocesamiento" con la métrica ROC (subcadena "roc"). Se corrigió con límites de palabra y otro orden de reglas.
- Las relaciones entre temas saturaban visualmente el mapa mental; quedaron desactivadas por defecto y se pueden activar.
- La API de GitHub puede limitar peticiones; se agregó una descarga directa de respaldo y soporte para `GITHUB_TOKEN`.
- ✍️ Problemas propios del equipo durante el despliegue.

### 6. Reflexión ✍️
- ¿Qué cambió al pasar de programar a dirigir y verificar el trabajo de la IA?
- ¿Qué errores de la IA detectaron y cómo?
- ¿Qué harían distinto?
