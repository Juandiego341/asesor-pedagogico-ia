export const fmtGrade = (n: number | null | undefined) => (n === null || n === undefined ? '—' : n.toFixed(1).replace('.', ','));
export const fmtDate = (d: string | Date | null | undefined) => (d ? new Date(d).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
export const gradeTone = (n: number | null | undefined) => (n === null || n === undefined ? 'none' : n >= 4 ? 'high' : n >= 3 ? 'mid' : 'low');
export const STATUS: Record<string, { label: string; tone: string }> = {
  QUEUED: { label: 'En cola', tone: 'neutral' },
  RUNNING: { label: 'Evaluando…', tone: 'neutral' },
  FAILED: { label: 'Falló', tone: 'low' },
  PENDING_REVIEW: { label: 'Pendiente de revisión docente', tone: 'mid' },
  APPROVED: { label: 'Aprobada', tone: 'high' },
  PUBLISHED: { label: 'Publicada', tone: 'high' },
};
export const ROLE: Record<string, string> = { ADMIN: 'Administrador', TEACHER: 'Docente', STUDENT: 'Estudiante' };
export const PROVIDER: Record<string, string> = { anthropic: 'Claude (Anthropic)', openai: 'OpenAI', gemini: 'Google Gemini', ollama: 'Ollama (local)', demo: 'Modo demo (sin LLM)' };
