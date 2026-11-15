import { Injectable } from '@nestjs/common';
import { ZodType } from 'zod';
import { AiConfig, callProvider, ImageInput, toJsonSchema } from './providers';
import { SettingsService } from '../settings/settings.service';

export interface AiRunResult<T> { data: T; provider: string; model: string; usage?: Record<string, number>; attempts: number; validationErrors: string[] }

@Injectable()
export class AiService {
  constructor(private settings: SettingsService) {}

  config() { return this.settings.ai(); }

  /**
   * Ejecuta una tarea con salida estructurada. La respuesta se valida con Zod (JSON Schema);
   * si no cumple, se reintenta indicando los errores al modelo. El modo demo usa una heurística local.
   */
  async run<T>(opts: { schema: ZodType<T>; schemaName: string; system: string; prompt: string; images?: ImageInput[]; demo: () => T; cfg?: AiConfig }): Promise<AiRunResult<T>> {
    const cfg = opts.cfg ?? (await this.config());
    if (cfg.provider === 'demo') {
      const data = opts.schema.parse(opts.demo());
      return { data, provider: 'demo', model: cfg.model, attempts: 1, validationErrors: [] };
    }
    const jsonSchema = toJsonSchema(opts.schema);
    const errors: string[] = [];
    let prompt = opts.prompt;
    for (let attempt = 1; attempt <= 3; attempt++) {
      let raw: unknown; let usage: Record<string, number> | undefined; let model = cfg.model;
      try {
        const r = await callProvider(cfg, { system: opts.system, prompt, jsonSchema, schemaName: opts.schemaName, images: opts.images });
        raw = r.raw; usage = r.usage; model = r.model;
      } catch (e) {
        errors.push(`Intento ${attempt}: ${(e as Error).message}`);
        if (attempt === 3 || /Falta|401|403|404/.test((e as Error).message)) throw new Error(errors.join(' | '));
        await new Promise((res) => setTimeout(res, 1500 * attempt));
        continue;
      }
      const parsed = opts.schema.safeParse(raw);
      if (parsed.success) return { data: parsed.data, provider: cfg.provider, model, usage, attempts: attempt, validationErrors: errors };
      const issues = parsed.error.issues.slice(0, 15).map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      errors.push(`Intento ${attempt}: salida inválida (${issues})`);
      prompt = `${opts.prompt}\n\nATENCIÓN: tu respuesta anterior no cumplía el esquema JSON. Errores: ${issues}. Devuelve un JSON que cumpla exactamente el esquema.`;
    }
    throw new Error('El modelo no produjo una salida válida: ' + errors.join(' | '));
  }
}
