import { Controller, Get, Inject, Param, Post, Query, Res, HttpCode } from '@nestjs/common';
import type { Response } from 'express';
import { DB, DB_TOKEN } from '../db/db.module';
import { learningPlans } from '../db/schema';
import { AuthUser, CurrentUser, isStaff } from '../common/auth';
import { assertStudentScope } from '../common/access';
import { ReportsService } from './reports.service';
import { reportPdf } from './pdf';
import { AiService } from '../ai/ai.service';
import { demoPlan } from '../evaluations/demo';
import { learningPlanSchema, LearningPlan } from '../evaluations/eval.schema';
import { AuditService } from '../common/audit.service';

@Controller()
export class ReportsController {
  constructor(@Inject(DB_TOKEN) private db: DB, private reports: ReportsService, private ai: AiService, private audit: AuditService) {}

  private include(user: AuthUser, q?: string) { return isStaff(user) && q === 'true'; }

  @Get('reports/student/:id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query('includeUnpublished') inc?: string) {
    assertStudentScope(user, id);
    return this.reports.report(id, this.include(user, inc));
  }

  @Get('reports/student/:id/pdf')
  async pdf(@CurrentUser() user: AuthUser, @Param('id') id: string, @Res() res: Response, @Query('includeUnpublished') inc?: string) {
    assertStudentScope(user, id);
    const r = await this.reports.report(id, this.include(user, inc));
    const buf = await reportPdf(r);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="informe-aprendizaje-${r.student.name.replace(/[^\w]+/g, '_')}.pdf"`);
    res.send(buf);
  }

  @Post('reports/student/:id/plan')
  @HttpCode(200)
  async plan(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query('includeUnpublished') inc?: string) {
    assertStudentScope(user, id);
    const r = await this.reports.report(id, this.include(user, inc));
    const input = {
      competencias: r.competencies.map((c) => ({ nombre: c.name, valor: c.score, nivel: c.level, laboratorios: c.labs })),
      laboratorios: r.labs.map((l) => ({ corte: l.cohort, titulo: l.title, nota: l.grade })),
      porFortalecer: r.toStrengthen.map((t) => t.text), recomendaciones: r.recommendations.map((x) => `${x.title}: ${x.detail}`),
      criteriosBajos: r.lowCriteria,
    };
    const res = await this.ai.run<LearningPlan>({
      schema: learningPlanSchema, schemaName: 'plan_fortalecimiento',
      system: 'Eres un asesor pedagógico experto en Inteligencia Artificial. Diseñas planes de fortalecimiento personalizados, concretos y verificables, en español, a partir de resultados de evaluación por competencias. No inventes resultados que no estén en los datos.',
      prompt: `Resultados consolidados del estudiante (cortes 1 y 2):\n${JSON.stringify(input, null, 1)}\n\nGenera: síntesis del desempeño, análisis de la evolución entre laboratorios y cortes, y metas de fortalecimiento priorizadas (máximo 6) para las competencias con menor dominio.`,
      demo: () => demoPlan({ competencies: r.competencies, labs: r.labs.map((l) => ({ title: l.title, grade: l.grade })) }),
    });
    await this.db.insert(learningPlans).values({ studentId: id, content: res.data, provider: res.provider, model: res.model, basedOn: r.labs.filter((l) => l.evaluationId).map((l) => l.evaluationId) });
    await this.audit.log(user.id, 'PLAN_GENERATE', 'student', id, { provider: res.provider, model: res.model });
    return { ...res.data, provider: res.provider, model: res.model };
  }

  @Get('mindmap/student/:id')
  mindmap(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query('includeUnpublished') inc?: string) {
    assertStudentScope(user, id);
    return this.reports.mindmap(id, this.include(user, inc));
  }
}
