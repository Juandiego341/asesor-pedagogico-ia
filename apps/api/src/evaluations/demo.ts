import type { RubricContent } from '../rubrics/rubric';
import type { EvaluationOutput, LearningPlan } from './eval.schema';
import type { VerificationReport } from '../sandbox/code-check';
import { classifyTopic } from '../ai/taxonomy';
import { norm } from './citations';

/**
 * Evaluador heurístico ("modo demo"): permite probar el flujo completo sin un LLM.
 * Mide la cobertura de los términos de cada criterio en las evidencias y las señales de la verificación técnica.
 * Sus valoraciones son orientativas y siempre deben ser revisadas por el docente.
 */
const STOP = new Set('de la el los las y en un una que para por con del se al su sus o a lo como es son mas más este esta estos estas ser sobre entre cada sin según debe deben'.split(' '));
const terms = (s: string) => [...new Set(norm(s).split(' ').filter((w) => w.length > 3 && !STOP.has(w)))];

function sentences(text: string) {
  return text.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter((s) => s.length > 40 && s.length < 300);
}

export function demoEvaluate(rubric: RubricContent, report: string, code: string, ver: VerificationReport | null, labTopics: string[]): EvaluationOutput {
  const corpus = norm(report + ' ' + code);
  const reportSents = sentences(report);
  const codeLines = code.split('\n').filter((l) => l.trim().length > 25 && !l.startsWith('===')).slice(0, 4000);
  const techOk = ver ? (ver.syntax.checked ? ver.syntax.passed / ver.syntax.checked : 0.5) : 0.5;
  const testsOk = ver?.tests.ran ? (ver.tests.passed / Math.max(1, ver.tests.passed + ver.tests.failed + ver.tests.errors)) : null;

  const criteria = rubric.criteria.map((c) => {
    const t = terms(`${c.name} ${c.description} ${c.levels.map((l) => l.descriptor).join(' ')}`);
    const found = t.filter((w) => corpus.includes(w));
    let ratio = t.length ? found.length / t.length : 0;
    const isCode = /c[oó]digo|implementa|programa|prueba|funcional|t[eé]cnic/i.test(c.name + c.description);
    if (isCode) ratio = ratio * 0.6 + techOk * 0.25 + (testsOk ?? techOk) * 0.15;
    if (report.length < 1500) ratio *= 0.8;
    const sorted = [...c.levels].sort((a, b) => b.score - a.score);
    const idx = Math.min(sorted.length - 1, Math.floor((1 - Math.min(1, ratio * 1.35)) * sorted.length));
    const level = sorted[idx];
    const ranked = reportSents.map((s) => ({ s, k: terms(s).filter((w) => t.includes(w)).length })).sort((a, b) => b.k - a.k);
    const evidence: EvaluationOutput['criteria'][number]['evidence'] = ranked.slice(0, 2).filter((x) => x.k > 0).map((x) => ({
      source: 'informe' as const, location: pageOf(report, x.s), quote: x.s.slice(0, 280),
    }));
    if (isCode) {
      const line = codeLines.find((l) => terms(l).some((w) => t.includes(w))) || codeLines[0];
      if (line) evidence.push({ source: 'codigo', location: fileOf(code, line), quote: line.trim().slice(0, 200) });
      if (ver) evidence.push({ source: 'verificacion', location: 'Verificación técnica', quote: ver.score.notes.join(' ') });
    }
    const missing = t.filter((w) => !corpus.includes(w)).slice(0, 4);
    return {
      criterionId: c.id, levelId: level.id, confidence: Math.round((0.35 + Math.min(0.3, found.length / 30)) * 100) / 100,
      justification: `Se identificaron ${found.length} de ${t.length} conceptos clave del criterio en las evidencias (${Math.round(ratio * 100)} % de cobertura), lo que corresponde al nivel "${level.name}": ${level.descriptor}`,
      evidence,
      strengths: found.length ? [`Aborda conceptos como: ${found.slice(0, 5).join(', ')}.`] : [],
      weaknesses: missing.length ? [`No se evidencian con claridad: ${missing.join(', ')}.`] : [],
    };
  });

  const topics = labTopics.map((name) => {
    const tt = terms(name);
    const related = rubric.criteria.filter((c) => terms(c.name + ' ' + c.description).some((w) => tt.includes(w))).map((c) => c.id);
    const present = tt.some((w) => corpus.includes(w));
    return {
      name, category: classifyTopic(name), relatedCriterionIds: related.length ? related : rubric.criteria.map((c) => c.id),
      evidence: present ? `La entrega aborda explícitamente ${name.toLowerCase()}.` : `Hay poca evidencia explícita sobre ${name.toLowerCase()}.`,
      gaps: present ? '' : `Profundizar en ${name.toLowerCase()} y documentar su aplicación.`,
    };
  });
  const weak = criteria.filter((c) => rubric.criteria.find((k) => k.id === c.criterionId)!.levels.find((l) => l.id === c.levelId)!.score < 3.5);
  const strong = criteria.filter((c) => !weak.includes(c));
  const name = (id: string) => rubric.criteria.find((k) => k.id === id)!.name;
  return {
    criteria,
    learned: strong.map((c) => name(c.criterionId)),
    applied: ver ? `La solución incluye ${ver.inventory.files} archivo(s) y ${ver.inventory.lines} líneas; ${ver.score.notes[0] ?? ''} Las librerías detectadas (${ver.staticAnalysis.aiLibraries.join(', ') || 'ninguna de IA'}) muestran cómo se llevaron los conceptos a la práctica.` : 'La evaluación se basó en el informe entregado.',
    toStrengthen: weak.map((c) => name(c.criterionId)),
    strengths: strong.slice(0, 4).map((c) => `Buen desempeño en "${name(c.criterionId)}".`),
    weaknesses: weak.slice(0, 4).map((c) => `Desempeño por mejorar en "${name(c.criterionId)}".`),
    feedback: `Tu entrega muestra avances en ${strong.length} de ${criteria.length} criterios. ${weak.length ? `Para mejorar, enfócate en: ${weak.map((c) => name(c.criterionId)).join('; ')}.` : 'Mantén el nivel y profundiza en los aspectos avanzados.'} (Valoración generada en modo demo: es orientativa y la revisará tu docente.)`,
    recommendations: weak.slice(0, 4).map((c, i) => ({
      title: `Fortalecer: ${name(c.criterionId)}`,
      detail: `Revisa el descriptor del nivel superior de la rúbrica y documenta en el informe cómo tu solución lo cumple, con resultados y análisis.`,
      priority: i === 0 ? 'alta' as const : 'media' as const,
      resources: ['Material del curso del laboratorio correspondiente'],
    })).concat(ver && !ver.tests.ran ? [{ title: 'Agregar pruebas unitarias', detail: 'Incluye pruebas (pytest) que validen las funciones principales de tu solución.', priority: 'media' as const, resources: ['https://docs.pytest.org'] }] : []),
    topics,
  };
}

function pageOf(report: string, sentence: string) {
  const i = report.indexOf(sentence);
  const before = report.slice(0, i);
  const m = [...before.matchAll(/\[Página (\d+)\]/g)].pop();
  return m ? `Página ${m[1]}` : 'Informe';
}
function fileOf(code: string, line: string) {
  const i = code.indexOf(line);
  const m = [...code.slice(0, i).matchAll(/=== \[CODIGO (.+?)\] ===/g)].pop();
  return m ? m[1] : 'Código';
}

export function demoPlan(data: { competencies: { name: string; score: number | null; level: string }[]; labs: { title: string; grade: number | null }[] }): LearningPlan {
  const graded = data.labs.filter((l) => l.grade !== null);
  const first = graded[0]?.grade ?? null, last = graded[graded.length - 1]?.grade ?? null;
  const gaps = data.competencies.filter((c) => c.score !== null && c.score < 4).sort((a, b) => a.score! - b.score!);
  return {
    summary: `Se consolidaron ${graded.length} laboratorio(s) evaluados. ${gaps.length ? `Se identificaron ${gaps.length} competencia(s) por fortalecer.` : 'Todas las competencias evaluadas alcanzan un nivel avanzado.'}`,
    evolution: first !== null && last !== null && graded.length > 1
      ? `La nota pasó de ${first.toFixed(1)} en "${graded[0].title}" a ${last.toFixed(1)} en "${graded[graded.length - 1].title}" (${last >= first ? 'tendencia de mejora' : 'tendencia a la baja'}).`
      : 'Aún no hay suficientes laboratorios evaluados para analizar la evolución.',
    goals: gaps.slice(0, 5).map((g) => ({
      competency: g.name, currentLevel: g.level,
      objective: `Alcanzar al menos nivel Avanzado (≥ 4,0) en ${g.name}.`,
      actions: ['Revisar la retroalimentación de los laboratorios donde se evaluó esta competencia.', 'Desarrollar un ejercicio práctico adicional y documentarlo.', 'Solicitar retroalimentación docente sobre el avance.'],
      resources: ['Material del curso', 'Documentación oficial de las librerías usadas'],
      timeframe: '2 a 4 semanas', indicator: 'Mejora de la valoración en el siguiente laboratorio relacionado.',
    })),
  };
}
