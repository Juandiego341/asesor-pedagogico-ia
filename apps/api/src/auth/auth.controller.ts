import { Body, Controller, Get, Inject, Post, Res, UnauthorizedException, HttpCode, Req, ForbiddenException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request, Response } from 'express';
import * as bcrypt from 'bcryptjs';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { DB, DB_TOKEN } from '../db/db.module';
import { users } from '../db/schema';
import { AuthUser, CurrentUser, Public, parse } from '../common/auth';
import { AuditService } from '../common/audit.service';

const loginSchema = z.object({ email: z.email('Correo inválido'), password: z.string().min(1) });
const registerSchema = z.object({
  email: z.email('Correo inválido'),
  name: z.string().min(3, 'Nombre muy corto').max(120),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  studentCode: z.string().max(40).optional(),
});
const passwordSchema = z.object({ current: z.string(), next: z.string().min(8, 'Mínimo 8 caracteres') });

// Limitador simple de intentos de inicio de sesión (por IP + correo)
const attempts = new Map<string, { n: number; until: number }>();

export function cookieOptions() {
  const secure = process.env.NODE_ENV === 'production';
  return { httpOnly: true, secure, sameSite: 'lax' as const, path: '/', maxAge: 1000 * 60 * 60 * 12 };
}

@Controller('auth')
export class AuthController {
  constructor(@Inject(DB_TOKEN) private db: DB, private jwt: JwtService, private audit: AuditService) {}

  private async issue(res: Response, u: { id: string; email: string; name: string; role: string }) {
    const token = await this.jwt.signAsync({ sub: u.id, email: u.email, name: u.name, role: u.role });
    res.cookie('token', token, cookieOptions());
    return { user: { id: u.id, email: u.email, name: u.name, role: u.role }, token };
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(@Body() body: unknown, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { email, password } = parse(loginSchema, body);
    const key = `${req.ip}|${email.toLowerCase()}`;
    const a = attempts.get(key);
    if (a && a.n >= 5 && a.until > Date.now()) throw new UnauthorizedException('Demasiados intentos. Espera unos minutos.');
    const [u] = await this.db.select().from(users).where(eq(users.email, email.toLowerCase()));
    if (!u || !u.active || !(await bcrypt.compare(password, u.passwordHash))) {
      const n = (a && a.until > Date.now() ? a.n : 0) + 1;
      attempts.set(key, { n, until: Date.now() + 5 * 60_000 });
      throw new UnauthorizedException('Credenciales incorrectas');
    }
    attempts.delete(key);
    await this.audit.log(u.id, 'LOGIN', 'user', u.id);
    return this.issue(res, u);
  }

  @Public()
  @Post('register')
  async register(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    if (process.env.ALLOW_SIGNUP === 'false') throw new ForbiddenException('El registro está deshabilitado');
    const d = parse(registerSchema, body);
    const email = d.email.toLowerCase();
    const [exists] = await this.db.select({ id: users.id }).from(users).where(eq(users.email, email));
    if (exists) throw new ConflictException('Ya existe una cuenta con ese correo');
    const [u] = await this.db.insert(users).values({
      email, name: d.name, studentCode: d.studentCode, role: 'STUDENT', passwordHash: await bcrypt.hash(d.password, 10),
    }).returning();
    await this.audit.log(u.id, 'REGISTER', 'user', u.id);
    return this.issue(res, u);
  }

  @Public()
  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('token', { ...cookieOptions(), maxAge: undefined });
    return { ok: true };
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return { user };
  }

  @Post('password')
  @HttpCode(200)
  async password(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const d = parse(passwordSchema, body);
    const [u] = await this.db.select().from(users).where(eq(users.id, user.id));
    if (!u || !(await bcrypt.compare(d.current, u.passwordHash))) throw new UnauthorizedException('Contraseña actual incorrecta');
    await this.db.update(users).set({ passwordHash: await bcrypt.hash(d.next, 10) }).where(eq(users.id, user.id));
    await this.audit.log(user.id, 'PASSWORD_CHANGE', 'user', user.id);
    return { ok: true };
  }
}
