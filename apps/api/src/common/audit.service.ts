import { Global, Inject, Injectable, Module } from '@nestjs/common';
import { DB, DB_TOKEN } from '../db/db.module';
import { auditLogs } from '../db/schema';

@Injectable()
export class AuditService {
  constructor(@Inject(DB_TOKEN) private db: DB) {}
  async log(userId: string | null | undefined, action: string, entity: string, entityId?: string, details: Record<string, unknown> = {}) {
    try {
      await this.db.insert(auditLogs).values({ userId: userId ?? null, action, entity, entityId, details });
    } catch (e) {
      console.error('audit log failed', e);
    }
  }
}

@Global()
@Module({ providers: [AuditService], exports: [AuditService] })
export class AuditModule {}
