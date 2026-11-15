import { Body, Controller, Get, Inject, Post, Put, Query, HttpCode } from '@nestjs/common';
import { z } from 'zod';
import { count, desc, eq, sql } from 'drizzle-orm';
import { DB, DB_TOKEN } from '../db/db.module';
import { auditLogs, evaluations, labs, submissions, users } from '../db/schema';
import { AuthUser, CurrentUser, Public, Roles, isStaff, parse } from '../common/auth';
import { SettingsService } from './settings.service';
import { DEFAULT_MODELS, providerKeyStatus } from '../ai/providers';
import { AiService } from '../ai/ai.service';
import { AuditService } from '../common/audit.service';
import { SANDBOX_CAPS, isolationSummary } from '../sandbox/sandbox';

const aiSchema = z.object({
  provider: z.enum(['anthropic', 'openai', 'gemini', 'nvidia', 'ollama', 'demo']),
  model: z.string().min(1),
  baseUrl: z.string().url().optional().or(z.literal('').transform(() => undefined)),
  temperature: z.number().min(0).max(1),
  maxContextChars: z.number().int().min(8000).max(800000),
});
const policySchema = z.object({ studentsSeePreliminary: z.boolean(), studentsCanEvaluate: z.boolean() });

@Controller()
export class SettingsController {
  constructor(@Inject(DB_TOKEN) private db: DB, private settings: SettingsService, private ai: AiService, private audit: AuditService) {}

  @Public() @Get('health')
  async health() {
    await this.db.execute(sql`select 1`);
    return { ok: true, time: new Date().toISOString() };
  }

  @Get('settings')
  async get(@CurrentUser() u: AuthUser) {
    const ai = await this.settings.ai();
    const policy = await this.settings.policy();
    if (!isStaff(u)) return { policy, ai: { provider: ai.provider, model: ai.model } };
    return { ai, policy, keys: providerKeyStatus(), defaults: DEFAULT_MODELS, sandbox: { caps: SANDBOX_CAPS, isolation: isolationSummary() } };
  }

  @Roles('ADMIN') @Put('settings/ai')
  async setAi(@CurrentUser() u: AuthUser, @Body() body: unknown) {
    const d = parse(aiSchema, body);
    await this.settings.set('ai', d);
    await this.audit.log(u.id, 'SETTINGS_AI', 'settings', 'ai', d);
    return d;
  }

  @Roles('ADMIN') @Put('settings/policy')
  async setPolicy(@CurrentUser() u: AuthUser, @Body() body: unknown) {
    const d = parse(policySchema, body);
    await this.settings.set('policy', d);
    await this.audit.log(u.id, 'SETTINGS_POLICY', 'settings', 'policy', d);
    return d;
  }

  @Roles('ADMIN') @Post('settings/ai/test') @HttpCode(200)
  async test(@Body() body: unknown) {
    const cfg = parse(aiSchema, body);
    const started = Date.now();
    try {
      const r = await this.ai.run({
        cfg, schema: z.object({ ok: z.boolean(), mensaje: z.string() }), schemaName: 'prueba',
        system: 'Responde en español.', prompt: 'Confirma que puedes responder en JSON: devuelve ok=true y un mensaje corto.',
        demo: () => ({ ok: true, mensaje: 'Modo demo activo (sin LLM).' }),
      });
      return { ok: true, ms: Date.now() - started, model: r.model, response: r.data };
    } catch (e) {
      return { ok: false, ms: Date.now() - started, error: (e as Error).message };
    }
  }

  @Roles('ADMIN') @Get('audit')
  auditList(@Query('limit') limit = '200') {
    return this.db.select({ id: auditLogs.id, action: auditLogs.action, entity: auditLogs.entity, entityId: auditLogs.entityId, details: auditLogs.details, createdAt: auditLogs.createdAt, user: users.name })
      .from(auditLogs).leftJoin(users, eq(users.id, auditLogs.userId)).orderBy(desc(auditLogs.createdAt)).limit(Math.min(1000, Number(limit) || 200));
  }

  @Roles('ADMIN', 'TEACHER') @Get('stats')
  async stats() {
    const [[st], [lb], [sb], byStatus] = await Promise.all([
      this.db.select({ n: count() }).from(users).where(eq(users.role, 'STUDENT')),
      this.db.select({ n: count() }).from(labs),
      this.db.select({ n: count() }).from(submissions),
      this.db.select({ status: evaluations.status, n: count(), avg: sql<number>`avg(coalesce(${evaluations.finalGrade}, ${evaluations.preliminaryGrade}))` }).from(evaluations).groupBy(evaluations.status),
    ]);
    return { students: st.n, labs: lb.n, submissions: sb.n, evaluations: byStatus };
  }
}
