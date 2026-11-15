import {
  CanActivate, ExecutionContext, Injectable, SetMetadata, UnauthorizedException, ForbiddenException,
  createParamDecorator, BadRequestException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ZodType } from 'zod';

export type Role = 'ADMIN' | 'TEACHER' | 'STUDENT';
export interface AuthUser { id: string; email: string; name: string; role: Role }

export const PUBLIC_KEY = 'isPublic';
export const ROLES_KEY = 'roles';
export const Public = () => SetMetadata(PUBLIC_KEY, true);
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest().user;
});

export const isStaff = (u: AuthUser) => u.role === 'ADMIN' || u.role === 'TEACHER';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private jwt: JwtService, private reflector: Reflector) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [ctx.getHandler(), ctx.getClass()]);
    const req = ctx.switchToHttp().getRequest();
    const header: string | undefined = req.headers.authorization;
    const token = req.cookies?.token || (header?.startsWith('Bearer ') ? header.slice(7) : undefined);
    if (token) {
      try {
        const p = await this.jwt.verifyAsync(token);
        req.user = { id: p.sub, email: p.email, name: p.name, role: p.role } satisfies AuthUser;
      } catch { /* token inválido */ }
    }
    if (isPublic) return true;
    if (!req.user) throw new UnauthorizedException('Sesión no válida o expirada');
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (roles && !roles.includes(req.user.role)) throw new ForbiddenException('No tienes permisos para esta acción');
    return true;
  }
}

/** Valida un cuerpo con Zod y devuelve errores legibles en español. */
export function parse<T>(schema: ZodType<T>, data: unknown): T {
  const r = schema.safeParse(data);
  if (!r.success) {
    throw new BadRequestException({
      message: 'Datos inválidos',
      errors: r.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }
  return r.data;
}
