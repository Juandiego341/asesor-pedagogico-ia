import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { z } from 'zod';
import { asc, eq } from 'drizzle-orm';
import { DB, DB_TOKEN } from '../db/db.module';
import { users } from '../db/schema';
import { AuthUser, CurrentUser, Roles, parse } from '../common/auth';
import { AuditService } from '../common/audit.service';

const roleSchema = z.enum(['ADMIN', 'TEACHER', 'STUDENT']);
const createSchema = z.object({
  email: z.email('Correo inválido'),
  name: z.string().min(3).max(120),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  role: roleSchema,
  studentCode: z.string().max(40).optional(),
});
const updateSchema = z.object({
  name: z.string().min(3).max(120).optional(),
  role: roleSchema.optional(),
  active: z.boolean().optional(),
  studentCode: z.string().max(40).nullable().optional(),
  password: z.string().min(8).optional(),
});

const publicCols = {
  id: users.id, email: users.email, name: users.name, role: users.role,
  studentCode: users.studentCode, active: users.active, createdAt: users.createdAt,
};

@Controller('users')
export class UsersController {
  constructor(@Inject(DB_TOKEN) private db: DB, private audit: AuditService) {}

  @Get()
  @Roles('ADMIN', 'TEACHER')
  list(@Query('role') role?: string) {
    const q = this.db.select(publicCols).from(users).orderBy(asc(users.name));
    if (role) return q.where(eq(users.role, parse(roleSchema, role)));
    return q;
  }

  @Post()
  @Roles('ADMIN')
  async create(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const d = parse(createSchema, body);
    const email = d.email.toLowerCase();
    const [exists] = await this.db.select({ id: users.id }).from(users).where(eq(users.email, email));
    if (exists) throw new ConflictException('Ya existe un usuario con ese correo');
    const [u] = await this.db.insert(users).values({
      email, name: d.name, role: d.role, studentCode: d.studentCode, passwordHash: await bcrypt.hash(d.password, 10),
    }).returning(publicCols);
    await this.audit.log(me.id, 'USER_CREATE', 'user', u.id, { role: d.role });
    return u;
  }

  @Patch(':id')
  @Roles('ADMIN')
  async update(@CurrentUser() me: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    const d = parse(updateSchema, body);
    if (id === me.id && (d.role && d.role !== 'ADMIN' || d.active === false)) {
      throw new BadRequestException('No puedes quitarte el rol de administrador ni desactivarte');
    }
    const { password, ...rest } = d;
    const patch: Partial<typeof users.$inferInsert> = { ...rest };
    if (password) patch.passwordHash = await bcrypt.hash(password, 10);
    const [u] = await this.db.update(users).set(patch).where(eq(users.id, id)).returning(publicCols);
    if (!u) throw new NotFoundException('Usuario no encontrado');
    await this.audit.log(me.id, 'USER_UPDATE', 'user', id, { fields: Object.keys(d) });
    return u;
  }

  @Delete(':id')
  @Roles('ADMIN')
  async remove(@CurrentUser() me: AuthUser, @Param('id') id: string) {
    if (id === me.id) throw new BadRequestException('No puedes eliminar tu propia cuenta');
    const r = await this.db.delete(users).where(eq(users.id, id)).returning({ id: users.id });
    if (!r.length) throw new NotFoundException('Usuario no encontrado');
    await this.audit.log(me.id, 'USER_DELETE', 'user', id);
    return { ok: true };
  }
}
