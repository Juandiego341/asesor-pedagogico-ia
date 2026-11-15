import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { DbModule } from './db/db.module';
import { AuditModule } from './common/audit.service';
import { AuthGuard } from './common/auth';
import { AllExceptionsFilter } from './common/errors';
import { AuthController } from './auth/auth.controller';
import { UsersController } from './users/users.controller';
import { LabsController } from './labs/labs.controller';
import { RubricsController } from './rubrics/rubrics.controller';
import { SubmissionsController } from './submissions/submissions.controller';
import { EvaluationsController } from './evaluations/evaluations.controller';
import { EvaluationEngine } from './evaluations/engine.service';
import { ReportsController } from './reports/reports.controller';
import { ReportsService } from './reports/reports.service';
import { TeamController } from './team/team.controller';
import { SettingsController } from './settings/settings.controller';
import { SettingsService } from './settings/settings.service';
import { AiService } from './ai/ai.service';

const secret = process.env.JWT_SECRET;
if (!secret && process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET es obligatorio en producción');

@Module({
  imports: [DbModule, AuditModule, JwtModule.register({ global: true, secret: secret || 'dev-secret-cambiar', signOptions: { expiresIn: '12h' } })],
  controllers: [AuthController, UsersController, LabsController, RubricsController, SubmissionsController, EvaluationsController, ReportsController, TeamController, SettingsController],
  providers: [
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    SettingsService, AiService, EvaluationEngine, ReportsService,
  ],
})
export class AppModule {}
