import { BadRequestException, Body, Controller, ForbiddenException, Get, Inject, NotFoundException, Param, Post, Query, HttpCode } from '@nestjs/common';
import { z } from 'zod';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { DB, DB_TOKEN } from '../db/db.module';
import { evaluations, files, labs, rubricVersions, submissions, users } from '../db/schema';
import { AuthUser, CurrentUser, Roles, isStaff, parse } from '../common/auth';
import { AuditService } from '../common/audit.service';
import { loadSubmissionFor } from '../common/access';
import { EvaluationEngine } from './engine.service';
import { RubricContent, computeGrade } from '../rubrics/rubric';
import { PROMPT_VERSION } from './eval.schema';
import { SettingsService } from '../settings/settings.service';

const reviewSchema = z.object({
  levels: z.record(z.string(), z.string()).default({}),
  justifications: z.record(z.string(), z.string()).default({}),
  feedback: z.string().max(8000).optional(),
  teacherComment: z.string().max(4000).optional(),
});

@Controller()
export class EvaluationsController {
  constructor(@Inject(DB_TOKEN) private db: DB, private engine: EvaluationEngine, private audit: AuditService, private settings: SettingsService) {}

  @Post('submissions/:id/evaluate')
  async evaluate(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const s = await loadSubmissionFor(this.db, user, id);
    if (!isStaff(user) && !(await this.settings.policy()).studentsCanEvaluate) throw new ForbiddenException('Solo el docente puede solicitar evaluaciones');
    const running = await this.db.select({ id: evaluations.id }).from(evaluations)
      .where(and(eq(evaluations.submissionId, id), inArray(evaluations.status, ['QUEUED', 'RUNNING'])));
    if (running.length) throw new BadRequestException('Ya hay una evaluación en curso para esta entrega');
    const [rv] = await this.db.select().from(rubricVersions).where(eq(rubricVersions.id, s.rubricVersionId));
    const fl = await this.db.select({ id: files.id, filename: files.filename, kind: files.kind, sha256: files.sha256, meta: files.meta }).from(files).where(eq(files.submissionId, id));
    const cfg = await this.settings.ai();
    const [ev] = await this.db.insert(evaluations).values({
      submissionId: id, rubricVersionId: rv.id, rubricSnapshot: rv.content, provider: cfg.provider, model: cfg.model,
      promptVersion: PROMPT_VERSION, status: 'QUEUED', evidenceManifest: fl, requestedBy: user.id,
    }).returning({ id: evaluations.id, status: evaluations.status });
    await this.audit.log(user.id, 'EVALUATION_REQUEST', 'evaluation', ev.id, { submissionId: id, provider: cfg.provider, model: cfg.model, rubricVersion: rv.version });
    this.engine.enqueue(ev.id);
    return ev;
  }

  @Get('evaluations')
  @Roles('ADMIN', 'TEACHER')
  list(@Query('status') status?: string) {
    const st = status ? parse(z.enum(['QUEUED', 'RUNNING', 'FAILED', 'PENDING_REVIEW', 'APPROVED', 'PUBLISHED']), status) : undefined;
    return this.db.select({
      id: evaluations.id, status: evaluations.status, preliminaryGrade: evaluations.preliminaryGrade, finalGrade: evaluations.finalGrade,
      provider: evaluations.provider, model: evaluations.model, createdAt: evaluations.createdAt, submissionId: evaluations.submissionId,
      studentName: users.name, studentId: users.id, labTitle: labs.title,
    }).from(evaluations)
      .innerJoin(submissions, eq(submissions.id, evaluations.submissionId))
      .innerJoin(users, eq(users.id, submissions.studentId))
      .innerJoin(labs, eq(labs.id, submissions.labId))
      .where(st ? eq(evaluations.status, st) : undefined)
      .orderBy(desc(evaluations.createdAt)).limit(300);
  }

  private async load(user: AuthUser, id: string) {
    const [ev] = await this.db.select().from(evaluations).where(eq(evaluations.id, id));
    if (!ev) throw new NotFoundException('Evaluación no encontrada');
    const sub = await loadSubmissionFor(this.db, user, ev.submissionId);
    return { ev, sub };
  }

  @Get('evaluations/:id')
  async get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const { ev, sub } = await this.load(user, id);
    const policy = await this.settings.policy();
    if (!isStaff(user) && ev.status !== 'PUBLISHED' && !(policy.studentsSeePreliminary && ['PENDING_REVIEW', 'APPROVED'].includes(ev.status))) {
      return { id: ev.id, status: ev.status, createdAt: ev.createdAt, error: ev.status === 'FAILED' ? 'La evaluación no pudo completarse' : null, hidden: true,
        message: 'La valoración está pendiente de revisión y aprobación docente.' };
    }
    const [lab] = await this.db.select().from(labs).where(eq(labs.id, sub.labId));
    const [student] = await this.db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, sub.studentId));
    const [rv] = await this.db.select({ version: rubricVersions.version }).from(rubricVersions).where(eq(rubricVersions.id, ev.rubricVersionId));
    const reviewer = ev.reviewedBy ? (await this.db.select({ name: users.name }).from(users).where(eq(users.id, ev.reviewedBy)))[0] : null;
    return { ...ev, lab: { id: lab.id, title: lab.title }, student, rubricVersion: rv?.version, reviewer: reviewer?.name ?? null, hidden: false };
  }

  @Post('evaluations/:id/review')
  @Roles('ADMIN', 'TEACHER')
  @HttpCode(200)
  async review(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    const { ev } = await this.load(user, id);
    if (!['PENDING_REVIEW', 'APPROVED'].includes(ev.status)) throw new BadRequestException('Solo se pueden ajustar evaluaciones pendientes de revisión');
    const d = parse(reviewSchema, body);
    const rubric = ev.rubricSnapshot as RubricContent;
    for (const [cid, lid] of Object.entries(d.levels)) {
      const c = rubric.criteria.find((k) => k.id === cid);
      if (!c || !c.levels.some((l) => l.id === lid)) throw new BadRequestException(`Nivel inválido para el criterio ${cid}`);
    }
    const ai = (ev.aiOutput as any) || { criteria: [] };
    const chosen: Record<string, string> = Object.fromEntries(ai.criteria.map((c: any) => [c.criterionId, c.levelId]));
    const levels = { ...chosen, ...d.levels };
    const { rows, grade } = computeGrade(rubric, levels);
    const overrides = { levels: d.levels, justifications: d.justifications, feedback: d.feedback };
    await this.db.update(evaluations).set({
      teacherOverrides: overrides, teacherComment: d.teacherComment ?? ev.teacherComment, criteriaResults: rows, finalGrade: grade,
      reviewedBy: user.id, reviewedAt: new Date(), status: 'PENDING_REVIEW',
    }).where(eq(evaluations.id, id));
    const changed = Object.entries(d.levels).filter(([k, v]) => chosen[k] !== v).map(([k, v]) => ({ criterionId: k, from: chosen[k], to: v }));
    await this.audit.log(user.id, 'EVALUATION_REVIEW', 'evaluation', id, { changed, preliminaryGrade: ev.preliminaryGrade, adjustedGrade: grade });
    return { finalGrade: grade, criteriaResults: rows };
  }

  @Post('evaluations/:id/approve')
  @Roles('ADMIN', 'TEACHER')
  @HttpCode(200)
  async approve(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: { publish?: boolean }) {
    const { ev } = await this.load(user, id);
    if (!['PENDING_REVIEW', 'APPROVED'].includes(ev.status)) throw new BadRequestException('La evaluación no está lista para aprobarse');
    const finalGrade = ev.finalGrade ?? ev.preliminaryGrade;
    const publish = !!body?.publish;
    await this.db.update(evaluations).set({
      status: publish ? 'PUBLISHED' : 'APPROVED', finalGrade, reviewedBy: user.id, reviewedAt: ev.reviewedAt ?? new Date(),
      publishedAt: publish ? new Date() : null,
    }).where(eq(evaluations.id, id));
    // Una sola evaluación publicada por entrega: las anteriores se archivan como aprobadas
    if (publish) {
      const others = await this.db.select({ id: evaluations.id }).from(evaluations)
        .where(and(eq(evaluations.submissionId, ev.submissionId), eq(evaluations.status, 'PUBLISHED')));
      for (const o of others.filter((o) => o.id !== id)) await this.db.update(evaluations).set({ status: 'APPROVED', publishedAt: null }).where(eq(evaluations.id, o.id));
    }
    await this.audit.log(user.id, publish ? 'EVALUATION_PUBLISH' : 'EVALUATION_APPROVE', 'evaluation', id, { finalGrade });
    return { ok: true, status: publish ? 'PUBLISHED' : 'APPROVED', finalGrade };
  }

  @Post('evaluations/:id/reopen')
  @Roles('ADMIN', 'TEACHER')
  @HttpCode(200)
  async reopen(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const { ev } = await this.load(user, id);
    if (!['APPROVED', 'PUBLISHED'].includes(ev.status)) throw new BadRequestException('Solo se reabren evaluaciones aprobadas o publicadas');
    await this.db.update(evaluations).set({ status: 'PENDING_REVIEW', publishedAt: null }).where(eq(evaluations.id, id));
    await this.audit.log(user.id, 'EVALUATION_REOPEN', 'evaluation', id);
    return { ok: true };
  }

  @Post('evaluations/:id/retry')
  @Roles('ADMIN', 'TEACHER')
  @HttpCode(200)
  async retry(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const { ev } = await this.load(user, id);
    if (ev.status !== 'FAILED') throw new BadRequestException('Solo se reintentan evaluaciones fallidas');
    const cfg = await this.settings.ai();
    await this.db.update(evaluations).set({ status: 'QUEUED', error: null, provider: cfg.provider, model: cfg.model }).where(eq(evaluations.id, id));
    this.engine.enqueue(id);
    await this.audit.log(user.id, 'EVALUATION_RETRY', 'evaluation', id);
    return { ok: true };
  }

  /** Expediente completo de trazabilidad (JSON descargable). */
  @Get('evaluations/:id/trace')
  @Roles('ADMIN', 'TEACHER')
  async trace(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const full = await this.get(user, id);
    return { exportedAt: new Date().toISOString(), exportedBy: user.email, evaluation: full };
  }
}
