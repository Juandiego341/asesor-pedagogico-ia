import {
  BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Inject, NotFoundException, Param, Post, Query, Res,
  UploadedFiles, UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { z } from 'zod';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { DB, DB_TOKEN } from '../db/db.module';
import { cohorts, evaluations, files, labs, rubricVersions, submissions, users } from '../db/schema';
import { AuthUser, CurrentUser, isStaff, parse } from '../common/auth';
import { AuditService } from '../common/audit.service';
import { assertStudentScope, loadSubmissionFor } from '../common/access';
import { downloadGithub, extractDocxText, extractPdfText, extractPptxText, parseGithubUrl, readCodeZip, sha256 } from '../evidence/extract';

const MAX = 25 * 1024 * 1024;
const bodySchema = z.object({
  labId: z.uuid('Laboratorio inválido'),
  studentId: z.uuid().optional(),
  repoUrl: z.string().trim().optional().transform((v) => v || undefined),
  notes: z.string().max(2000).optional(),
});

type Up = Express.Multer.File;
const fileMeta = { id: files.id, kind: files.kind, filename: files.filename, mime: files.mime, size: files.size, sha256: files.sha256, meta: files.meta, createdAt: files.createdAt, submissionId: files.submissionId };

export async function fileRecord(f: Up, kind: typeof files.$inferInsert['kind']) {
  const rec: typeof files.$inferInsert = { kind, filename: f.originalname, mime: f.mimetype, size: f.size, sha256: sha256(f.buffer), data: f.buffer, meta: {} };
  const name = f.originalname.toLowerCase();
  if (name.endsWith('.pdf')) {
    const { text, pages } = await extractPdfText(f.buffer);
    rec.extractedText = text; rec.meta = { pages, chars: text.length };
  } else if (name.endsWith('.docx')) { rec.extractedText = extractDocxText(f.buffer); }
  else if (name.endsWith('.pptx')) { rec.extractedText = extractPptxText(f.buffer); rec.kind = 'SLIDES'; }
  else if (/\.(txt|md|csv|json)$/.test(name)) { rec.extractedText = f.buffer.toString('utf8'); }
  else if (/\.(png|jpe?g|webp|gif)$/.test(name)) rec.kind = 'IMAGE';
  else if (/\.(mp4|mov|webm|mkv)$/.test(name)) { rec.kind = 'VIDEO'; rec.meta = { note: 'Video almacenado como evidencia complementaria' }; }
  return rec;
}

@Controller()
export class SubmissionsController {
  constructor(@Inject(DB_TOKEN) private db: DB, private audit: AuditService) {}

  @Post('submissions')
  @UseInterceptors(FileFieldsInterceptor([{ name: 'report', maxCount: 1 }, { name: 'code', maxCount: 1 }, { name: 'extras', maxCount: 8 }], { limits: { fileSize: MAX } }))
  async create(@CurrentUser() user: AuthUser, @Body() body: unknown, @UploadedFiles() up: { report?: Up[]; code?: Up[]; extras?: Up[] }) {
    const d = parse(bodySchema, body);
    const studentId = isStaff(user) ? d.studentId : user.id;
    if (!studentId) throw new BadRequestException('Selecciona el estudiante de la entrega');
    if (!isStaff(user) && d.studentId && d.studentId !== user.id) throw new ForbiddenException('Solo puedes registrar tus propias entregas');
    const [student] = await this.db.select().from(users).where(eq(users.id, studentId));
    if (!student || student.role !== 'STUDENT') throw new BadRequestException('El estudiante no existe');
    const [lab] = await this.db.select().from(labs).where(eq(labs.id, d.labId));
    if (!lab) throw new NotFoundException('Laboratorio no encontrado');
    const [rubric] = await this.db.select().from(rubricVersions)
      .where(and(eq(rubricVersions.labId, lab.id), eq(rubricVersions.status, 'PUBLISHED'))).orderBy(desc(rubricVersions.version)).limit(1);
    if (!rubric) throw new BadRequestException('El laboratorio aún no tiene una rúbrica publicada');

    const report = up?.report?.[0];
    if (!report) throw new BadRequestException('Adjunta el informe en PDF');
    if (!report.originalname.toLowerCase().endsWith('.pdf')) throw new BadRequestException('El informe debe ser un archivo PDF');
    const code = up?.code?.[0];
    if (lab.requiresCode && !code && !d.repoUrl) throw new BadRequestException('Adjunta el código fuente en ZIP o indica el repositorio de GitHub');
    if (d.repoUrl && !parseGithubUrl(d.repoUrl)) throw new BadRequestException('El enlace debe ser de un repositorio de GitHub (https://github.com/usuario/repositorio)');

    const records: (typeof files.$inferInsert)[] = [];
    try {
      const r = await fileRecord(report, 'REPORT_PDF');
      if ((r.extractedText?.replace(/\[Página \d+\]/g, '').trim().length ?? 0) < 200) {
        throw new BadRequestException('El PDF no contiene texto legible (¿es una imagen escaneada?). Exporta el informe como PDF de texto.');
      }
      records.push(r);
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      throw new BadRequestException('No se pudo leer el PDF del informe: ' + (e as Error).message);
    }
    if (code) {
      if (!code.originalname.toLowerCase().endsWith('.zip')) throw new BadRequestException('El código debe venir en un archivo .zip');
      try {
        const b = readCodeZip(code.buffer);
        if (!b.files.length) throw new Error('el ZIP no contiene archivos de código analizables');
        records.push({ kind: 'CODE_ZIP', filename: code.originalname, mime: 'application/zip', size: code.size, sha256: sha256(code.buffer), data: code.buffer, meta: { source: 'zip', files: b.files.length, skipped: b.skipped.length } });
      } catch (e) { throw new BadRequestException('ZIP inválido: ' + (e as Error).message); }
    }
    if (d.repoUrl) {
      try {
        const g = await downloadGithub(d.repoUrl);
        const b = readCodeZip(g.data);
        records.push({ kind: 'CODE_ZIP', filename: `${parseGithubUrl(d.repoUrl)!.repo}@${(g.commit || g.ref).slice(0, 10)}.zip`, mime: 'application/zip', size: g.data.length, sha256: sha256(g.data), data: g.data, meta: { source: 'github', url: d.repoUrl, commit: g.commit, ref: g.ref, files: b.files.length } });
      } catch (e) { throw new BadRequestException('No se pudo obtener el repositorio: ' + (e as Error).message); }
    }
    for (const x of up?.extras ?? []) {
      try { records.push(await fileRecord(x, 'OTHER')); } catch (e) { throw new BadRequestException(`No se pudo procesar ${x.originalname}: ${(e as Error).message}`); }
    }

    const sub = await this.db.transaction(async (tx) => {
      const [s] = await tx.insert(submissions).values({ studentId, labId: lab.id, rubricVersionId: rubric.id, repoUrl: d.repoUrl, notes: d.notes, createdBy: user.id }).returning();
      await tx.insert(files).values(records.map((r) => ({ ...r, submissionId: s.id })));
      return s;
    });
    await this.audit.log(user.id, 'SUBMISSION_CREATE', 'submission', sub.id, { labId: lab.id, studentId, rubricVersion: rubric.version, files: records.map((r) => ({ name: r.filename, sha256: r.sha256 })) });
    return sub;
  }

  @Get('submissions')
  async list(@CurrentUser() user: AuthUser, @Query('studentId') studentId?: string, @Query('labId') labId?: string) {
    const conds = [];
    if (!isStaff(user)) conds.push(eq(submissions.studentId, user.id));
    else if (studentId) conds.push(eq(submissions.studentId, studentId));
    if (labId) conds.push(eq(submissions.labId, labId));
    return this.db.select({
      id: submissions.id, createdAt: submissions.createdAt, repoUrl: submissions.repoUrl,
      studentId: submissions.studentId, studentName: users.name, labId: submissions.labId, labTitle: labs.title, rubricVersionId: submissions.rubricVersionId,
    }).from(submissions).innerJoin(users, eq(users.id, submissions.studentId)).innerJoin(labs, eq(labs.id, submissions.labId))
      .where(conds.length ? and(...conds) : undefined).orderBy(desc(submissions.createdAt));
  }

  @Get('submissions/:id')
  async get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const s = await loadSubmissionFor(this.db, user, id);
    const [lab] = await this.db.select().from(labs).where(eq(labs.id, s.labId));
    const [student] = await this.db.select({ id: users.id, name: users.name, email: users.email, studentCode: users.studentCode }).from(users).where(eq(users.id, s.studentId));
    const [rubric] = await this.db.select().from(rubricVersions).where(eq(rubricVersions.id, s.rubricVersionId));
    const fl = await this.db.select(fileMeta).from(files).where(eq(files.submissionId, id)).orderBy(asc(files.createdAt));
    const ev = await this.db.select({
      id: evaluations.id, status: evaluations.status, provider: evaluations.provider, model: evaluations.model,
      preliminaryGrade: evaluations.preliminaryGrade, finalGrade: evaluations.finalGrade, createdAt: evaluations.createdAt, error: evaluations.error,
    }).from(evaluations).where(eq(evaluations.submissionId, id)).orderBy(desc(evaluations.createdAt));
    const visible = isStaff(user) ? ev : ev.map((e) => (e.status === 'PUBLISHED' ? e : { ...e, preliminaryGrade: null, finalGrade: null }));
    return { ...s, lab, student, rubric: { id: rubric.id, version: rubric.version, title: (rubric.content as any).title }, files: fl, evaluations: visible };
  }

  @Delete('submissions/:id')
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const s = await loadSubmissionFor(this.db, user, id);
    const ev = await this.db.select({ status: evaluations.status }).from(evaluations).where(eq(evaluations.submissionId, id));
    if (!isStaff(user) && ev.some((e) => e.status === 'APPROVED' || e.status === 'PUBLISHED')) throw new ForbiddenException('La entrega ya tiene una evaluación aprobada');
    await this.db.delete(submissions).where(eq(submissions.id, s.id));
    await this.audit.log(user.id, 'SUBMISSION_DELETE', 'submission', id);
    return { ok: true };
  }

  @Get('files/:id')
  async download(@CurrentUser() user: AuthUser, @Param('id') id: string, @Res() res: Response) {
    const [f] = await this.db.select().from(files).where(eq(files.id, id));
    if (!f || !f.submissionId) throw new NotFoundException('Archivo no encontrado');
    await loadSubmissionFor(this.db, user, f.submissionId);
    res.setHeader('Content-Type', f.mime || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(f.filename)}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(f.data);
  }

  /** Portafolio académico: cortes → laboratorios → entrega más reciente y estado de evaluación. */
  @Get('portfolio/:studentId')
  async portfolio(@CurrentUser() user: AuthUser, @Param('studentId') studentId: string) {
    assertStudentScope(user, studentId);
    const [student] = await this.db.select({ id: users.id, name: users.name, email: users.email, studentCode: users.studentCode }).from(users).where(eq(users.id, studentId));
    if (!student) throw new NotFoundException('Estudiante no encontrado');
    const cs = await this.db.select().from(cohorts).orderBy(asc(cohorts.number));
    const ls = await this.db.select().from(labs).orderBy(asc(labs.order));
    const subs = await this.db.select().from(submissions).where(eq(submissions.studentId, studentId)).orderBy(desc(submissions.createdAt));
    const evs = subs.length ? await this.db.select({
      id: evaluations.id, submissionId: evaluations.submissionId, status: evaluations.status, preliminaryGrade: evaluations.preliminaryGrade,
      finalGrade: evaluations.finalGrade, createdAt: evaluations.createdAt,
    }).from(evaluations).where(inArray(evaluations.submissionId, subs.map((s) => s.id))).orderBy(desc(evaluations.createdAt)) : [];
    const fl = subs.length ? await this.db.select(fileMeta).from(files).where(inArray(files.submissionId, subs.map((s) => s.id))) : [];
    return {
      student,
      cohorts: cs.map((c) => ({
        ...c,
        labs: ls.filter((l) => l.cohortId === c.id).map((l) => {
          const mine = subs.filter((s) => s.labId === l.id);
          const latest = mine[0];
          const ev = latest ? evs.find((e) => e.submissionId === latest.id) : undefined;
          const showGrade = ev && (isStaff(user) || ev.status === 'PUBLISHED');
          return {
            id: l.id, title: l.title, order: l.order, topics: l.topics,
            submissions: mine.length,
            latest: latest ? {
              id: latest.id, createdAt: latest.createdAt, rubricVersionId: latest.rubricVersionId,
              files: fl.filter((f) => f.submissionId === latest.id),
              evaluation: ev ? { id: ev.id, status: ev.status, grade: showGrade ? (ev.finalGrade ?? ev.preliminaryGrade) : null } : null,
            } : null,
          };
        }),
      })),
    };
  }
}
