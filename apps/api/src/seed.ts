import 'reflect-metadata';
import * as bcrypt from 'bcryptjs';
import AdmZip from 'adm-zip';
import PDFDocument from 'pdfkit';
import { count, eq } from 'drizzle-orm';
import { createDb } from './db/db.module';
import { cohorts, evaluations, files, labs, rubricVersions, submissions, teamMembers, users } from './db/schema';
import { LABS, rubricFor } from './seed-data';
import { CODE, REPORTS } from './seed-content';
import { validateRubric } from './rubrics/rubric';
import { extractPdfText, readCodeZip, sha256 } from './evidence/extract';

/** Arranque mínimo: crea el administrador inicial y las cortes si la base está vacía. */
export async function ensureBootstrap() {
  const db = createDb();
  try {
    const [{ n }] = await db.select({ n: count() }).from(users);
    if (n === 0) {
      const email = (process.env.ADMIN_EMAIL || 'admin@asesor.edu.co').toLowerCase();
      const password = process.env.ADMIN_PASSWORD || 'Admin2026!';
      await db.insert(users).values({ email, name: 'Administrador', role: 'ADMIN', passwordHash: await bcrypt.hash(password, 10) });
      console.log(`Administrador inicial creado: ${email}`);
    }
    await db.insert(cohorts).values([{ number: 1, name: 'corte 1', period: '2026-1' }, { number: 2, name: 'corte 2', period: '2026-2' }]).onConflictDoNothing();
    const [{ t }] = await db.select({ t: count() }).from(teamMembers);
    if (t === 0) {
      await db.insert(teamMembers).values([
        { name: 'Integrante 1', role: 'Líder de proyecto y arquitectura', bio: 'Edita este perfil desde Administración → Equipo.', order: 1 },
        { name: 'Integrante 2', role: 'Desarrollo backend e integración de IA', bio: '', order: 2 },
        { name: 'Integrante 3', role: 'Desarrollo frontend y experiencia de usuario', bio: '', order: 3 },
        { name: 'Integrante 4', role: 'Calidad, pruebas y despliegue', bio: '', order: 4 },
      ]);
    }
  } finally {
    await db.$client.end();
  }
}

function pdf(title: string, author: string, paragraphs: string[]): Promise<Buffer> {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 64 });
    const out: Buffer[] = [];
    doc.on('data', (c) => out.push(c)); doc.on('end', () => resolve(Buffer.concat(out)));
    doc.font('Helvetica-Bold').fontSize(16).text(title).moveDown(0.3);
    doc.font('Helvetica').fontSize(10).fillColor('#555').text(`${author} · Universidad de Manizales`).moveDown(1).fillColor('#000');
    paragraphs.forEach((p, i) => {
      if (i === 3) doc.addPage();
      const [h, ...rest] = p.split('. ');
      doc.font('Helvetica-Bold').fontSize(12).text(h).moveDown(0.2);
      doc.font('Helvetica').fontSize(11).text(rest.join('. '), { align: 'justify' }).moveDown(0.8);
    });
    doc.end();
  });
}

function zip(filesMap: Record<string, string>) {
  const z = new AdmZip();
  for (const [p, c] of Object.entries(filesMap)) z.addFile(`entrega/${p}`, Buffer.from(c, 'utf8'));
  return z.toBuffer();
}

export async function demoSeed() {
  await ensureBootstrap();
  const db = createDb();
  const [{ n }] = await db.select({ n: count() }).from(labs);
  if (n > 0) { console.log('Ya existen laboratorios: se omite la carga de datos de ejemplo.'); await db.$client.end(); return []; }
  const pw = await bcrypt.hash(process.env.DEMO_PASSWORD || 'Demo2026!', 10);
  const [teacher] = await db.insert(users).values({ email: 'docente@asesor.edu.co', name: 'Docente Demo', role: 'TEACHER', passwordHash: pw }).onConflictDoNothing().returning();
  const [laura] = await db.insert(users).values({ email: 'laura.gomez@asesor.edu.co', name: 'Laura Gómez', role: 'STUDENT', studentCode: '20231001', passwordHash: pw }).returning();
  const [andres] = await db.insert(users).values({ email: 'andres.restrepo@asesor.edu.co', name: 'Andrés Restrepo', role: 'STUDENT', studentCode: '20231002', passwordHash: pw }).returning();
  const cs = await db.select().from(cohorts);
  const created: { labOrder: number; labId: string; rubricId: string }[] = [];
  for (const l of LABS) {
    const [lab] = await db.insert(labs).values({ cohortId: cs.find((c) => c.number === l.cohort)!.id, order: l.order, title: l.title, description: l.description, objectives: l.objectives, topics: l.topics }).returning();
    const content = rubricFor(l);
    const { issues } = validateRubric(content);
    const [rv] = await db.insert(rubricVersions).values({ labId: lab.id, version: 1, status: 'PUBLISHED', content, issues, extractedBy: 'semilla', publishedAt: new Date(), createdBy: teacher?.id }).returning();
    created.push({ labOrder: l.order, labId: lab.id, rubricId: rv.id });
  }
  const subs: string[] = [];
  const make = async (student: typeof laura, order: number, paragraphs: string[], code: Record<string, string>) => {
    const c = created.find((x) => x.labOrder === order)!;
    const lab = LABS.find((x) => x.order === order)!;
    const report = await pdf(lab.title, student.name, paragraphs);
    const z = zip(code);
    readCodeZip(z);
    const { text, pages } = await extractPdfText(report);
    const [s] = await db.insert(submissions).values({ studentId: student.id, labId: c.labId, rubricVersionId: c.rubricId, createdBy: student.id }).returning();
    await db.insert(files).values([
      { submissionId: s.id, kind: 'REPORT_PDF', filename: `informe-lab${order}.pdf`, mime: 'application/pdf', size: report.length, sha256: sha256(report), data: report, extractedText: text, meta: { pages, chars: text.length } },
      { submissionId: s.id, kind: 'CODE_ZIP', filename: `codigo-lab${order}.zip`, mime: 'application/zip', size: z.length, sha256: sha256(z), data: z, meta: { source: 'zip' } },
    ]);
    subs.push(s.id);
  };
  for (const order of [1, 2, 3, 4, 5, 6]) await make(laura, order, REPORTS[order], CODE[order]);
  for (const order of [1, 2, 4, 5]) {
    const code = { ...CODE[order] };
    if (order === 2) code['pipeline.py'] = code['pipeline.py'].replace('def evaluar(modelo, X, y):', 'def evaluar(modelo, X, y)');
    if (order === 5) delete code['test_rag.py'];
    await make(andres, order, REPORTS[order].slice(0, order === 1 ? 3 : 2).concat('Conclusiones. El laboratorio se completó parcialmente y quedan aspectos por mejorar en el análisis.'), code);
  }
  await db.$client.end();
  console.log(`Datos de ejemplo creados: ${LABS.length} laboratorios, ${subs.length} entregas. Contraseña de cuentas demo: ${process.env.DEMO_PASSWORD || 'Demo2026!'}`);
  return subs;
}

/** Ejecuta `node dist/seed.js --demo [--evaluate]` para cargar datos de ejemplo y evaluarlos con el motor configurado. */
if (require.main === module) {
  (async () => {
    const { runMigrations } = require('./db/migrate');
    await runMigrations();
    if (!process.argv.includes('--demo')) { await ensureBootstrap(); return; }
    const subs = await demoSeed();
    if (process.argv.includes('--evaluate') && subs.length) {
      const { NestFactory } = require('@nestjs/core');
      const { AppModule } = require('./app.module');
      const { EvaluationEngine } = require('./evaluations/engine.service');
      process.env.NODE_ENV = process.env.NODE_ENV || 'development';
      const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
      const engine = app.get(EvaluationEngine);
      const db = createDb();
      const [teacher] = await db.select().from(users).where(eq(users.email, 'docente@asesor.edu.co'));
      for (const [i, id] of subs.entries()) {
        const [s] = await db.select().from(submissions).where(eq(submissions.id, id));
        const [rv] = await db.select().from(rubricVersions).where(eq(rubricVersions.id, s.rubricVersionId));
        const fl = await db.select({ id: files.id, filename: files.filename, kind: files.kind, sha256: files.sha256 }).from(files).where(eq(files.submissionId, id));
        const [ev] = await db.insert(evaluations).values({ submissionId: id, rubricVersionId: rv.id, rubricSnapshot: rv.content, provider: 'demo', model: 'heuristico-v1', promptVersion: 'eval-v1.2', evidenceManifest: fl, requestedBy: teacher.id }).returning();
        await engine.process(ev.id);
        // Las primeras evaluaciones se publican para mostrar el informe; las demás quedan en revisión docente
        if (i < 8) {
          const [done] = await db.select().from(evaluations).where(eq(evaluations.id, ev.id));
          if (done.status === 'PENDING_REVIEW') await db.update(evaluations).set({ status: 'PUBLISHED', finalGrade: done.preliminaryGrade, reviewedBy: teacher.id, reviewedAt: new Date(), publishedAt: new Date() }).where(eq(evaluations.id, ev.id));
        }
        console.log(`Evaluada entrega ${i + 1}/${subs.length}`);
      }
      await db.$client.end();
      await app.close();
    }
  })().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
}
