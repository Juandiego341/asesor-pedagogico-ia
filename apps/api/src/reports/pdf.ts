import PDFDocument from 'pdfkit';

const C = { ink: '#1f2933', muted: '#61707d', line: '#d9dee3', accent: '#1d4ed8', good: '#15803d', mid: '#b45309', bad: '#b91c1c' };
const colorFor = (s: number | null) => (s === null ? C.muted : s >= 4 ? C.good : s >= 3 ? C.mid : C.bad);
const fmt = (n: number | null | undefined) => (n === null || n === undefined ? '—' : n.toFixed(1).replace('.', ','));

export function reportPdf(r: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 54, info: { Title: `Informe integrado del aprendizaje - ${r.student.name}`, Author: 'Asesor Pedagógico Inteligente' } });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject);
    const W = doc.page.width - 108;
    const h1 = (t: string) => { ensure(60); doc.moveDown(0.8).fillColor(C.accent).font('Helvetica-Bold').fontSize(14).text(t); doc.moveTo(54, doc.y + 2).lineTo(54 + W, doc.y + 2).strokeColor(C.line).stroke(); doc.moveDown(0.5).fillColor(C.ink).font('Helvetica').fontSize(10); };
    const p = (t: string, o: PDFKit.Mixins.TextOptions = {}) => { ensure(30); doc.fillColor(C.ink).font('Helvetica').fontSize(10).text(t, o); };
    const bullet = (t: string) => { ensure(24); doc.fillColor(C.ink).font('Helvetica').fontSize(10).text(`•  ${t}`, { indent: 8 }); };
    const ensure = (h: number) => { if (doc.y + h > doc.page.height - 60) doc.addPage(); };

    doc.fillColor(C.muted).fontSize(9).text('Universidad de Manizales · Inteligencia Artificial · cortes 1 y 2');
    doc.moveDown(0.3).fillColor(C.ink).font('Helvetica-Bold').fontSize(20).text('Informe integrado del aprendizaje');
    doc.font('Helvetica').fontSize(11).fillColor(C.ink).text(`${r.student.name}${r.student.studentCode ? ` · Código ${r.student.studentCode}` : ''}`);
    doc.fontSize(9).fillColor(C.muted).text(`Generado el ${new Date(r.generatedAt).toLocaleString('es-CO', { timeZone: 'America/Bogota' })}${r.includeUnpublished ? ' · Incluye valoraciones aún no publicadas' : ' · Solo valoraciones publicadas por el docente'}`);

    h1('1. Resumen del desempeño');
    const s = r.summary;
    p(`Laboratorios evaluados: ${s.labsEvaluated} de ${s.labsTotal}   ·   Promedio general: ${fmt(s.average)}   ·   Tendencia: ${s.trendLabel}`);
    if (s.best) p(`Mejor resultado: ${s.best.title} (${fmt(s.best.grade)})${s.worst && s.worst.labId !== s.best.labId ? `   ·   Menor resultado: ${s.worst.title} (${fmt(s.worst.grade)})` : ''}`);
    r.byCohort.forEach((c: any) => p(`${c.name}: promedio ${fmt(c.average)} (${c.evaluated}/${c.total} laboratorios)`));

    h1('2. Valoraciones por laboratorio');
    const cols = [W * 0.12, W * 0.58, W * 0.15, W * 0.15];
    const row = (cells: string[], bold = false, color = C.ink) => {
      ensure(20); const y = doc.y; let x = 54;
      cells.forEach((c, i) => { doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9.5).fillColor(i === 2 && !bold ? color : C.ink).text(c, x + 2, y, { width: cols[i] - 4 }); x += cols[i]; });
      doc.y = Math.max(doc.y, y + 14); doc.moveTo(54, doc.y + 1).lineTo(54 + W, doc.y + 1).strokeColor(C.line).stroke(); doc.y += 4;
    };
    row(['corte', 'Laboratorio', 'Nota', 'Estado'], true);
    r.labs.forEach((l: any) => row([String(l.cohort), l.title, fmt(l.grade), l.status ? ({ PUBLISHED: 'Publicada', APPROVED: 'Aprobada', PENDING_REVIEW: 'En revisión' } as any)[l.status] ?? l.status : 'Sin evaluar'], false, colorFor(l.grade)));
    doc.x = 54;

    h1('3. Competencias desarrolladas y nivel de dominio');
    r.competencies.forEach((c: any) => {
      ensure(30);
      const y = doc.y;
      doc.font('Helvetica-Bold').fontSize(10).fillColor(C.ink).text(c.name, 54, y, { width: W * 0.5 });
      const bx = 54 + W * 0.52, bw = W * 0.3;
      doc.rect(bx, y + 2, bw, 8).fillColor('#eef1f4').fill();
      doc.rect(bx, y + 2, bw * Math.max(0, Math.min(1, (c.score ?? 0) / 5)), 8).fillColor(colorFor(c.score)).fill();
      doc.font('Helvetica').fontSize(9).fillColor(C.ink).text(`${fmt(c.score)} · ${c.level}`, bx + bw + 6, y, { width: W * 0.18 });
      doc.x = 54; doc.y = Math.max(doc.y, y + 14);
      doc.fontSize(8.5).fillColor(C.muted).text(`Evidenciada en: ${c.labs.join(', ')}`, 54); doc.moveDown(0.3);
    });
    if (!r.competencies.length) p('Aún no hay valoraciones para consolidar competencias.');

    h1('4. Conocimientos adquiridos y aplicados');
    r.learned.slice(0, 15).forEach((l: any) => bullet(`${l.text} (${l.labs.join(', ')})`));
    if (!r.learned.length) p('Sin información suficiente.');

    h1('5. Brechas y oportunidades de fortalecimiento');
    r.gaps.forEach((g: any) => bullet(`${g.competency}: ${fmt(g.score)} (${g.level}) — ${g.labs.join(', ')}`));
    r.toStrengthen.slice(0, 12).forEach((t: any) => bullet(`${t.text} (${t.labs.join(', ')})`));
    if (!r.gaps.length && !r.toStrengthen.length) p('No se identificaron brechas significativas.');

    h1('6. Plan personalizado de fortalecimiento');
    if (r.plan) {
      p(r.plan.summary); doc.moveDown(0.3); p(r.plan.evolution); doc.moveDown(0.4);
      r.plan.goals.forEach((g: any, i: number) => {
        ensure(60);
        doc.font('Helvetica-Bold').fontSize(10).fillColor(C.ink).text(`${i + 1}. ${g.competency} (${g.currentLevel})`);
        p(`Objetivo: ${g.objective}`);
        g.actions.forEach((a: string) => bullet(a));
        p(`Recursos: ${g.resources.join('; ')}`); p(`Plazo: ${g.timeframe}   ·   Indicador: ${g.indicator}`); doc.moveDown(0.4);
      });
    } else {
      p('Aún no se ha generado el plan. Se puede generar desde la plataforma.');
      r.recommendations.slice(0, 8).forEach((x: any) => bullet(`[${x.priority}] ${x.title}: ${x.detail} (${x.lab})`));
    }

    doc.moveDown(1).fontSize(8).fillColor(C.muted).text('Las valoraciones se generan con apoyo de modelos de IA a partir de las evidencias entregadas; la nota se calcula con las ponderaciones de cada rúbrica y es validada por el docente.', 54, undefined, { width: W });
    doc.end();
  });
}
