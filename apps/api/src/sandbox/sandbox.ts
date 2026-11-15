import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, normalize } from 'node:path';
import type { CodeFile } from '../evidence/extract';

/**
 * Sandbox para ejecutar verificaciones sobre código entregado.
 * Capas (según disponibilidad del host):
 *  1. Directorio temporal desechable con solo los archivos del estudiante.
 *  2. Sin red: espacio de nombres de red vacío (unshare -n); respaldo: bloqueo de sockets en Python/Node.
 *  3. Usuario sin privilegios (nobody) mediante setpriv cuando el proceso corre como root.
 *  4. Límites de recursos con prlimit: memoria, CPU, procesos y tamaño de archivos.
 *  5. Tiempo máximo de pared con terminación del grupo de procesos completo.
 *  6. Variables de entorno mínimas (no se heredan secretos como API keys o DATABASE_URL).
 */
const has = (bin: string) => spawnSync('sh', ['-c', `command -v ${bin}`]).status === 0;
const isRoot = typeof process.getuid === 'function' && process.getuid() === 0;

export const SANDBOX_CAPS = (() => {
  const unshare = has('unshare') && spawnSync('unshare', isRoot ? ['-n', 'true'] : ['-rn', 'true']).status === 0;
  const prlimit = has('prlimit');
  const setpriv = isRoot && has('setpriv');
  const python = has('python3');
  const pytest = python && spawnSync('python3', ['-c', 'import pytest']).status === 0;
  return { unshare, prlimit, setpriv, python, pytest, node: true };
})();

export function isolationSummary() {
  const c = SANDBOX_CAPS;
  return {
    network: c.unshare ? 'Red deshabilitada (namespace de red vacío)' : 'Red bloqueada a nivel de intérprete (respaldo)',
    user: c.setpriv ? 'Usuario sin privilegios (nobody)' : 'Usuario del servicio (sin privilegios de root)',
    limits: c.prlimit ? 'Memoria 512 MB, CPU 20 s, 64 procesos, archivos 10 MB' : 'Solo límite de tiempo',
    timeout: 'Tiempo máximo por ejecución',
    env: 'Entorno sin secretos',
  };
}

const BLOCK_NET_PY = `import socket
def _blocked(*a, **k):
    raise OSError("Red deshabilitada en el sandbox de evaluación")
socket.socket.connect = _blocked
socket.create_connection = _blocked
socket.getaddrinfo = _blocked
`;
const BLOCK_NET_JS = `const net=require('net');const dns=require('dns');
const err=()=>{throw new Error('Red deshabilitada en el sandbox de evaluación')};
net.Socket.prototype.connect=err;net.connect=err;net.createConnection=err;dns.lookup=err;
if(globalThis.fetch)globalThis.fetch=async()=>err();`;

export interface RunResult { code: number | null; stdout: string; stderr: string; timedOut: boolean; durationMs: number }

export class Sandbox {
  private constructor(public dir: string, private guardDir: string) {}

  static async create(files: CodeFile[], raw?: Map<string, Buffer>) {
    const root = await mkdtemp(join(tmpdir(), 'sbx-'));
    const dir = join(root, 'work');
    const guardDir = join(root, 'guard');
    await mkdir(dir); await mkdir(guardDir);
    await writeFile(join(guardDir, 'sitecustomize.py'), BLOCK_NET_PY);
    await writeFile(join(guardDir, 'blocknet.js'), BLOCK_NET_JS);
    const write = async (p: string, data: string | Buffer) => {
      const safe = normalize(p).replace(/^(\.\.(\/|\\|$))+/, '');
      if (safe.startsWith('/') || safe.includes('..')) return;
      const full = join(dir, safe);
      await mkdir(dirname(full), { recursive: true });
      await writeFile(full, data);
    };
    if (raw) for (const [p, b] of raw) await write(p, b);
    else for (const f of files) await write(f.path, f.content);
    await chmod(root, 0o777);
    if (SANDBOX_CAPS.setpriv) spawnSync('chmod', ['-R', 'a+rwX', root]);
    return new Sandbox(dir, guardDir);
  }

  run(cmd: string, args: string[], opts: { timeoutMs?: number; memMb?: number; cpuSec?: number } = {}): Promise<RunResult> {
    const timeoutMs = opts.timeoutMs ?? 30_000;
    const argv: string[] = [];
    if (SANDBOX_CAPS.unshare) argv.push('unshare', ...(isRoot ? ['-n'] : ['-rn']), '--');
    if (SANDBOX_CAPS.setpriv) argv.push('setpriv', '--reuid=65534', '--regid=65534', '--clear-groups', '--');
    if (SANDBOX_CAPS.prlimit) argv.push('prlimit', `--as=${(opts.memMb ?? 512) * 1024 * 1024}`, `--cpu=${opts.cpuSec ?? 20}`, '--nproc=64', `--fsize=${10 * 1024 * 1024}`, '--');
    argv.push(cmd, ...args);
    const env: Record<string, string> = {
      PATH: '/usr/local/bin:/usr/bin:/bin', HOME: this.dir, LANG: 'C.UTF-8', PYTHONDONTWRITEBYTECODE: '1',
      MPLBACKEND: 'Agg',
    };
    if (!SANDBOX_CAPS.unshare) {
      env.PYTHONPATH = this.guardDir;
      env.NODE_OPTIONS = `--require ${join(this.guardDir, 'blocknet.js')}`;
    }
    const started = Date.now();
    return new Promise((resolve) => {
      const p = spawn(argv[0], argv.slice(1), { cwd: this.dir, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '', stderr = '', timedOut = false;
      const cap = 64 * 1024;
      p.stdout.on('data', (d) => { if (stdout.length < cap) stdout += d.toString(); });
      p.stderr.on('data', (d) => { if (stderr.length < cap) stderr += d.toString(); });
      const t = setTimeout(() => { timedOut = true; try { process.kill(-p.pid!, 'SIGKILL'); } catch { /* ya terminó */ } }, timeoutMs);
      p.on('error', (e) => { clearTimeout(t); resolve({ code: -1, stdout, stderr: stderr + String(e), timedOut, durationMs: Date.now() - started }); });
      p.on('close', (code) => { clearTimeout(t); resolve({ code, stdout, stderr, timedOut, durationMs: Date.now() - started }); });
    });
  }

  async dispose() { await rm(dirname(this.dir), { recursive: true, force: true }); }
}
