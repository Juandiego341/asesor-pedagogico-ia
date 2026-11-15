import { z } from 'zod';

/** Estructura parametrizada de una rúbrica. Las ponderaciones son porcentajes que deben sumar 100. */
export const levelSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, 'El nivel necesita nombre'),
  score: z.number().min(0).max(5),
  descriptor: z.string(),
});
export const criterionSchema = z.object({
  id: z.string().min(1),
  competencyId: z.string().min(1),
  name: z.string().min(1, 'El criterio necesita nombre'),
  description: z.string().default(''),
  weight: z.number(),
  levels: z.array(levelSchema),
});
export const competencySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, 'La competencia necesita nombre'),
  description: z.string().default(''),
});
export const rubricContentSchema = z.object({
  title: z.string().default('Rúbrica'),
  competencies: z.array(competencySchema),
  criteria: z.array(criterionSchema),
});
export type RubricContent = z.infer<typeof rubricContentSchema>;
export type Criterion = z.infer<typeof criterionSchema>;

/** Esquema "suelto" para la salida del LLM al interpretar rúbricas (ids opcionales, se completan luego). */
export const rubricExtractionSchema = z.object({
  title: z.string(),
  competencies: z.array(z.object({ name: z.string(), description: z.string() })),
  criteria: z.array(z.object({
    competency: z.string().describe('Nombre de la competencia a la que pertenece'),
    name: z.string(),
    description: z.string(),
    weight: z.number().describe('Ponderación en porcentaje tal como aparece en la rúbrica (0 si no aparece)'),
    levels: z.array(z.object({
      name: z.string(),
      score: z.number().describe('Valor del nivel en escala 0.0 a 5.0. Si la rúbrica usa otra escala, conviértela proporcionalmente.'),
      descriptor: z.string(),
    })),
  })),
});
export type RubricExtraction = z.infer<typeof rubricExtractionSchema>;

export interface RubricIssue {
  severity: 'error' | 'warning';
  path: string;
  message: string;
  fix?: 'normalize_weights' | 'sort_levels' | 'create_competency';
}

const slug = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'item';

export function fromExtraction(x: RubricExtraction): RubricContent {
  const comps = new Map<string, { id: string; name: string; description: string }>();
  const used = new Set<string>();
  const uid = (base: string) => { let id = base, i = 2; while (used.has(id)) id = `${base}-${i++}`; used.add(id); return id; };
  for (const c of x.competencies) {
    const key = c.name.trim().toLowerCase();
    if (!comps.has(key)) comps.set(key, { id: uid('C-' + slug(c.name)), name: c.name.trim(), description: c.description });
  }
  const criteria = x.criteria.map((cr) => {
    const key = (cr.competency || 'General').trim().toLowerCase();
    if (!comps.has(key)) comps.set(key, { id: uid('C-' + slug(cr.competency || 'general')), name: cr.competency || 'General', description: '' });
    const cid = uid('K-' + slug(cr.name));
    const lv = new Set<string>();
    return {
      id: cid,
      competencyId: comps.get(key)!.id,
      name: cr.name.trim(),
      description: cr.description,
      weight: Number(cr.weight) || 0,
      levels: cr.levels.map((l) => {
        let id = 'N-' + slug(l.name), i = 2; while (lv.has(id)) id = `N-${slug(l.name)}-${i++}`; lv.add(id);
        return { id, name: l.name.trim(), score: Math.max(0, Math.min(5, Number(l.score) || 0)), descriptor: l.descriptor };
      }),
    };
  });
  return { title: x.title || 'Rúbrica', competencies: [...comps.values()], criteria };
}

/** Detecta inconsistencias que impiden o comprometen la evaluación. */
export function validateRubric(raw: unknown): { content: RubricContent | null; issues: RubricIssue[] } {
  const issues: RubricIssue[] = [];
  const parsed = rubricContentSchema.safeParse(raw);
  if (!parsed.success) {
    for (const i of parsed.error.issues) issues.push({ severity: 'error', path: i.path.join('.'), message: i.message });
    return { content: null, issues };
  }
  const r = parsed.data;
  if (!r.criteria.length) issues.push({ severity: 'error', path: 'criteria', message: 'La rúbrica no tiene criterios' });
  if (!r.competencies.length) issues.push({ severity: 'error', path: 'competencies', message: 'La rúbrica no define competencias' });

  const compIds = new Set<string>();
  r.competencies.forEach((c, i) => {
    if (compIds.has(c.id)) issues.push({ severity: 'error', path: `competencies.${i}.id`, message: `Identificador de competencia duplicado: ${c.id}` });
    compIds.add(c.id);
  });
  const critIds = new Set<string>();
  let total = 0;
  r.criteria.forEach((c, i) => {
    const p = `criteria.${i}`;
    total += c.weight;
    if (critIds.has(c.id)) issues.push({ severity: 'error', path: `${p}.id`, message: `Identificador de criterio duplicado: ${c.id}` });
    critIds.add(c.id);
    if (!compIds.has(c.competencyId)) issues.push({ severity: 'error', path: `${p}.competencyId`, message: `El criterio "${c.name}" referencia una competencia inexistente`, fix: 'create_competency' });
    if (!(c.weight > 0)) issues.push({ severity: 'error', path: `${p}.weight`, message: `El criterio "${c.name}" debe tener una ponderación mayor que 0 %` });
    if (c.weight > 100) issues.push({ severity: 'error', path: `${p}.weight`, message: `La ponderación de "${c.name}" supera el 100 %` });
    if (c.levels.length < 2) issues.push({ severity: 'error', path: `${p}.levels`, message: `El criterio "${c.name}" necesita al menos 2 niveles de desempeño` });
    const lids = new Set<string>(); const scores = new Set<number>();
    c.levels.forEach((l, j) => {
      if (lids.has(l.id)) issues.push({ severity: 'error', path: `${p}.levels.${j}.id`, message: `Nivel duplicado en "${c.name}": ${l.id}` });
      lids.add(l.id);
      if (scores.has(l.score)) issues.push({ severity: 'warning', path: `${p}.levels.${j}.score`, message: `En "${c.name}" hay dos niveles con el mismo valor (${l.score})` });
      scores.add(l.score);
      if (!l.descriptor.trim()) issues.push({ severity: 'warning', path: `${p}.levels.${j}.descriptor`, message: `El nivel "${l.name}" de "${c.name}" no tiene descriptor de desempeño` });
    });
    if (c.levels.length >= 2) {
      const sorted = [...c.levels].every((l, j, a) => j === 0 || a[j - 1].score >= l.score);
      if (!sorted) issues.push({ severity: 'warning', path: `${p}.levels`, message: `Los niveles de "${c.name}" no están ordenados de mayor a menor`, fix: 'sort_levels' });
      const max = Math.max(...c.levels.map((l) => l.score));
      if (max < 5) issues.push({ severity: 'warning', path: `${p}.levels`, message: `El nivel más alto de "${c.name}" vale ${max}; la nota máxima alcanzable será menor que 5,0` });
    }
  });
  if (r.criteria.length && Math.abs(total - 100) > 0.01) {
    issues.push({ severity: 'error', path: 'criteria', message: `Las ponderaciones suman ${round(total, 2)} %; deben sumar exactamente 100 %`, fix: 'normalize_weights' });
  }
  r.competencies.forEach((c, i) => {
    if (!r.criteria.some((k) => k.competencyId === c.id)) issues.push({ severity: 'warning', path: `competencies.${i}`, message: `La competencia "${c.name}" no tiene criterios asociados` });
  });
  return { content: r, issues };
}

export function normalizeWeights(r: RubricContent): RubricContent {
  const total = r.criteria.reduce((s, c) => s + (c.weight > 0 ? c.weight : 0), 0);
  if (!r.criteria.length) return r;
  const base = total > 0 ? r.criteria.map((c) => (c.weight > 0 ? c.weight : 0) / total * 100) : r.criteria.map(() => 100 / r.criteria.length);
  const rounded = base.map((w) => round(w, 2));
  const diff = round(100 - rounded.reduce((a, b) => a + b, 0), 2);
  rounded[rounded.indexOf(Math.max(...rounded))] = round(rounded[rounded.indexOf(Math.max(...rounded))] + diff, 2);
  return { ...r, criteria: r.criteria.map((c, i) => ({ ...c, weight: rounded[i] })) };
}

export function sortLevels(r: RubricContent): RubricContent {
  return { ...r, criteria: r.criteria.map((c) => ({ ...c, levels: [...c.levels].sort((a, b) => b.score - a.score) })) };
}

export function fixMissingCompetencies(r: RubricContent): RubricContent {
  const ids = new Set(r.competencies.map((c) => c.id));
  const extra = [...new Set(r.criteria.map((c) => c.competencyId).filter((id) => !ids.has(id)))]
    .map((id) => ({ id, name: id, description: '' }));
  return { ...r, competencies: [...r.competencies, ...extra] };
}

export function round(n: number, d = 1) {
  const f = 10 ** d;
  return Math.round((n + Number.EPSILON) * f) / f;
}

/**
 * Cálculo determinista de la nota (0,0–5,0). Nunca lo hace el LLM.
 * nota = Σ (ponderación_i / 100) × valor_del_nivel_i
 */
export function computeGrade(r: RubricContent, chosen: Record<string, string>) {
  const rows = r.criteria.map((c) => {
    const level = c.levels.find((l) => l.id === chosen[c.id]);
    const score = level ? level.score : 0;
    return {
      criterionId: c.id, criterionName: c.name, competencyId: c.competencyId,
      weight: c.weight, levelId: level?.id ?? null, levelName: level?.name ?? 'Sin nivel válido',
      score, contribution: round((c.weight / 100) * score, 4),
      maxScore: Math.max(...c.levels.map((l) => l.score)),
    };
  });
  const grade = round(Math.min(5, Math.max(0, rows.reduce((s, x) => s + x.contribution, 0))), 1);
  return { rows, grade };
}

/** Importa una rúbrica en CSV: competencia;criterio;descripcion;peso;nivel;valor;descriptor */
export function parseRubricCsv(text: string): RubricExtraction {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) throw new Error('El CSV no tiene filas');
  const sep = (lines[0].match(/;/g)?.length ?? 0) >= (lines[0].match(/,/g)?.length ?? 0) ? ';' : ',';
  const split = (l: string) => {
    const out: string[] = []; let cur = '', q = false;
    for (const ch of l) {
      if (ch === '"') q = !q; else if (ch === sep && !q) { out.push(cur.trim()); cur = ''; } else cur += ch;
    }
    out.push(cur.trim()); return out;
  };
  const head = split(lines[0]).map((h) => slug(h));
  const col = (names: string[]) => head.findIndex((h) => names.some((n) => h.startsWith(n)));
  const ix = {
    comp: col(['competencia']), crit: col(['criterio']), desc: col(['descripcion']), weight: col(['peso', 'ponderacion']),
    level: col(['nivel']), score: col(['valor', 'puntaje', 'nota']), descriptor: col(['descriptor']),
  };
  if (ix.crit < 0 || ix.level < 0 || ix.score < 0) throw new Error('El CSV debe tener columnas: competencia, criterio, peso, nivel, valor, descriptor');
  const out: RubricExtraction = { title: 'Rúbrica importada (CSV)', competencies: [], criteria: [] };
  for (const l of lines.slice(1)) {
    const c = split(l);
    const comp = c[ix.comp] || 'General';
    if (!out.competencies.some((x) => x.name === comp)) out.competencies.push({ name: comp, description: '' });
    let cr = out.criteria.find((x) => x.name === c[ix.crit] && x.competency === comp);
    if (!cr) {
      cr = { competency: comp, name: c[ix.crit], description: ix.desc >= 0 ? c[ix.desc] : '', weight: Number((c[ix.weight] || '0').replace('%', '').replace(',', '.')), levels: [] };
      out.criteria.push(cr);
    }
    cr.levels.push({ name: c[ix.level], score: Number((c[ix.score] || '0').replace(',', '.')), descriptor: ix.descriptor >= 0 ? c[ix.descriptor] : '' });
  }
  return out;
}
