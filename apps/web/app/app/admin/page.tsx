'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { useSession } from '@/components/session';
import { Badge, Button, ErrorBox, Field, Input, Loading, PageHead, Panel, Select, Textarea, cx } from '@/components/ui';
import { fmtDate, PROVIDER, ROLE } from '@/lib/format';

function Users() {
  const { user: me } = useSession();
  const u = useApi<any[]>('/users');
  const [f, setF] = useState({ name: '', email: '', password: '', role: 'STUDENT', studentCode: '' });
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const create = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError(null);
    try { await api('/users', { body: { ...f, studentCode: f.studentCode || undefined } }); setF({ name: '', email: '', password: '', role: 'STUDENT', studentCode: '' }); u.reload(); } catch (err) { setError(err); } finally { setBusy(false); }
  };
  const patch = async (id: string, body: any) => { setError(null); try { await api(`/users/${id}`, { method: 'PATCH', body }); u.reload(); } catch (err) { setError(err); } };
  const reset = async (id: string) => { const p = prompt('Nueva contraseña (mínimo 8 caracteres):'); if (p) patch(id, { password: p }); };
  return (
    <div className="grid lg:grid-cols-[2fr_1fr] gap-6">
      <Panel title="Usuarios">
        <ErrorBox error={error} />
        {u.loading ? <Loading /> : (
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead className="text-left text-muted"><tr><th className="py-2">Nombre</th><th>Rol</th><th>Estado</th><th /></tr></thead>
            <tbody>{u.data?.map((x) => (
              <tr key={x.id} className="border-t border-line">
                <td className="py-2"><p className="font-medium">{x.name}</p><p className="text-xs text-muted">{x.email}{x.studentCode ? ` · ${x.studentCode}` : ''}</p></td>
                <td><Select className="py-1 w-36" value={x.role} disabled={x.id === me.id} onChange={(e) => patch(x.id, { role: e.target.value })}>{Object.entries(ROLE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></td>
                <td>{x.active ? <Badge tone="high">Activo</Badge> : <Badge tone="none">Inactivo</Badge>}</td>
                <td className="text-right whitespace-nowrap">
                  <Button size="sm" variant="ghost" onClick={() => reset(x.id)}>Contraseña</Button>
                  {x.id !== me.id && <Button size="sm" variant="ghost" onClick={() => patch(x.id, { active: !x.active })}>{x.active ? 'Desactivar' : 'Activar'}</Button>}
                </td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </Panel>
      <Panel title="Crear usuario">
        <form onSubmit={create} className="space-y-3">
          <Field label="Nombre"><Input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Correo"><Input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
          <Field label="Contraseña inicial"><Input type="password" required minLength={8} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
          <Field label="Rol"><Select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>{Object.entries(ROLE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
          {f.role === 'STUDENT' && <Field label="Código estudiantil"><Input value={f.studentCode} onChange={(e) => setF({ ...f, studentCode: e.target.value })} /></Field>}
          <Button type="submit" loading={busy}>Crear usuario</Button>
        </form>
      </Panel>
    </div>
  );
}

function AiSettings() {
  const s = useApi<any>('/settings');
  const [cfg, setCfg] = useState<any>(null);
  const [pol, setPol] = useState<any>(null);
  const [test, setTest] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => { if (s.data) { setCfg(s.data.ai); setPol(s.data.policy); } }, [s.data]);
  if (!cfg) return <Loading />;
  const keys = s.data.keys;
  const run = async (name: string, fn: () => Promise<any>) => { setBusy(name); setError(null); setSaved(false); try { await fn(); } catch (e) { setError(e); } finally { setBusy(null); } };
  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Panel title="Modelo de IA para evaluar">
        <div className="space-y-4">
          <Field label="Proveedor"><Select value={cfg.provider} onChange={(e) => setCfg({ ...cfg, provider: e.target.value, model: s.data.defaults[e.target.value] })}>
            {Object.entries(PROVIDER).map(([k, v]) => <option key={k} value={k}>{v}{k !== 'demo' && !keys[k] ? ' · sin clave configurada' : ''}</option>)}
          </Select></Field>
          <Field label="Modelo" hint="Nombre exacto del modelo en el proveedor."><Input value={cfg.model} onChange={(e) => setCfg({ ...cfg, model: e.target.value })} /></Field>
          <Field label="URL base (opcional)" hint="Para Ollama u otros servicios compatibles con OpenAI (LM Studio, Groq, OpenRouter…)."><Input value={cfg.baseUrl ?? ''} onChange={(e) => setCfg({ ...cfg, baseUrl: e.target.value })} placeholder={cfg.provider === 'ollama' ? 'http://mi-servidor:11434' : ''} /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Temperatura" hint="Baja = más consistente."><Input type="number" step="0.05" min={0} max={1} value={cfg.temperature} onChange={(e) => setCfg({ ...cfg, temperature: Number(e.target.value) })} /></Field>
            <Field label="Contexto máximo (caracteres)" hint="Redúcelo para modelos locales."><Input type="number" step="1000" value={cfg.maxContextChars} onChange={(e) => setCfg({ ...cfg, maxContextChars: Number(e.target.value) })} /></Field>
          </div>
          {cfg.provider !== 'demo' && !keys[cfg.provider] && <p className="rounded bg-marker-soft px-3 py-2 text-sm">Falta la variable de entorno {{ anthropic: 'ANTHROPIC_API_KEY', openai: 'OPENAI_API_KEY', gemini: 'GEMINI_API_KEY', nvidia: 'NVIDIA_API_KEY', ollama: 'OLLAMA_BASE_URL (o indica la URL base)' }[cfg.provider as string]} en el servidor de la API.</p>}
          <ErrorBox error={error} />
          {test && <p className={cx('rounded px-3 py-2 text-sm', test.ok ? 'bg-teal-soft text-teal-dark' : 'bg-low-soft text-low')}>{test.ok ? `Conexión correcta (${test.ms} ms, ${test.model}): ${test.response?.mensaje}` : `Falló: ${test.error}`}</p>}
          {saved && <p className="text-sm text-teal-dark">Configuración guardada. Las próximas evaluaciones usarán este modelo.</p>}
          <div className="flex gap-2">
            <Button loading={busy === 'save'} onClick={() => run('save', async () => { await api('/settings/ai', { method: 'PUT', body: cfg }); setSaved(true); s.reload(); })}>Guardar</Button>
            <Button variant="secondary" loading={busy === 'test'} onClick={() => run('test', async () => setTest(await api('/settings/ai/test', { body: cfg })))}>Probar conexión</Button>
          </div>
        </div>
      </Panel>
      <div className="space-y-6">
        <Panel title="Políticas de evaluación">
          <div className="space-y-3 text-sm">
            <label className="flex gap-2"><input type="checkbox" checked={pol.studentsCanEvaluate} onChange={(e) => setPol({ ...pol, studentsCanEvaluate: e.target.checked })} />Los estudiantes pueden solicitar la evaluación de sus entregas (autoevaluación)</label>
            <label className="flex gap-2"><input type="checkbox" checked={pol.studentsSeePreliminary} onChange={(e) => setPol({ ...pol, studentsSeePreliminary: e.target.checked })} />Mostrar a los estudiantes la valoración preliminar antes de la aprobación docente</label>
            <Button size="sm" loading={busy === 'pol'} onClick={() => run('pol', async () => { await api('/settings/policy', { method: 'PUT', body: pol }); setSaved(true); })}>Guardar políticas</Button>
          </div>
        </Panel>
        <Panel title="Sandbox de ejecución de código">
          <ul className="text-sm space-y-1">{Object.values(s.data.sandbox.isolation).map((v: any) => <li key={v}>{v}</li>)}</ul>
          <p className="text-xs text-muted mt-2">Capacidades detectadas: {Object.entries(s.data.sandbox.caps).map(([k, v]) => `${k}: ${v ? 'sí' : 'no'}`).join(' · ')}</p>
        </Panel>
      </div>
    </div>
  );
}

function Team() {
  const p = useApi<any>('/project');
  const [proj, setProj] = useState<any>(null);
  const [error, setError] = useState<unknown>(null);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { if (p.data) { const { team, ...rest } = p.data; setProj(rest); } }, [p.data]);
  if (!proj) return <Loading />;
  const list = (k: string) => (proj[k] as string[]).join('\n');
  const setList = (k: string, v: string) => setProj({ ...proj, [k]: v.split('\n').map((x) => x.trim()).filter(Boolean) });
  const saveProject = async () => { setError(null); try { await api('/project', { method: 'PUT', body: proj }); setMsg('Proyecto guardado.'); } catch (e) { setError(e); } };
  const upd = async (id: string, body: any) => { try { await api(`/team/${id}`, { method: 'PATCH', body }); } catch (e) { setError(e); } };
  const photo = async (id: string, f: File) => { const form = new FormData(); form.append('photo', f); try { await api(`/team/${id}/photo`, { form }); p.reload(); } catch (e) { setError(e); } };
  const add = async () => { await api('/team', { body: { name: 'Nuevo integrante', role: 'Rol', order: p.data.team.length + 1 } }); p.reload(); };
  const del = async (id: string) => { if (confirm('¿Eliminar integrante?')) { await api(`/team/${id}`, { method: 'DELETE' }); p.reload(); } };
  return (
    <div className="space-y-6">
      <ErrorBox error={error} />{msg && <p className="text-sm text-teal-dark">{msg}</p>}
      <Panel title="Equipo desarrollador" actions={<Button size="sm" variant="secondary" onClick={add}>Agregar integrante</Button>}>
        <ul className="grid md:grid-cols-2 gap-5">
          {p.data.team.map((m: any) => (
            <li key={m.id} className="flex gap-4 border border-line rounded-md p-3">
              <div className="w-24 shrink-0">
                {m.hasPhoto ? <img src={`/api/team/${m.id}/photo?${Date.now()}`} alt="" className="w-24 h-28 object-cover rounded" /> : <div className="w-24 h-28 rounded bg-paper flex items-center justify-center text-muted text-xs text-center">Sin foto</div>}
                <label className="block text-xs text-teal mt-1 cursor-pointer">Cambiar foto<input type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={(e) => e.target.files?.[0] && photo(m.id, e.target.files[0])} /></label>
              </div>
              <div className="flex-1 space-y-2">
                <Input defaultValue={m.name} onBlur={(e) => upd(m.id, { name: e.target.value })} aria-label="Nombre" />
                <Input defaultValue={m.role} onBlur={(e) => upd(m.id, { role: e.target.value })} aria-label="Rol" />
                <Textarea rows={2} defaultValue={m.bio} placeholder="Breve descripción" onBlur={(e) => upd(m.id, { bio: e.target.value })} aria-label="Descripción" />
                <Button size="sm" variant="ghost" onClick={() => del(m.id)}>Eliminar</Button>
              </div>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted mt-3">Los cambios de texto se guardan al salir de cada campo.</p>
      </Panel>
      <Panel title="Abstract y presentación del proyecto" actions={<Button size="sm" onClick={saveProject}>Guardar proyecto</Button>}>
        <div className="space-y-4">
          <Field label="Nombre"><Input value={proj.name} onChange={(e) => setProj({ ...proj, name: e.target.value })} /></Field>
          <Field label="Abstract"><Textarea rows={6} value={proj.abstract} onChange={(e) => setProj({ ...proj, abstract: e.target.value })} /></Field>
          <div className="grid md:grid-cols-2 gap-4">
            {[['objectives', 'Objetivos'], ['features', 'Funcionalidades'], ['technologies', 'Tecnologías'], ['contributions', 'Aportes']].map(([k, l]) => <Field key={k} label={l} hint="Uno por línea"><Textarea rows={5} value={list(k)} onChange={(e) => setList(k, e.target.value)} /></Field>)}
          </div>
          <Field label="Herramientas de IA usadas en el desarrollo" hint="Una por línea: herramienta | aporte | limitaciones">
            <Textarea rows={5} value={proj.aiTools.map((t: any) => `${t.tool} | ${t.use} | ${t.limits}`).join('\n')}
              onChange={(e) => setProj({ ...proj, aiTools: e.target.value.split('\n').filter((x) => x.trim()).map((x) => { const [tool, use, limits] = x.split('|').map((y) => (y ?? '').trim()); return { tool, use: use ?? '', limits: limits ?? '' }; }) })} />
          </Field>
        </div>
      </Panel>
    </div>
  );
}

function Audit() {
  const a = useApi<any[]>('/audit');
  if (a.loading) return <Loading />;
  return (
    <Panel title="Bitácora de auditoría">
      <div className="overflow-x-auto"><table className="w-full text-sm">
        <thead className="text-left text-muted"><tr><th className="py-2">Fecha</th><th>Usuario</th><th>Acción</th><th>Detalle</th></tr></thead>
        <tbody>{a.data?.map((x) => <tr key={x.id} className="border-t border-line align-top"><td className="py-2 whitespace-nowrap text-muted">{fmtDate(x.createdAt)}</td><td>{x.user ?? '—'}</td><td className="font-medium">{x.action}</td><td className="text-xs text-muted break-all">{JSON.stringify(x.details).slice(0, 200)}</td></tr>)}</tbody>
      </table></div>
    </Panel>
  );
}

const TABS = [['users', 'Usuarios', Users], ['ai', 'Modelo de IA y políticas', AiSettings], ['team', 'Equipo y proyecto', Team], ['audit', 'Auditoría', Audit]] as const;

export default function Admin() {
  const [tab, setTab] = useState<string>('users');
  const Comp = TABS.find((t) => t[0] === tab)![2];
  return (
    <>
      <PageHead title="Administración" subtitle="Usuarios, modelo de IA, políticas de publicación, presentación del equipo y bitácora." />
      <div role="tablist" className="flex gap-1 border-b border-line mb-6 overflow-x-auto">
        {TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cx('px-3 py-2 text-sm whitespace-nowrap border-b-2 -mb-px', tab === k ? 'border-teal text-teal font-medium' : 'border-transparent text-muted hover:text-ink')}>{l}</button>)}
      </div>
      <Comp />
    </>
  );
}
