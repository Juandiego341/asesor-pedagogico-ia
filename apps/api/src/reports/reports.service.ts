import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { asc, desc, eq, inArray } from 'drizzle-orm';
import { DB, DB_TOKEN } from '../db/db.module';
import { cohorts, evaluations, labs, learningPlans, submissions, users } from '../db/schema';
import { RubricContent, round } from '../rubrics/rubric';
import { AI_CATEGORIES, classifyTopic, masteryLabel } from '../ai/taxonomy';
import { norm } from '../evaluations/citations';
import type { EvaluationOutput } from '../evaluations/eval.schema';

type AiCat = (typeof AI_CATEGORIES)[number];
type Row = { criterionId: string; criterionName: string; competencyId: string; weight: number; score: number; levelName: string };

/** Relaciones conceptuales entre categorías de IA (aristas del mapa mental). */
const CATEGORY_LINKS: [AiCat, AiCat, string][] = [
  ['Fundamentos de IA', 'Agentes, búsqueda y razonamiento', 'formaliza'],
  ['Fundamentos de IA', 'Aprendizaje automático', 'da origen a'],
  ['Datos y preprocesamiento', 'Aprendizaje automático', 'alimenta'],
  ['Aprendizaje automático', 'Aprendizaje profundo', 'se especializa en'],
  ['Aprendizaje automático', 'Evaluación de modelos', 'se valida con'],
  ['Aprendizaje profundo', 'Procesamiento de lenguaje natural', 'habilita'],
  ['Aprendizaje profundo', 'Visión por computador', 'habilita'],
  ['Procesamiento de lenguaje natural', 'IA generativa y LLM', 'evoluciona a'],
  ['IA generativa y LLM', 'Agentes, búsqueda y razonamiento', 'potencia'],
  ['IA generativa y LLM', 'Ingeniería y despliegue de IA', 'se integra mediante'],
  ['Ética y IA responsable', 'IA generativa y LLM', 'regula'],
  ['Ética y IA responsable', 'Datos y preprocesamiento', 'cuida'],
];

@Injectable()
export class ReportsService {
  constructor(@Inject(DB_TOKEN) private db: DB) {}

  async collect(studentId: string, includeUnpublished: boolean) {
    const [student] = await this.db.select({ id: users.id, name: users.name, email: users.email, studentCode: users.studentCode, role: users.role }).from(users).where(eq(users.id, studentId));
    if (!student) throw new NotFoundException('Estudiante no encontrado');
    const cs = await this.db.select().from(cohorts).orderBy(asc(cohorts.number));
    const ls = await this.db.select().from(labs).orderBy(asc(labs.order));
    const subs = await this.db.select().from(submissions).where(eq(submissions.studentId, studentId));
    const statuses = includeUnpublished ? ['PUBLISHED', 'APPROVED', 'PENDING_REVIEW'] : ['PUBLISHED'];
    const evs = subs.length ? await this.db.select().from(evaluations).where(inArray(evaluations.submissionId, subs.map((s) => s.id))).orderBy(desc(evaluations.createdAt)) : [];
    const rank = (s: string) => ({ PUBLISHED: 3, APPROVED: 2, PENDING_REVIEW: 1 } as Record<string, number>)[s] ?? 0;
    const perLab = ls.map((l) => {
      const c = cs.find((x) => x.id === l.cohortId)!;
      const labSubs = subs.filter((s) => s.labId === l.id).map((s) => s.id);
      const cand = evs.filter((e) => labSubs.includes(e.submissionId) && statuses.includes(e.status));
      const ev = cand.sort((a, b) => rank(b.status) - rank(a.status) || +b.createdAt - +a.createdAt)[0];
      return { lab: l, cohort: c, ev };
    });
    return { student, cohorts: cs, perLab };
  }

  async report(studentId: string, includeUnpublished: boolean) {
    const { student, cohorts: cs, perLab } = await this.collect(studentId, includeUnpublished);
    const labsOut = perLab.map(({ lab, cohort, ev }) => ({
      labId: lab.id, title: lab.title, order: lab.order, cohort: cohort.number, cohortName: cohort.name,
      evaluationId: ev?.id ?? null, status: ev?.status ?? null,
      grade: ev ? (ev.finalGrade ?? ev.preliminaryGrade) : null,
      validated: ev ? ev.status === 'PUBLISHED' || ev.status === 'APPROVED' : false,
      date: ev?.publishedAt ?? ev?.createdAt ?? null,
    }));
    const evaluated = perLab.filter((p) => p.ev?.criteriaResults);

    // Competencias: promedio de los valores obtenidos en los criterios asociados, en todos los laboratorios
    const comp = new Map<string, { name: string; scores: number[]; weighted: number; weights: number; labs: Set<string>; criteria: Set<string> }>();
    for (const { lab, ev } of evaluated) {
      const r = ev!.rubricSnapshot as RubricContent;
      for (const row of ev!.criteriaResults as Row[]) {
        const name = r.competencies.find((c) => c.id === row.competencyId)?.name ?? 'General';
        const key = norm(name);
        if (!comp.has(key)) comp.set(key, { name, scores: [], weighted: 0, weights: 0, labs: new Set(), criteria: new Set() });
        const c = comp.get(key)!;
        c.scores.push(row.score); c.weighted += row.score * row.weight; c.weights += row.weight; c.labs.add(lab.title); c.criteria.add(row.criterionName);
      }
    }
    const competencies = [...comp.values()].map((c) => {
      const score = c.weights ? round(c.weighted / c.weights, 2) : null;
      return { name: c.name, score, level: masteryLabel(score), labs: [...c.labs], criteria: [...c.criteria] };
    }).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    const grades = labsOut.filter((l) => l.grade !== null) as (typeof labsOut[number] & { grade: number })[];
    const avg = (xs: number[]) => (xs.length ? round(xs.reduce((a, b) => a + b, 0) / xs.length, 2) : null);
    const byCohort = cs.map((c) => {
      const g = grades.filter((l) => l.cohort === c.number).map((l) => l.grade);
      return { cohort: c.number, name: c.name, average: avg(g), evaluated: g.length, total: labsOut.filter((l) => l.cohort === c.number).length };
    });
    const trend = grades.length >= 2 ? slope(grades.map((g, i) => [i, g.grade])) : null;

    const outputs = evaluated.map((p) => ({ lab: p.lab.title, out: p.ev!.aiOutput as EvaluationOutput }));
    const learned = dedupe(outputs.flatMap((o) => o.out.learned.map((t) => ({ text: t, lab: o.lab }))));
    const toStrengthen = dedupe(outputs.flatMap((o) => o.out.toStrengthen.map((t) => ({ text: t, lab: o.lab }))));
    const recommendations = outputs.flatMap((o) => o.out.recommendations.map((r) => ({ ...r, lab: o.lab })))
      .sort((a, b) => ['alta', 'media', 'baja'].indexOf(a.priority) - ['alta', 'media', 'baja'].indexOf(b.priority)).slice(0, 12);
    const gaps = competencies.filter((c) => c.score !== null && c.score < 3.5).map((c) => ({ competency: c.name, score: c.score, level: c.level, labs: c.labs }));
    const lowCriteria = evaluated.flatMap((p) => (p.ev!.criteriaResults as Row[]).filter((r) => r.score < 3).map((r) => ({ lab: p.lab.title, criterion: r.criterionName, score: r.score, level: r.levelName })));

    const [plan] = await this.db.select().from(learningPlans).where(eq(learningPlans.studentId, studentId)).orderBy(desc(learningPlans.createdAt)).limit(1);
    return {
      generatedAt: new Date().toISOString(), includeUnpublished, student,
      summary: {
        labsTotal: labsOut.length, labsEvaluated: grades.length, average: avg(grades.map((g) => g.grade)),
        best: grades.length ? grades.reduce((a, b) => (b.grade > a.grade ? b : a)) : null,
        worst: grades.length ? grades.reduce((a, b) => (b.grade < a.grade ? b : a)) : null,
        trend, trendLabel: trend === null ? 'Sin datos suficientes' : trend > 0.05 ? 'En mejora' : trend < -0.05 ? 'En descenso' : 'Estable',
      },
      labs: labsOut, byCohort, competencies, learned, toStrengthen, gaps, lowCriteria, recommendations,
      plan: plan ? { ...plan.content as object, createdAt: plan.createdAt, provider: plan.provider, model: plan.model } : null,
    };
  }

  async mindmap(studentId: string, includeUnpublished: boolean) {
    const { student, perLab } = await this.collect(studentId, includeUnpublished);
    type LabRef = { labId: string; title: string; cohort: number; mastery: number | null; evidence: string; gaps: string; evaluationId: string | null };
    const topics = new Map<string, { name: string; category: string; labs: LabRef[] }>();
    const add = (name: string, category: string, ref: LabRef) => {
      const key = norm(name);
      if (!topics.has(key)) topics.set(key, { name, category, labs: [] });
      const t = topics.get(key)!;
      if (!t.labs.some((l) => l.labId === ref.labId)) t.labs.push(ref);
    };
    for (const { lab, cohort, ev } of perLab) {
      const out = ev?.aiOutput as EvaluationOutput | undefined;
      const rows = (ev?.criteriaResults as Row[] | undefined) ?? [];
      const grade = ev ? (ev.finalGrade ?? ev.preliminaryGrade) : null;
      const covered = new Set<string>();
      for (const t of out?.topics ?? []) {
        const rel = rows.filter((r) => t.relatedCriterionIds.includes(r.criterionId));
        const mastery = rel.length ? round(rel.reduce((s, r) => s + r.score * r.weight, 0) / rel.reduce((s, r) => s + r.weight, 0), 2) : grade;
        add(t.name, t.category, { labId: lab.id, title: lab.title, cohort: cohort.number, mastery, evidence: t.evidence, gaps: t.gaps, evaluationId: ev!.id });
        covered.add(norm(t.name));
      }
      for (const name of lab.topics) {
        if (covered.has(norm(name))) continue;
        add(name, classifyTopic(name), { labId: lab.id, title: lab.title, cohort: cohort.number, mastery: grade, evidence: ev ? 'Temática del laboratorio evaluado.' : 'Laboratorio aún sin evaluación.', gaps: '', evaluationId: ev?.id ?? null });
      }
    }
    const topicNodes = [...topics.values()].map((t, i) => {
      const ms = t.labs.map((l) => l.mastery).filter((m): m is number => m !== null);
      const mastery = ms.length ? round(ms.reduce((a, b) => a + b, 0) / ms.length, 2) : null;
      return { id: `t${i}`, ...t, mastery, level: masteryLabel(mastery), gaps: t.labs.map((l) => l.gaps).filter(Boolean) };
    });
    const categories = AI_CATEGORIES.map((name, i) => {
      const ts = topicNodes.filter((t) => t.category === name);
      const ms = ts.map((t) => t.mastery).filter((m): m is number => m !== null);
      const mastery = ms.length ? round(ms.reduce((a, b) => a + b, 0) / ms.length, 2) : null;
      return { id: `c${i}`, name, mastery, level: masteryLabel(mastery), topics: ts };
    }).filter((c) => c.topics.length);
    const present = new Set<string>(categories.map((c) => c.name));
    const links = CATEGORY_LINKS.filter(([a, b]) => present.has(a) && present.has(b)).map(([from, to, label]) => ({ from, to, label }));
    // Temas que co-ocurren en un mismo laboratorio quedan relacionados
    const related: { from: string; to: string; lab: string }[] = [];
    for (let i = 0; i < topicNodes.length; i++) for (let j = i + 1; j < topicNodes.length; j++) {
      const shared = topicNodes[i].labs.find((l) => topicNodes[j].labs.some((m) => m.labId === l.labId));
      if (shared && topicNodes[i].category !== topicNodes[j].category) related.push({ from: topicNodes[i].id, to: topicNodes[j].id, lab: shared.title });
    }
    return { student: { id: student.id, name: student.name }, root: 'Inteligencia Artificial', categories, links, related: related.slice(0, 40), generatedAt: new Date().toISOString() };
  }
}

function slope(points: number[][]) {
  const n = points.length, sx = points.reduce((s, p) => s + p[0], 0), sy = points.reduce((s, p) => s + p[1], 0);
  const sxy = points.reduce((s, p) => s + p[0] * p[1], 0), sxx = points.reduce((s, p) => s + p[0] * p[0], 0);
  const d = n * sxx - sx * sx;
  return d ? round((n * sxy - sx * sy) / d, 3) : 0;
}
function dedupe(items: { text: string; lab: string }[]) {
  const m = new Map<string, { text: string; labs: string[] }>();
  for (const i of items) {
    const k = norm(i.text).slice(0, 80);
    if (!m.has(k)) m.set(k, { text: i.text, labs: [] });
    if (!m.get(k)!.labs.includes(i.lab)) m.get(k)!.labs.push(i.lab);
  }
  return [...m.values()].slice(0, 30);
}
