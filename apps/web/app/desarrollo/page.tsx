import Link from 'next/link';
import { getProject } from '@/lib/server';

export const dynamic = 'force-dynamic';

const DECISIONS = [
  ['La nota la calcula el servidor', 'El modelo solo elige el nivel de desempeño de cada criterio. La nota se obtiene como Σ(ponderación × valor del nivel), de forma reproducible y auditable.'],
  ['Salida estructurada validada', 'Cada respuesta del modelo se valida con Zod (exportado a JSON Schema). Los identificadores de criterios y niveles se restringen en el esquema y, si la salida no cumple, se reintenta indicando los errores.'],
  ['Citas verificables', 'Las evidencias citadas por el modelo se buscan en el texto del informe y del código. Las que no aparecen se marcan para el docente.'],
  ['Sandbox para el código', 'Las verificaciones corren en un directorio temporal, sin red (namespace de red vacío), con usuario sin privilegios, límites de memoria, CPU y tiempo, y sin variables de entorno sensibles.'],
  ['Modelos intercambiables', 'Un adaptador común permite usar Claude, OpenAI, Gemini u Ollama (local). El administrador elige el proveedor desde la plataforma; las claves viven en variables de entorno.'],
  ['Supervisión docente', 'Ninguna valoración es visible para el estudiante hasta que el docente la aprueba y publica. Cada ajuste queda en la bitácora de auditoría.'],
];

const COSTS = [
  ['Claude (Anthropic)', 'Muy buena adherencia a esquemas y lectura de código. Pago por uso.'],
  ['OpenAI', 'Salida JSON con esquema nativo. Pago por uso.'],
  ['Google Gemini', 'Capa gratuita con límites; útil para pruebas y demos.'],
  ['Ollama (local)', 'Sin costo por uso y los datos no salen del servidor; requiere un equipo con GPU o bastante RAM y modelos de 7B+ para resultados aceptables.'],
  ['Modo demo', 'Heurística sin LLM para probar el flujo completo. No reemplaza la evaluación con un modelo.'],
];

export default async function Desarrollo() {
  const p = await getProject();
  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <Link href="/" className="text-sm text-teal hover:underline">Volver al inicio</Link>
      <h1 className="text-4xl font-semibold mt-4">Desarrollo aumentado con IA</h1>
      <p className="text-lg text-ink-2 mt-4 max-w-[68ch]">La plataforma se construyó dirigiendo asistentes de IA en todas las etapas: requisitos, arquitectura, código, pruebas, documentación y despliegue. El equipo actuó como responsable de orientar, verificar y corregir ese trabajo.</p>

      <h2 className="text-2xl font-semibold mt-12 mb-4">Herramientas utilizadas</h2>
      <div className="overflow-x-auto border border-line rounded-lg bg-card">
        <table className="w-full text-sm">
          <thead className="text-left bg-paper"><tr><th className="p-3">Herramienta</th><th className="p-3">Aporte</th><th className="p-3">Limitaciones encontradas</th></tr></thead>
          <tbody>{(p?.aiTools ?? []).map((t) => <tr key={t.tool} className="border-t border-line align-top"><td className="p-3 font-medium">{t.tool}</td><td className="p-3">{t.use}</td><td className="p-3 text-ink-2">{t.limits}</td></tr>)}</tbody>
        </table>
      </div>

      <h2 className="text-2xl font-semibold mt-12 mb-4">Decisiones técnicas</h2>
      <dl className="space-y-5">{DECISIONS.map(([t, d]) => <div key={t}><dt className="font-semibold">{t}</dt><dd className="text-ink-2 mt-1">{d}</dd></div>)}</dl>

      <h2 className="text-2xl font-semibold mt-12 mb-4">Modelos de IA: requisitos, limitaciones y costos</h2>
      <dl className="space-y-4">{COSTS.map(([t, d]) => <div key={t} className="grid sm:grid-cols-[200px_1fr] gap-2"><dt className="font-semibold">{t}</dt><dd className="text-ink-2">{d}</dd></div>)}</dl>
    </div>
  );
}
