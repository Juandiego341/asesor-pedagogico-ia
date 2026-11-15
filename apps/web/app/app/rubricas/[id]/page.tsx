'use client';
import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Plus, Trash2, XCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { useSession } from '@/components/session';
import { Badge, Button, ErrorBox, Input, Loading, PageHead, Panel, Textarea, Select, cx } from '@/components/ui';

type Level = { id: string; name: string; score: number; descriptor: string };
type Crit = { id: string; competencyId: string; name: string; description: string; weight: number; levels: Level[] };
type Content = { title: string; competencies: { id: string; name: string; description: string }[]; criteria: Crit[] };

const FIX_LABEL: Record<string, string> = { normalize_weights: 'Normalizar ponderaciones a 100 %', sort_levels: 'Ordenar niveles', create_competency: 'Crear competencias faltantes' };
const uid = (p: string, used: string[]) => { let i = used.length + 1; while (used.includes(`${p}${i}`)) i++; return `${p}${i}`; };

export default function RubricPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { isStaff } = useSession();
  const r = useApi<any>(`/rubrics/${id}`);
  const [c, setC] = useState<Content | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const router = useRouter();
  useEffect(() => { if (r.data) { setC(r.data.content); setDirty(false); } }, [r.data]);
  if (r.loading || !c) return r.error ? <ErrorBox error={r.error} /> : <Loading />;
  const editable = isStaff && r.data.status === 'DRAFT';
  const total = c.criteria.reduce((s, k) => s + (Number(k.weight) || 0), 0);
  const upd = (fn: (x: Content) => void) => { const n = structuredClone(c); fn(n); setC(n); setDirty(true); };
  const act = async (name: string, fn: () => Promise<any>) => {
    setBusy(name); setError(null);
    try { const res = await fn(); return res; } catch (e) { setError(e); } finally { setBusy(null); }
  };
  const save = () => act('save', async () => { r.setData(await api(`/rubrics/${id}`, { method: 'PUT', body: { content: c } })); });
  const fix = (f: string) => act(f, async () => { if (dirty) await api(`/rubrics/${id}`, { method: 'PUT', body: { content: c } }); r.setData(await api(`/rubrics/${id}/fix`, { body: { fix: f } })); });
  const publish = () => act('publish', async () => { if (dirty) await api(`/rubrics/${id}`, { method: 'PUT', body: { content: c } }); r.setData(await api(`/rubrics/${id}/publish`, { method: 'POST' })); });
  const clone = () => act('clone', async () => { const n = await api(`/rubrics/${id}/clone`, { method: 'POST' }); router.push(`/app/rubricas/${n.id}`); });
  const issues: any[] = r.data.issues;
  const errors = issues.filter((i) => i.severity === 'error');
  const fixes = [...new Set(issues.map((i) => i.fix).filter(Boolean))] as string[];

  return (
    <>
      <PageHead title={`${c.title} · versión ${r.data.version}`}
        subtitle={<><Link href={`/app/laboratorios/${r.data.labId}`} className="text-teal hover:underline">Volver al laboratorio</Link> · Interpretada por: {r.data.extractedBy}</>}
        actions={isStaff && <>
          {editable && <Button variant="secondary" disabled={!dirty} loading={busy === 'save'} onClick={save}>Guardar borrador</Button>}
          {editable && <Button loading={busy === 'publish'} disabled={errors.length > 0 && !dirty} onClick={publish}>Publicar versión</Button>}
          {!editable && <Button variant="secondary" loading={busy === 'clone'} onClick={clone}>Crear nueva versión a partir de esta</Button>}
        </>} />
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Badge tone={r.data.status === 'PUBLISHED' ? 'high' : r.data.status === 'DRAFT' ? 'mid' : 'none'}>{{ PUBLISHED: 'Publicada · en uso para evaluar', DRAFT: 'Borrador · editable', ARCHIVED: 'Archivada · conservada para trazabilidad' }[r.data.status as string]}</Badge>
        <span className={cx('text-sm num', Math.abs(total - 100) > 0.01 ? 'text-low font-medium' : 'text-muted')}>Suma de ponderaciones: {Math.round(total * 100) / 100} %</span>
        {dirty && <span className="text-sm text-mid">Cambios sin guardar: las inconsistencias se recalculan al guardar.</span>}
      </div>
      <ErrorBox error={error} />
      {issues.length > 0 && (
        <Panel title={`Inconsistencias detectadas (${issues.length})`} className="mb-6">
          <ul className="space-y-1.5 text-sm">
            {issues.map((i, k) => (
              <li key={k} className="flex gap-2">{i.severity === 'error' ? <XCircle className="size-4 text-low shrink-0 mt-0.5" /> : <AlertTriangle className="size-4 text-mid shrink-0 mt-0.5" />}<span>{i.message}</span></li>
            ))}
          </ul>
          {editable && fixes.length > 0 && <div className="flex flex-wrap gap-2 mt-4">{fixes.map((f) => <Button key={f} size="sm" variant="secondary" loading={busy === f} onClick={() => fix(f)}>{FIX_LABEL[f]}</Button>)}</div>}
          {errors.length > 0 && <p className="text-sm text-muted mt-3">Corrige los errores para poder publicar. Las advertencias no bloquean la publicación.</p>}
        </Panel>
      )}

      <Panel title="Competencias" className="mb-6" actions={editable && <Button size="sm" variant="secondary" onClick={() => upd((x) => { x.competencies.push({ id: uid('C', x.competencies.map((y) => y.id)), name: 'Nueva competencia', description: '' }); })}><Plus className="size-4" />Competencia</Button>}>
        <ul className="space-y-2">
          {c.competencies.map((comp, i) => (
            <li key={comp.id} className="flex gap-2 items-center">
              <span className="text-xs text-muted w-10">{comp.id}</span>
              {editable ? <Input value={comp.name} onChange={(e) => upd((x) => { x.competencies[i].name = e.target.value; })} /> : <span className="font-medium">{comp.name}</span>}
              {editable && <Button variant="ghost" size="sm" aria-label="Eliminar competencia" onClick={() => upd((x) => { x.competencies.splice(i, 1); })}><Trash2 className="size-4" /></Button>}
            </li>
          ))}
        </ul>
      </Panel>

      <div className="space-y-4">
        {c.criteria.map((k, i) => (
          <Panel key={k.id + i}
            title={editable ? <Input value={k.name} onChange={(e) => upd((x) => { x.criteria[i].name = e.target.value; })} aria-label="Nombre del criterio" /> : <>{k.name}</>}
            actions={<div className="flex items-center gap-2">
              {editable ? <><Input type="number" step="0.5" className="w-24" value={k.weight} onChange={(e) => upd((x) => { x.criteria[i].weight = Number(e.target.value); })} aria-label="Ponderación" /><span>%</span>
                <Button variant="ghost" size="sm" aria-label="Eliminar criterio" onClick={() => upd((x) => { x.criteria.splice(i, 1); })}><Trash2 className="size-4" /></Button></>
                : <span className="font-display text-xl font-semibold num">{k.weight} %</span>}
            </div>}>
            <div className="grid sm:grid-cols-[1fr_260px] gap-3 mb-4">
              {editable ? <Textarea rows={2} placeholder="Descripción del criterio" value={k.description} onChange={(e) => upd((x) => { x.criteria[i].description = e.target.value; })} /> : <p className="text-ink-2">{k.description}</p>}
              {editable ? <Select value={k.competencyId} onChange={(e) => upd((x) => { x.criteria[i].competencyId = e.target.value; })} aria-label="Competencia">
                {c.competencies.map((comp) => <option key={comp.id} value={comp.id}>{comp.name}</option>)}
                {!c.competencies.some((comp) => comp.id === k.competencyId) && <option value={k.competencyId}>{k.competencyId} (no existe)</option>}
              </Select> : <p className="text-sm text-muted">Competencia: {c.competencies.find((comp) => comp.id === k.competencyId)?.name ?? k.competencyId}</p>}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-muted"><th className="pb-2 pr-2 w-40">Nivel</th><th className="pb-2 pr-2 w-24">Valor (0–5)</th><th className="pb-2">Descriptor de desempeño</th>{editable && <th />}</tr></thead>
                <tbody>
                  {k.levels.map((l, j) => (
                    <tr key={l.id + j} className="border-t border-line align-top">
                      <td className="py-2 pr-2">{editable ? <Input value={l.name} onChange={(e) => upd((x) => { x.criteria[i].levels[j].name = e.target.value; })} /> : <span className="font-medium">{l.name}</span>}</td>
                      <td className="py-2 pr-2 num">{editable ? <Input type="number" step="0.1" min={0} max={5} value={l.score} onChange={(e) => upd((x) => { x.criteria[i].levels[j].score = Number(e.target.value); })} /> : l.score.toFixed(1).replace('.', ',')}</td>
                      <td className="py-2">{editable ? <Textarea rows={2} value={l.descriptor} onChange={(e) => upd((x) => { x.criteria[i].levels[j].descriptor = e.target.value; })} /> : l.descriptor}</td>
                      {editable && <td className="py-2 pl-1"><Button variant="ghost" size="sm" aria-label="Eliminar nivel" onClick={() => upd((x) => { x.criteria[i].levels.splice(j, 1); })}><Trash2 className="size-4" /></Button></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {editable && <Button size="sm" variant="ghost" className="mt-2" onClick={() => upd((x) => { x.criteria[i].levels.push({ id: uid('N', x.criteria[i].levels.map((y) => y.id)), name: 'Nuevo nivel', score: 0, descriptor: '' }); })}><Plus className="size-4" />Nivel</Button>}
          </Panel>
        ))}
        {editable && <Button variant="secondary" onClick={() => upd((x) => { x.criteria.push({ id: uid('K', x.criteria.map((y) => y.id)), competencyId: x.competencies[0]?.id ?? 'C1', name: 'Nuevo criterio', description: '', weight: 0, levels: [{ id: 'N1', name: 'Excelente', score: 5, descriptor: '' }, { id: 'N2', name: 'Aceptable', score: 3, descriptor: '' }, { id: 'N3', name: 'Insuficiente', score: 1, descriptor: '' }] }); })}><Plus className="size-4" />Agregar criterio</Button>}
      </div>
    </>
  );
}
