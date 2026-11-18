import { z } from 'zod';
import { AI_CATEGORIES } from '../ai/taxonomy';

export const PROMPT_VERSION = 'eval-v1.2';

export const evidenceSchema = z.object({
  source: z.enum(['informe', 'codigo', 'verificacion', 'imagen', 'otro']),
  location: z.string().describe('Ubicación exacta: "Página 3", ruta del archivo de código, o nombre de la verificación'),
  quote: z.string().describe('Fragmento copiado LITERALMENTE del material (máx. 300 caracteres). No parafrasear.'),
});

export const criterionEvalSchema = z.object({
  criterionId: z.string(),
  levelId: z.string().describe('Id del nivel de desempeño elegido, tomado de la rúbrica'),
  confidence: z.number().min(0).max(1).describe('Confianza en la valoración, 0 a 1'),
  justification: z.string().describe('Argumentación de por qué corresponde ese nivel, contrastando con el descriptor'),
  evidence: z.array(evidenceSchema),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
});

export const evaluationOutputSchema = z.object({
  criteria: z.array(criterionEvalSchema),
  learned: z.array(z.string()).describe('Conocimientos y competencias que el estudiante evidencia haber adquirido'),
  applied: z.string().describe('Cómo aplicó sus conocimientos en la solución'),
  toStrengthen: z.array(z.string()).describe('Conocimientos o competencias que requieren fortalecimiento'),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  feedback: z.string().describe('Retroalimentación argumentada dirigida al estudiante, en segunda persona'),
  recommendations: z.array(z.object({
    title: z.string(), detail: z.string(), priority: z.enum(['alta', 'media', 'baja']),
    resources: z.array(z.string()),
  })),
  topics: z.array(z.object({
    name: z.string().describe('Temática de IA abordada; usa los nombres de temáticas del laboratorio cuando apliquen'),
    category: z.enum(AI_CATEGORIES),
    relatedCriterionIds: z.array(z.string()),
    evidence: z.string().describe('Aprendizaje evidenciado en esta temática'),
    gaps: z.string().describe('Aspectos que requieren profundización ("" si ninguno)'),
  })),
});
export type EvaluationOutput = z.infer<typeof evaluationOutputSchema>;

export const learningPlanSchema = z.object({
  summary: z.string().describe('Síntesis del desempeño global y la evolución del aprendizaje'),
  evolution: z.string().describe('Análisis de la evolución entre laboratorios y cortes'),
  goals: z.array(z.object({
    competency: z.string(),
    currentLevel: z.string(),
    objective: z.string(),
    actions: z.array(z.string()),
    resources: z.array(z.string()),
    timeframe: z.string(),
    indicator: z.string().describe('Cómo se verificará el avance'),
  })),
});
export type LearningPlan = z.infer<typeof learningPlanSchema>;
