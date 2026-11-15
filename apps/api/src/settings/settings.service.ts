import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DB, DB_TOKEN } from '../db/db.module';
import { settings } from '../db/schema';
import { AiConfig, DEFAULT_MODELS, ProviderId } from '../ai/providers';

export interface Policy { studentsSeePreliminary: boolean; studentsCanEvaluate: boolean }
export interface ProjectInfo { name: string; abstract: string; objectives: string[]; features: string[]; technologies: string[]; contributions: string[]; aiTools: { tool: string; use: string; limits: string }[] }

export const DEFAULT_PROJECT: ProjectInfo = {
  name: 'Asesor Pedagógico Inteligente',
  abstract:
    'Plataforma web que permite a los estudiantes del curso de Inteligencia Artificial autoevaluar y fortalecer las competencias adquiridas en los laboratorios de las cohortes 1 y 2. ' +
    'A partir de la descripción del laboratorio, su rúbrica y la solución entregada (informe PDF y código), modelos de IA configurables analizan las evidencias, valoran cada criterio citando fragmentos verificables y formulan retroalimentación y recomendaciones. ' +
    'La nota (0,0–5,0) la calcula el backend con las ponderaciones de la rúbrica; el código se verifica en un sandbox aislado y cada evaluación queda trazada y sujeta a aprobación docente. ' +
    'La plataforma consolida un informe integral del aprendizaje y un mapa mental interactivo de las temáticas de IA con el nivel de dominio alcanzado.',
  objectives: [
    'Valorar de forma consistente, explicable y trazable cada laboratorio frente a su rúbrica.',
    'Identificar competencias adquiridas, conocimientos aplicados y brechas de aprendizaje.',
    'Consolidar la evolución del estudiante entre cohortes con un plan de fortalecimiento.',
    'Generar confianza en los resultados de la IA mediante verificación técnica y supervisión docente.',
  ],
  features: [
    'Portafolio académico por estudiante, cohorte y laboratorio',
    'Gestión e interpretación de rúbricas con detección de inconsistencias',
    'Evaluación inteligente con evidencias citadas y verificadas',
    'Verificación de código en sandbox: sintaxis, análisis estático y pruebas',
    'Revisión, ajuste y aprobación docente con trazabilidad completa',
    'Informe integrado del aprendizaje descargable en PDF',
    'Mapa mental interactivo de competencias en IA',
  ],
  technologies: ['Next.js', 'NestJS', 'PostgreSQL (Neon)', 'Drizzle ORM', 'Zod / JSON Schema', 'Claude · OpenAI · Gemini · Ollama', 'React Flow', 'Docker'],
  contributions: [
    'Separación estricta entre el juicio del LLM (niveles por criterio) y el cálculo de la nota (backend).',
    'Verificación automática de citas: cada evidencia se contrasta contra el material entregado.',
    'Arquitectura multimodelo intercambiable entre servicios en la nube y modelos locales.',
  ],
  aiTools: [
    { tool: 'Claude (Claude Code)', use: 'Análisis de requisitos, arquitectura, generación de módulos backend y frontend, pruebas y documentación.', limits: 'Requiere revisión humana de decisiones de seguridad y de los supuestos del dominio.' },
  ],
};

@Injectable()
export class SettingsService {
  constructor(@Inject(DB_TOKEN) private db: DB) {}

  async get<T>(key: string, fallback: T): Promise<T> {
    const [row] = await this.db.select().from(settings).where(eq(settings.key, key));
    return row ? { ...fallback, ...(row.value as object) } as T : fallback;
  }
  async set(key: string, value: unknown) {
    await this.db.insert(settings).values({ key, value }).onConflictDoUpdate({ target: settings.key, set: { value } });
  }

  defaultAi(): AiConfig {
    const provider = (process.env.AI_PROVIDER as ProviderId) || 'demo';
    return {
      provider,
      model: process.env.AI_MODEL || DEFAULT_MODELS[provider] || DEFAULT_MODELS.demo,
      baseUrl: process.env.AI_BASE_URL || undefined,
      temperature: 0.1,
      maxContextChars: Number(process.env.AI_MAX_CONTEXT_CHARS || 120_000),
    };
  }
  ai() { return this.get<AiConfig>('ai', this.defaultAi()); }
  policy() { return this.get<Policy>('policy', { studentsSeePreliminary: false, studentsCanEvaluate: true }); }
  project() { return this.get<ProjectInfo>('project', DEFAULT_PROJECT); }
}
