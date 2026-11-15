import AdmZip from 'adm-zip';
import { createHash } from 'node:crypto';

export const sha256 = (b: Buffer) => createHash('sha256').update(b).digest('hex');

export async function extractPdfText(buf: Buffer): Promise<{ text: string; pages: number }> {
  const { extractText, getDocumentProxy } = await import('unpdf');
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { totalPages, text } = await extractText(pdf, { mergePages: false });
  const pages = (text as string[]).map((t, i) => `[Página ${i + 1}]\n${t.replace(/[ \t]+/g, ' ').trim()}`);
  return { text: pages.join('\n\n'), pages: totalPages };
}

const stripXml = (xml: string) =>
  xml.replace(/<\/w:p>|<\/a:p>/g, '\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'");

export function extractDocxText(buf: Buffer) {
  const zip = new AdmZip(buf);
  const e = zip.getEntry('word/document.xml');
  if (!e) throw new Error('El archivo DOCX no es válido');
  return stripXml(e.getData().toString('utf8')).replace(/\n{3,}/g, '\n\n').trim();
}

export function extractPptxText(buf: Buffer) {
  const zip = new AdmZip(buf);
  const slides = zip.getEntries()
    .filter((e) => /^ppt\/slides\/slide\d+\.xml$/.test(e.entryName))
    .sort((a, b) => Number(a.entryName.match(/\d+/)![0]) - Number(b.entryName.match(/\d+/)![0]));
  return slides.map((s, i) => `[Diapositiva ${i + 1}]\n${stripXml(s.getData().toString('utf8')).trim()}`).join('\n\n');
}

export function notebookToText(json: string) {
  const nb = JSON.parse(json);
  return (nb.cells || []).map((c: any, i: number) => {
    const src = Array.isArray(c.source) ? c.source.join('') : String(c.source || '');
    if (c.cell_type === 'code') {
      const outs = (c.outputs || []).map((o: any) => {
        const t = o.text ?? o.data?.['text/plain'];
        return t ? (Array.isArray(t) ? t.join('') : String(t)).slice(0, 1500) : o.ename ? `${o.ename}: ${o.evalue}` : '';
      }).filter(Boolean).join('\n');
      return `# %% [celda ${i + 1} · código]\n${src}${outs ? `\n# >>> salida:\n# ${outs.split('\n').join('\n# ')}` : ''}`;
    }
    return `# %% [celda ${i + 1} · markdown]\n# ${src.split('\n').join('\n# ')}`;
  }).join('\n\n');
}

export interface CodeFile { path: string; content: string; size: number; lang: string }
export interface CodeBundle { files: CodeFile[]; skipped: { path: string; reason: string }[]; images: { path: string; mime: string; data: Buffer }[]; totalEntries: number }

const LANG: Record<string, string> = {
  py: 'python', ipynb: 'notebook', js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
  java: 'java', c: 'c', cpp: 'cpp', h: 'c', cs: 'csharp', go: 'go', rb: 'ruby', php: 'php', r: 'r', R: 'r', kt: 'kotlin', swift: 'swift', rs: 'rust',
  sql: 'sql', html: 'html', css: 'css', md: 'markdown', txt: 'text', json: 'json', yml: 'yaml', yaml: 'yaml', toml: 'toml', cfg: 'config', ini: 'config',
  sh: 'shell', dockerfile: 'docker', csv: 'data',
};
const IGNORE = /(^|\/)(node_modules|\.git|__pycache__|\.venv|venv|env|\.idea|\.vscode|dist|build|\.next|\.ipynb_checkpoints|__MACOSX)(\/|$)/;
const MAX_UNCOMPRESSED = 80 * 1024 * 1024;
const MAX_ENTRIES = 6000;
const MAX_FILE = 400 * 1024;

export function langOf(path: string) {
  const base = path.split('/').pop()!.toLowerCase();
  if (base === 'dockerfile') return 'docker';
  if (base === 'requirements.txt') return 'requirements';
  return LANG[path.split('.').pop() || ''] || '';
}

/** Lee un ZIP con protecciones contra zip-bomb y path traversal. Nunca escribe en disco. */
export function readCodeZip(buf: Buffer): CodeBundle {
  const zip = new AdmZip(buf);
  const entries = zip.getEntries();
  if (entries.length > MAX_ENTRIES) throw new Error(`El ZIP tiene demasiados archivos (${entries.length})`);
  const total = entries.reduce((s, e) => s + (e.header.size || 0), 0);
  if (total > MAX_UNCOMPRESSED) throw new Error('El contenido descomprimido del ZIP supera 80 MB');
  // GitHub agrega un directorio raíz "repo-sha/": se elimina si todo cuelga de él
  const names = entries.filter((e) => !e.isDirectory).map((e) => e.entryName);
  const first = names[0]?.split('/')[0];
  const strip = first && names.every((n) => n.startsWith(first + '/')) ? first.length + 1 : 0;
  const bundle: CodeBundle = { files: [], skipped: [], images: [], totalEntries: names.length };
  for (const e of entries) {
    if (e.isDirectory) continue;
    const path = e.entryName.slice(strip).replace(/\\/g, '/');
    if (!path || path.includes('..') || path.startsWith('/')) { bundle.skipped.push({ path: e.entryName, reason: 'ruta insegura' }); continue; }
    if (IGNORE.test(path)) continue;
    const ext = (path.split('.').pop() || '').toLowerCase();
    if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) {
      if (e.header.size < 4 * 1024 * 1024 && bundle.images.length < 6) bundle.images.push({ path, mime: `image/${ext === 'jpg' ? 'jpeg' : ext}`, data: e.getData() });
      continue;
    }
    const lang = langOf(path);
    if (!lang) { bundle.skipped.push({ path, reason: 'tipo no analizable' }); continue; }
    if (e.header.size > (lang === 'notebook' ? 5 * MAX_FILE : MAX_FILE)) { bundle.skipped.push({ path, reason: 'archivo demasiado grande' }); continue; }
    let content = e.getData().toString('utf8');
    if (content.includes('\u0000')) { bundle.skipped.push({ path, reason: 'binario' }); continue; }
    if (lang === 'notebook') {
      try { content = notebookToText(content); } catch { bundle.skipped.push({ path, reason: 'notebook inválido' }); continue; }
    }
    if (lang === 'data') content = content.split('\n').slice(0, 15).join('\n') + '\n# ... (solo primeras filas)';
    bundle.files.push({ path, content, size: e.header.size, lang });
  }
  return bundle;
}

/** Normaliza un enlace de GitHub y descarga el repositorio como ZIP (con commit para trazabilidad). */
export function parseGithubUrl(url: string) {
  const m = url.trim().match(/^https?:\/\/(www\.)?github\.com\/([\w.-]+)\/([\w.-]+?)(\.git)?(\/tree\/([^?#]+))?\/?([?#].*)?$/);
  if (!m) return null;
  return { owner: m[2], repo: m[3], ref: m[6] };
}

export async function downloadGithub(url: string): Promise<{ data: Buffer; commit: string | null; ref: string }> {
  const g = parseGithubUrl(url);
  if (!g) throw new Error('El enlace no parece un repositorio de GitHub (https://github.com/usuario/repositorio)');
  const headers: Record<string, string> = { 'User-Agent': 'asesor-pedagogico-ia', Accept: 'application/vnd.github+json' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const base = `https://api.github.com/repos/${g.owner}/${g.repo}`;
  let ref = g.ref;
  let commit: string | null = null;
  let z: Response | null = null;
  try {
    if (!ref) {
      const r = await fetch(base, { headers });
      if (r.status === 404) throw new Error('Repositorio no encontrado o privado');
      if (!r.ok) throw new Error(`GitHub respondió ${r.status}`);
      ref = ((await r.json()) as any).default_branch;
    }
    const c = await fetch(`${base}/commits/${encodeURIComponent(ref!)}`, { headers });
    if (c.ok) commit = ((await c.json()) as any).sha;
    z = await fetch(`${base}/zipball/${encodeURIComponent(commit || ref!)}`, { headers, redirect: 'follow' });
    if (!z.ok) throw new Error(`No se pudo descargar el repositorio (${z.status})`);
  } catch (e) {
    if (/no encontrado/.test((e as Error).message)) throw e;
    // Respaldo sin API (p. ej. límite de peticiones): descarga directa del archivo ZIP
    z = await fetch(`https://codeload.github.com/${g.owner}/${g.repo}/zip/${ref ? encodeURIComponent(ref) : 'HEAD'}`, { headers: { 'User-Agent': headers['User-Agent'] }, redirect: 'follow' });
    if (!z.ok) throw new Error(`No se pudo descargar el repositorio (${(e as Error).message}; descarga directa ${z.status})`);
    ref = ref || 'HEAD';
  }
  const len = Number(z.headers.get('content-length') || 0);
  if (len > 40 * 1024 * 1024) throw new Error('El repositorio supera 40 MB');
  const data = Buffer.from(await z.arrayBuffer());
  if (data.length > 40 * 1024 * 1024) throw new Error('El repositorio supera 40 MB');
  return { data, commit, ref: ref! };
}

/** Selecciona y recorta el código más relevante para el prompt. */
export function codeForPrompt(files: CodeFile[], maxChars: number) {
  const priority = (f: CodeFile) => {
    let p = 0;
    if (['python', 'notebook', 'javascript', 'typescript', 'java', 'r', 'cpp', 'c', 'go', 'csharp'].includes(f.lang)) p += 10;
    if (/readme/i.test(f.path)) p += 8;
    if (/(main|app|model|train|agent|index|pipeline)\./i.test(f.path)) p += 4;
    if (/test/i.test(f.path)) p += 2;
    if (['requirements', 'json', 'yaml', 'toml', 'config'].includes(f.lang)) p += 1;
    return p - f.path.split('/').length * 0.1;
  };
  const sorted = [...files].sort((a, b) => priority(b) - priority(a));
  const parts: string[] = []; let used = 0; const included: string[] = []; const truncated: string[] = [];
  for (const f of sorted) {
    if (used >= maxChars) { truncated.push(f.path); continue; }
    const room = maxChars - used;
    const body = f.content.length > room ? f.content.slice(0, room) + '\n... [recortado]' : f.content;
    if (f.content.length > room) truncated.push(f.path);
    parts.push(`=== [CODIGO ${f.path}] ===\n${body}`);
    used += body.length; included.push(f.path);
  }
  return { text: parts.join('\n\n'), included, truncated };
}
