import { BadRequestException, Body, Controller, Delete, Get, Inject, NotFoundException, Param, Patch, Post, Put, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { z } from 'zod';
import { asc, eq } from 'drizzle-orm';
import { DB, DB_TOKEN } from '../db/db.module';
import { teamMembers } from '../db/schema';
import { Public, Roles, parse } from '../common/auth';
import { SettingsService } from '../settings/settings.service';

const memberSchema = z.object({ name: z.string().min(2).max(120), role: z.string().min(2).max(120), bio: z.string().max(600).default(''), order: z.number().int().default(0) });
const projectSchema = z.object({
  name: z.string().min(3), abstract: z.string().min(20), objectives: z.array(z.string()), features: z.array(z.string()),
  technologies: z.array(z.string()), contributions: z.array(z.string()),
  aiTools: z.array(z.object({ tool: z.string(), use: z.string(), limits: z.string() })),
});
const cols = { id: teamMembers.id, name: teamMembers.name, role: teamMembers.role, bio: teamMembers.bio, order: teamMembers.order, photoMime: teamMembers.photoMime };

@Controller()
export class TeamController {
  constructor(@Inject(DB_TOKEN) private db: DB, private settings: SettingsService) {}

  @Public() @Get('project')
  async project() {
    const team = await this.db.select(cols).from(teamMembers).orderBy(asc(teamMembers.order));
    return { ...(await this.settings.project()), team: team.map((t) => ({ ...t, hasPhoto: !!t.photoMime })) };
  }

  @Roles('ADMIN') @Put('project')
  async setProject(@Body() body: unknown) {
    const d = parse(projectSchema, body);
    await this.settings.set('project', d);
    return d;
  }

  @Public() @Get('team/:id/photo')
  async photo(@Param('id') id: string, @Res() res: Response) {
    const [m] = await this.db.select().from(teamMembers).where(eq(teamMembers.id, id));
    if (!m?.photo) throw new NotFoundException();
    res.setHeader('Content-Type', m.photoMime!); res.setHeader('Cache-Control', 'public, max-age=300'); res.send(m.photo);
  }

  @Roles('ADMIN') @Post('team')
  async create(@Body() body: unknown) {
    const [m] = await this.db.insert(teamMembers).values(parse(memberSchema, body)).returning(cols);
    return m;
  }

  @Roles('ADMIN') @Patch('team/:id')
  async update(@Param('id') id: string, @Body() body: unknown) {
    const [m] = await this.db.update(teamMembers).set(parse(memberSchema.partial(), body)).where(eq(teamMembers.id, id)).returning(cols);
    if (!m) throw new NotFoundException();
    return m;
  }

  @Roles('ADMIN') @Post('team/:id/photo')
  @UseInterceptors(FileInterceptor('photo', { limits: { fileSize: 3 * 1024 * 1024 } }))
  async upload(@Param('id') id: string, @UploadedFile() file?: Express.Multer.File) {
    if (!file || !/^image\/(png|jpeg|webp)$/.test(file.mimetype)) throw new BadRequestException('Sube una imagen PNG, JPG o WEBP (máx. 3 MB)');
    await this.db.update(teamMembers).set({ photo: file.buffer, photoMime: file.mimetype }).where(eq(teamMembers.id, id));
    return { ok: true };
  }

  @Roles('ADMIN') @Delete('team/:id')
  async remove(@Param('id') id: string) {
    await this.db.delete(teamMembers).where(eq(teamMembers.id, id));
    return { ok: true };
  }
}
