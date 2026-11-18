import { Body, Controller, Delete, Get, Inject, NotFoundException, Param, Patch, Post, ConflictException } from '@nestjs/common';
import { z } from 'zod';
import { asc, desc, eq } from 'drizzle-orm';
import { DB, DB_TOKEN } from '../db/db.module';
import { cohorts, labs, rubricVersions, submissions } from '../db/schema';
import { AuthUser, CurrentUser, Roles, parse } from '../common/auth';
import { AuditService } from '../common/audit.service';

const labSchema = z.object({
  cohortId: z.number().int(),
  order: z.number().int().min(1).default(1),
  title: z.string().min(3).max(200),
  description: z.string().min(10, 'Describe el laboratorio (mínimo 10 caracteres)'),
  objectives: z.string().default(''),
  topics: z.array(z.string().min(1)).default([]),
  requiresCode: z.boolean().default(true),
});

@Controller()
export class LabsController {
  constructor(@Inject(DB_TOKEN) private db: DB, private audit: AuditService) {}

  @Get('cohorts')
  async cohorts() {
    const cs = await this.db.select().from(cohorts).orderBy(asc(cohorts.number));
    const ls = await this.db.select().from(labs).orderBy(asc(labs.order));
    const rv = await this.db.select({ labId: rubricVersions.labId, status: rubricVersions.status, version: rubricVersions.version, id: rubricVersions.id }).from(rubricVersions).orderBy(desc(rubricVersions.version));
    return cs.map((c) => ({
      ...c,
      labs: ls.filter((l) => l.cohortId === c.id).map((l) => ({
        ...l,
        publishedRubric: rv.find((r) => r.labId === l.id && r.status === 'PUBLISHED') ?? null,
        draftRubric: rv.find((r) => r.labId === l.id && r.status === 'DRAFT') ?? null,
      })),
    }));
  }

  @Post('cohorts')
  @Roles('ADMIN')
  async createCohort(@Body() body: unknown) {
    const d = parse(z.object({ number: z.number().int().min(1), name: z.string().min(2), period: z.string().optional() }), body);
    const [c] = await this.db.insert(cohorts).values(d).onConflictDoNothing().returning();
    if (!c) throw new ConflictException('Ya existe esa corte');
    return c;
  }

  @Get('labs/:id')
  async get(@Param('id') id: string) {
    const [l] = await this.db.select().from(labs).where(eq(labs.id, id));
    if (!l) throw new NotFoundException('Laboratorio no encontrado');
    const [c] = await this.db.select().from(cohorts).where(eq(cohorts.id, l.cohortId));
    return { ...l, cohort: c };
  }

  @Post('labs')
  @Roles('ADMIN', 'TEACHER')
  async create(@CurrentUser() u: AuthUser, @Body() body: unknown) {
    const d = parse(labSchema, body);
    const [l] = await this.db.insert(labs).values(d).returning();
    await this.audit.log(u.id, 'LAB_CREATE', 'lab', l.id, { title: l.title });
    return l;
  }

  @Patch('labs/:id')
  @Roles('ADMIN', 'TEACHER')
  async update(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    const d = parse(labSchema.partial(), body);
    const [l] = await this.db.update(labs).set(d).where(eq(labs.id, id)).returning();
    if (!l) throw new NotFoundException('Laboratorio no encontrado');
    await this.audit.log(u.id, 'LAB_UPDATE', 'lab', id, { fields: Object.keys(d) });
    return l;
  }

  @Delete('labs/:id')
  @Roles('ADMIN', 'TEACHER')
  async remove(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const subs = await this.db.select({ id: submissions.id }).from(submissions).where(eq(submissions.labId, id)).limit(1);
    if (subs.length) throw new ConflictException('El laboratorio tiene entregas registradas; no puede eliminarse');
    await this.db.delete(labs).where(eq(labs.id, id));
    await this.audit.log(u.id, 'LAB_DELETE', 'lab', id);
    return { ok: true };
  }
}
