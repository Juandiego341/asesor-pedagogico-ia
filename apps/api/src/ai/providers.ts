import { z, ZodType } from 'zod';

export type ProviderId = 'anthropic' | 'openai' | 'gemini' | 'nvidia' | 'ollama' | 'demo';
export interface AiConfig { provider: ProviderId; model: string; baseUrl?: string; temperature: number; maxContextChars: number }
export interface ImageInput { mime: string; base64: string; label: string }
export interface GenerateArgs { system: string; prompt: string; jsonSchema: Record<string, unknown>; schemaName: string; images?: ImageInput[] }
export interface GenerateResult { raw: unknown; usage?: Record<string, number>; model: string }

export const DEFAULT_MODELS: Record<ProviderId, string> = {
  anthropic: 'claude-sonnet-5-5',
  openai: 'gpt-5-mini',
  gemini: 'gemini-3.8-flash',
  nvidia: 'minimaxai/minimax-m3.1-flash',
  ollama: 'qwen2.5:7b',
  demo: 'heuristico-v1',
};

export function providerKeyStatus() {
  return {
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    openai: !!process.env.OPENAI_API_KEY,
    gemini: !!process.env.GEMINI_API_KEY,
    nvidia: !!process.env.NVIDIA_API_KEY,
    ollama: !!(process.env.OLLAMA_BASE_URL),
    demo: true,
  };
}

export function toJsonSchema(schema: ZodType): Record<string, unknown> {
  const js = z.toJSONSchema(schema, { target: 'draft-7', unrepresentable: 'any' }) as Record<string, unknown>;
  delete js.$schema;
  return js;
}

/** Gemini acepta un subconjunto de JSON Schema: se eliminan claves no soportadas. */
function geminiSchema(s: any): any {
  if (Array.isArray(s)) return s.map(geminiSchema);
  if (s && typeof s === 'object') {
    const out: any = {};
    for (const [k, v] of Object.entries(s)) {
      if (['additionalProperties', '$schema', 'default', 'exclusiveMinimum', 'exclusiveMaximum'].includes(k)) continue;
      out[k] = geminiSchema(v);
    }
    return out;
  }
  return s;
}

async function post(url: string, body: unknown, headers: Record<string, string>, timeoutMs = 180_000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body), signal: ctrl.signal });
    const text = await r.text();
    if (!r.ok) throw new Error(`El proveedor respondió ${r.status}: ${text.slice(0, 400)}`);
    return JSON.parse(text);
  } catch (e: any) {
    if (e.name === 'AbortError') throw new Error('El modelo no respondió a tiempo');
    throw e;
  } finally { clearTimeout(t); }
}

interface StreamResult { text: string; usage?: Record<string, number>; model?: string }

/**
 * Llamada en streaming (SSE, formato OpenAI). El límite de espera se reinicia con cada fragmento recibido,
 * así un modelo lento pero activo no se corta; solo se aborta si deja de enviar datos o supera el máximo total.
 */
async function postStream(url: string, body: unknown, headers: Record<string, string>, idleMs = 120_000, totalMs = 900_000): Promise<StreamResult> {
  const ctrl = new AbortController();
  let reason = '';
  const total = setTimeout(() => { reason = 'total'; ctrl.abort(); }, totalMs);
  let idle = setTimeout(() => { reason = 'idle'; ctrl.abort(); }, idleMs);
  const touch = () => { clearTimeout(idle); idle = setTimeout(() => { reason = 'idle'; ctrl.abort(); }, idleMs); };
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', ...headers }, body: JSON.stringify(body), signal: ctrl.signal });
    if (!r.ok) throw new Error(`El proveedor respondió ${r.status}: ${(await r.text()).slice(0, 400)}`);
    const reader = r.body!.getReader();
    const dec = new TextDecoder();
    let buf = '', text = '', model: string | undefined, usage: Record<string, number> | undefined;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      touch();
      buf += dec.decode(value, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') continue;
        try {
          const j = JSON.parse(data);
          model = j.model || model;
          text += j.choices?.[0]?.delta?.content || '';
          if (j.usage) usage = { input: j.usage.prompt_tokens, output: j.usage.completion_tokens };
        } catch { /* fragmento incompleto o comentario */ }
      }
    }
    if (!text.trim()) throw new Error('El modelo terminó sin devolver contenido');
    return { text, usage, model };
  } catch (e: any) {
    if (e.name === 'AbortError') throw new Error(reason === 'idle' ? 'El modelo dejó de responder (sin datos durante 2 minutos)' : 'El modelo no terminó en 15 minutos');
    throw e;
  } finally { clearTimeout(total); clearTimeout(idle); }
}

function parseJsonText(text: string) {
  const t = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim().replace(/^```(json)?/i, '').replace(/```$/, '').trim();
  try { return JSON.parse(t); } catch {
    const a = t.indexOf('{'), b = t.lastIndexOf('}');
    if (a >= 0 && b > a) return JSON.parse(t.slice(a, b + 1));
    throw new Error('La respuesta del modelo no es JSON válido');
  }
}

export async function callProvider(cfg: AiConfig, a: GenerateArgs): Promise<GenerateResult> {
  const images = a.images ?? [];
  switch (cfg.provider) {
    case 'anthropic': {
      const key = process.env.ANTHROPIC_API_KEY;
      if (!key) throw new Error('Falta ANTHROPIC_API_KEY');
      const content: any[] = images.map((i) => ({ type: 'image', source: { type: 'base64', media_type: i.mime, data: i.base64 } }));
      content.push({ type: 'text', text: a.prompt });
      const j = await post(`${cfg.baseUrl || 'https://api.anthropic.com'}/v1/messages`, {
        model: cfg.model, max_tokens: 16000, temperature: cfg.temperature, system: a.system,
        messages: [{ role: 'user', content }],
        tools: [{ name: a.schemaName, description: 'Entrega el resultado estructurado', input_schema: a.jsonSchema }],
        tool_choice: { type: 'tool', name: a.schemaName },
      }, { 'x-api-key': key, 'anthropic-version': '2023-06-01' });
      const tool = (j.content || []).find((c: any) => c.type === 'tool_use');
      if (!tool) throw new Error('El modelo no devolvió la estructura solicitada');
      return { raw: tool.input, usage: { input: j.usage?.input_tokens, output: j.usage?.output_tokens }, model: j.model || cfg.model };
    }
    case 'openai': {
      const key = process.env.OPENAI_API_KEY;
      if (!key && !cfg.baseUrl) throw new Error('Falta OPENAI_API_KEY');
      const userContent: any[] = [{ type: 'text', text: a.prompt }, ...images.map((i) => ({ type: 'image_url', image_url: { url: `data:${i.mime};base64,${i.base64}` } }))];
      const j = await post(`${cfg.baseUrl || 'https://api.openai.com/v1'}/chat/completions`, {
        model: cfg.model,
        messages: [{ role: 'system', content: a.system }, { role: 'user', content: userContent }],
        response_format: { type: 'json_schema', json_schema: { name: a.schemaName, schema: a.jsonSchema, strict: false } },
        ...(/^(gpt-5|o\d)/.test(cfg.model) ? {} : { temperature: cfg.temperature }),
      }, key ? { Authorization: `Bearer ${key}` } : {});
      return { raw: parseJsonText(j.choices?.[0]?.message?.content || ''), usage: { input: j.usage?.prompt_tokens, output: j.usage?.completion_tokens }, model: j.model || cfg.model };
    }
    case 'gemini': {
      const key = process.env.GEMINI_API_KEY;
      if (!key) throw new Error('Falta GEMINI_API_KEY');
      const parts: any[] = [...images.map((i) => ({ inline_data: { mime_type: i.mime, data: i.base64 } })), { text: a.prompt }];
      const j = await post(`${cfg.baseUrl || 'https://generativelanguage.googleapis.com/v1beta'}/models/${cfg.model}:generateContent`, {
        systemInstruction: { parts: [{ text: a.system }] },
        contents: [{ role: 'user', parts }],
        generationConfig: { temperature: cfg.temperature, responseMimeType: 'application/json', responseJsonSchema: geminiSchema(a.jsonSchema) },
      }, { 'x-goog-api-key': key });
      const text = j.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || '';
      return { raw: parseJsonText(text), usage: { input: j.usageMetadata?.promptTokenCount, output: j.usageMetadata?.candidatesTokenCount }, model: cfg.model };
    }
    case 'nvidia': {
      // NVIDIA NIM (build.nvidia.com) expone una API compatible con OpenAI
      const key = process.env.NVIDIA_API_KEY;
      if (!key) throw new Error('Falta NVIDIA_API_KEY');
      const url = `${cfg.baseUrl || 'https://integrate.api.nvidia.com/v1'}/chat/completions`;
      const system = `${a.system}

Responde ÚNICAMENTE con un objeto JSON válido (sin texto adicional ni bloques de código) que cumpla este JSON Schema:
${JSON.stringify(a.jsonSchema)}`;
      const content: any = images.length
        ? [{ type: 'text', text: a.prompt }, ...images.map((i) => ({ type: 'image_url', image_url: { url: `data:${i.mime};base64,${i.base64}` } }))]
        : a.prompt;
      const body = { model: cfg.model, temperature: cfg.temperature, max_tokens: 16384, stream: true, messages: [{ role: 'system', content: system }, { role: 'user', content }] };
      const headers = { Authorization: `Bearer ${key}` };
      let r: StreamResult;
      try {
        // Se pide salida JSON; si el modelo no acepta response_format, se repite sin él
        r = await postStream(url, { ...body, response_format: { type: 'json_object' } }, headers);
      } catch (e: any) {
        if (/respondió 404/.test(e.message)) throw new Error(`NVIDIA no encontró el modelo "${cfg.model}". Usa el identificador completo con su organización, tal como aparece en build.nvidia.com (por ejemplo minimaxai/minimax-m3.1-flash), y deja vacía la URL base.`);
        if (!/respondió (400|422)/.test(e.message)) throw e;
        r = await postStream(url, body, headers);
      }
      return { raw: parseJsonText(r.text), usage: r.usage, model: r.model || cfg.model };
    }
    case 'ollama': {
      const base = cfg.baseUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
      const j = await post(`${base}/api/chat`, {
        model: cfg.model, stream: false, format: a.jsonSchema, options: { temperature: cfg.temperature, num_ctx: 32768 },
        messages: [{ role: 'system', content: a.system }, { role: 'user', content: a.prompt, images: images.map((i) => i.base64) }],
      }, {}, 600_000);
      return { raw: parseJsonText(j.message?.content || ''), usage: { input: j.prompt_eval_count, output: j.eval_count }, model: cfg.model };
    }
    default:
      throw new Error('Proveedor no soportado para llamadas remotas');
  }
}
