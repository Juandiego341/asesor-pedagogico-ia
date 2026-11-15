import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { DB } from '../db/db.module';
import { submissions } from '../db/schema';
import { AuthUser, isStaff } from './auth';

export async function loadSubmissionFor(db: DB, user: AuthUser, id: string) {
  const [s] = await db.select().from(submissions).where(eq(submissions.id, id));
  if (!s) throw new NotFoundException('Entrega no encontrada');
  if (!isStaff(user) && s.studentId !== user.id) throw new ForbiddenException('No puedes acceder a esta entrega');
  return s;
}

export function assertStudentScope(user: AuthUser, studentId: string) {
  if (!isStaff(user) && user.id !== studentId) throw new ForbiddenException('Solo puedes consultar tu propia información');
}
