/** Verificación de citas: comprueba que cada evidencia citada por el modelo exista en el material entregado. */
export const norm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9ñ]+/g, ' ').trim();

export type CitationStatus = 'verificada' | 'parcial' | 'no_encontrada';

export function checkQuote(quote: string, corpusNorm: string): { status: CitationStatus; overlap: number } {
  const q = norm(quote.replace(/\.\.\.|…/g, ' '));
  if (q.length < 8) return { status: 'no_encontrada', overlap: 0 };
  if (corpusNorm.includes(q)) return { status: 'verificada', overlap: 1 };
  // Coincidencia por fragmentos: el modelo a veces une frases u omite palabras
  const words = q.split(' ');
  const n = 5;
  if (words.length < n) return { status: 'no_encontrada', overlap: 0 };
  let hits = 0, total = 0;
  for (let i = 0; i + n <= words.length; i += 2) { total++; if (corpusNorm.includes(words.slice(i, i + n).join(' '))) hits++; }
  const overlap = total ? hits / total : 0;
  return { status: overlap >= 0.8 ? 'verificada' : overlap >= 0.4 ? 'parcial' : 'no_encontrada', overlap: Math.round(overlap * 100) / 100 };
}

export function checkCitations(criteria: { criterionId: string; evidence: { quote: string; source: string; location: string }[] }[], corpus: string) {
  const c = norm(corpus);
  let verified = 0, partial = 0, missing = 0;
  const perCriterion = criteria.map((cr) => {
    const items = cr.evidence.map((e) => {
      const r = e.source === 'verificacion' ? { status: 'verificada' as const, overlap: 1 } : checkQuote(e.quote, c);
      if (r.status === 'verificada') verified++; else if (r.status === 'parcial') partial++; else missing++;
      return { ...e, ...r };
    });
    return { criterionId: cr.criterionId, items, supported: items.some((i) => i.status !== 'no_encontrada') };
  });
  const total = verified + partial + missing;
  return { verified, partial, missing, total, ratio: total ? Math.round(((verified + partial * 0.5) / total) * 100) / 100 : 0, perCriterion };
}
