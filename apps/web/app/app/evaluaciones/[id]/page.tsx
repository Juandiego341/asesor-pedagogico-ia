'use client';
import Link from 'next/link';
import { use, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, CircleDashed, XCircle, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { useSession } from '@/components/session';
import { Badge, Button, ErrorBox, Grade, Loading, PageHead, Panel, Select, StatusBadge, Textarea, cx } from '@/components/ui';
import { fmtDate, fmtGrade, PROVIDER } from '@/lib/format';

const CITE: Record<string, { icon: any; label: string; cls: string }> = {
  verificada: { icon: CheckCircle2, label: 'Cita verificada', cls: 'text-teal-dark' },
  parcial: { icon: CircleDashed, label: 'Coincidencia parcial', cls: 'text-mid' },
  no_encontrada: { icon: XCircle, label: 'No se encontró en el material', cls: 'text-low' },
};
const SRC: Record<string, string> = { informe: 'Informe', codigo: 'Código', verificacion: 'Verificación técnica', imagen: 'Imagen', otro: 'Otro' };

export default function EvaluationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { isStaff } = useSession();
  const ev = useApi<any>(`/evaluations/${id}`);
  const [levels, setLevels] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState('');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const e = ev.data;
  const running = e && ['QUEUED', 'RUNNING'].includes(e.status);
  useEffect(() => { if (!running) return; const t = setInterval(() => ev.reload(), 3000); return () => clearInterval(t); }, [running, ev.reload]);
  useEffect(() => {
    if (!e?.aiOutput) return;
    const base = Object.fromEntries(e.aiOutput.criteria.map((c: any) => [c.criterionId, c.levelId]));
    setLevels({ ...base, ...(e.teacherOverrides?.levels ?? {}) });
    setFeedback(e.teacherOverrides?.feedback ?? e.aiOutput.feedback);
    setComment(e.teacherComment ?? '');
  }, [e]);
  const rubric = e?.rubricSnapshot;
  // Vista previa local del cálculo (el servidor recalcula al guardar)
  const preview = useMemo(() => {
    if (!rubric) return null;
    const sum = rubric.criteria.reduce((s: number, c: any) => s + (c.weight / 100) * (c.levels.find((l: any) => l.id === levels[c.id])?.score ?? 0), 0);
    return Math.round(Math.min(5, sum) * 10) / 10;
  }, [rubric, levels]);

  if (ev.loading && !e) return <Loading />;
  if (ev.error) return <ErrorBox error={ev.error} />;
  if (e.hidden) return (<><PageHead title="Evaluación en revisión" /><Panel><p>{e.message}</p><p className="text-sm text-muted mt-2">Estado: <StatusBadge status={e.status} /></p></Panel></>);
  if (running) return (<><PageHead title={e.lab.title} subtitle={e.student.name} /><Panel><Loading label={e.status === 'QUEUED' ? 'En cola para evaluación…' : 'Analizando evidencias, verificando el código y valorando criterios…'} /></Panel></>);

  const out = e.aiOutput;
  const cc = e.citationCheck;
  const ver = e.verification;
  const editable = isStaff && ['PENDING_REVIEW', 'APPROVED'].includes(e.status);
  const original = out ? Object.fromEntries(out.criteria.map((c: any) => [c.criterionId, c.levelId])) : {};
  const changed = Object.entries(levels).filter(([k, v]) => original[k] !== v && !(e.teacherOverrides?.levels?.[k] === v)).length > 0
    || feedback !== (e.teacherOverrides?.feedback ?? out?.feedback) || comment !== (e.teacherComment ?? '');
  const act = async (name: string, fn: () => Promise<any>, msg: string) => {
    setBusy(name); setError(null); setNotice(null);
    try { await fn(); await ev.reload(); setNotice(msg); } catch (err) { setError(err); } finally { setBusy(null); }
  };
  const overridesOnly = () => Object.fromEntries(Object.entries(levels).filter(([k, v]) => original[k] !== v));
  const save = () => api(`/evaluations/${id}/review`, { body: { levels: overridesOnly(), feedback, teacherComment: comment } });
  const approve = (publish: boolean) => act(publish ? 'publish' : 'approve', async () => { if (changed) await save(); await api(`/evaluations/${id}/approve`, { body: { publish } }); }, publish ? 'Valoración publicada. El estudiante ya puede verla.' : 'Valoración aprobada.');
  const trace = async () => {
    const t = await api(`/evaluations/${id}/trace`);
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(t, null, 2)], { type: 'application/json' })); a.download = `trazabilidad-${id}.json`; a.click();
  };

  return (
    <>
      <PageHead title={e.lab.title}
        subtitle={<><Link className="text-teal hover:underline" href={`/app/entregas/${e.submissionId}`}>Entrega de {e.student.name}</Link> · {fmtDate(e.createdAt)}</>}
        actions={isStaff && <>
          {editable && <Button variant="secondary" disabled={!changed} loading={busy === 'save'} onClick={() => act('save', save, 'Ajustes guardados.')}>Guardar ajustes</Button>}
          {e.status === 'PENDING_REVIEW' && <Button variant="secondary" loading={busy === 'approve'} onClick={() => approve(false)}>Aprobar</Button>}
          {editable && <Button loading={busy === 'publish'} onClick={() => approve(true)}>Aprobar y publicar</Button>}
          {['APPROVED', 'PUBLISHED'].includes(e.status) && <Button variant="secondary" loading={busy === 'reopen'} onClick={() => act('reopen', () => api(`/evaluations/${id}/reopen`, { method: 'POST' }), 'Evaluación reabierta para revisión.')}>Reabrir</Button>}
          {e.status === 'FAILED' && <Button loading={busy === 'retry'} onClick={() => act('retry', () => api(`/evaluations/${id}/retry`, { method: 'POST' }), 'Evaluación reenviada.')}>Reintentar</Button>}
          {out && <Button variant="ghost" onClick={trace}>Descargar trazabilidad</Button>}
        </>} />
      <ErrorBox error={error} />
      {notice && <p role="status" className="mb-4 rounded-md bg-teal-soft text-teal-dark px-4 py-2 text-sm">{notice}</p>}
      {e.status === 'FAILED' && <Panel title="La evaluación falló" className="mb-6"><p className="text-low text-sm whitespace-pre-wrap">{e.error}</p><p className="text-sm text-muted mt-2">Revisa la configuración del modelo en Administración y reintenta.</p></Panel>}

      {out && rubric && (
        <>
          <div className="grid md:grid-cols-[auto_1fr] gap-6 mb-6">
            <div className="bg-card border border-line rounded-lg p-5 min-w-[240px]">
              <StatusBadge status={e.status} />
              <div className="mt-3 flex items-end gap-6">
                <div><p className="text-sm text-muted">{editable && changed ? 'Vista previa' : e.finalGrade !== null ? 'Nota final' : 'Nota preliminar'}</p><Grade value={editable && changed ? preview : e.finalGrade ?? e.preliminaryGrade} size="lg" /></div>
                {e.finalGrade !== null && e.finalGrade !== e.preliminaryGrade && <div className="pb-1"><p className="text-xs text-muted">Sugerida por IA</p><p className="num text-lg text-muted line-through">{fmtGrade(e.preliminaryGrade)}</p></div>}
              </div>
              <p className="text-xs text-muted mt-3">Calculada por el servidor: Σ ponderación × valor del nivel.</p>
            </div>
            <div className="bg-card border border-line rounded-lg p-5">
              <p className="font-semibold mb-2">Confiabilidad de la valoración</p>
              <p className="text-sm text-ink-2"><span className="num font-medium">{cc.verified}</span> citas verificadas, <span className="num font-medium">{cc.partial}</span> parciales y <span className="num font-medium">{cc.missing}</span> no encontradas de {cc.total}.</p>
              {cc.flags?.length > 0 ? <ul className="mt-3 space-y-1 text-sm">{cc.flags.map((f: string) => <li key={f} className="flex gap-2"><AlertTriangle className="size-4 text-mid shrink-0 mt-0.5" />{f}</li>)}</ul>
                : <p className="mt-3 text-sm text-teal-dark flex gap-2"><ShieldCheck className="size-4 mt-0.5" />Todas las valoraciones tienen evidencia verificable.</p>}
            </div>
          </div>

          <Panel title="Desglose por criterio" className="mb-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted"><tr><th className="pb-2 pr-3">Criterio</th><th className="pb-2 pr-3 text-right">Peso</th><th className="pb-2 pr-3">Nivel</th><th className="pb-2 pr-3 text-right">Valor</th><th className="pb-2 text-right">Aporte</th></tr></thead>
                <tbody>
                  {rubric.criteria.map((c: any) => {
                    const lvl = c.levels.find((l: any) => l.id === levels[c.id]);
                    const adj = original[c.id] !== levels[c.id];
                    return (
                      <tr key={c.id} className="border-t border-line">
                        <td className="py-2 pr-3 font-medium">{c.name}</td>
                        <td className="py-2 pr-3 text-right num">{c.weight} %</td>
                        <td className="py-2 pr-3 min-w-[180px]">{editable ? (
                          <Select value={levels[c.id] ?? ''} onChange={(ev2) => setLevels({ ...levels, [c.id]: ev2.target.value })} className={cx('py-1', adj && 'border-mid')} aria-label={`Nivel para ${c.name}`}>
                            {c.levels.map((l: any) => <option key={l.id} value={l.id}>{l.name} ({fmtGrade(l.score)}){l.id === original[c.id] ? ' · sugerido' : ''}</option>)}
                          </Select>) : <>{lvl?.name}{adj && <Badge tone="mid">ajustado</Badge>}</>}</td>
                        <td className="py-2 pr-3 text-right num">{fmtGrade(lvl?.score)}</td>
                        <td className="py-2 text-right num">{((c.weight / 100) * (lvl?.score ?? 0)).toFixed(2).replace('.', ',')}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>

          <div className="space-y-4 mb-6">
            {out.criteria.map((c: any) => {
              const rc = rubric.criteria.find((k: any) => k.id === c.criterionId);
              const items = cc.perCriterion.find((p: any) => p.criterionId === c.criterionId)?.items ?? [];
              const lvl = rc?.levels.find((l: any) => l.id === c.levelId);
              return (
                <Panel key={c.criterionId} title={rc?.name} actions={<span className="text-sm text-muted">Sugerido: <span className="font-medium text-ink">{lvl?.name}</span> · confianza {Math.round(c.confidence * 100)} %</span>}>
                  <p className="max-w-[75ch]">{c.justification}</p>
                  {lvl && <p className="text-sm text-muted mt-2">Descriptor del nivel: {lvl.descriptor}</p>}
                  {items.length > 0 && (
                    <ul className="mt-4 space-y-3">
                      {items.map((it: any, k: number) => { const s = CITE[it.status]; return (
                        <li key={k} className="border-l-2 border-marker pl-3">
                          <p className="text-[15px] text-ink-2">«<span className={it.status === 'verificada' ? 'marker' : ''}>{it.quote}</span>»</p>
                          <p className={cx('text-xs mt-1 flex items-center gap-1', s.cls)}><s.icon className="size-3.5" />{s.label} · {SRC[it.source] ?? it.source}, {it.location}</p>
                        </li>
                      ); })}
                    </ul>
                  )}
                  {(c.strengths.length > 0 || c.weaknesses.length > 0) && (
                    <div className="grid sm:grid-cols-2 gap-4 mt-4 text-sm">
                      {c.strengths.length > 0 && <div><p className="font-medium text-teal-dark mb-1">Fortalezas</p><ul className="list-disc ml-5 space-y-0.5">{c.strengths.map((x: string) => <li key={x}>{x}</li>)}</ul></div>}
                      {c.weaknesses.length > 0 && <div><p className="font-medium text-low mb-1">Por mejorar</p><ul className="list-disc ml-5 space-y-0.5">{c.weaknesses.map((x: string) => <li key={x}>{x}</li>)}</ul></div>}
                    </div>
                  )}
                </Panel>
              );
            })}
          </div>

          <div className="grid lg:grid-cols-2 gap-6 mb-6">
            <Panel title="Qué aprendiste y cómo lo aplicaste">
              {out.learned.length > 0 && <ul className="list-disc ml-5 space-y-1 mb-3">{out.learned.map((x: string) => <li key={x}>{x}</li>)}</ul>}
              <p className="text-ink-2">{out.applied}</p>
              {out.toStrengthen.length > 0 && <><p className="font-semibold mt-4 mb-1">Por fortalecer</p><ul className="list-disc ml-5 space-y-1">{out.toStrengthen.map((x: string) => <li key={x}>{x}</li>)}</ul></>}
            </Panel>
            <Panel title="Retroalimentación">
              {editable ? <Textarea rows={8} value={feedback} onChange={(x) => setFeedback(x.target.value)} aria-label="Retroalimentación para el estudiante" /> : <p className="whitespace-pre-line">{e.teacherOverrides?.feedback ?? out.feedback}</p>}
              {isStaff && editable ? <div className="mt-3"><p className="text-sm font-medium mb-1">Comentario del docente</p><Textarea rows={3} value={comment} onChange={(x) => setComment(x.target.value)} /></div>
                : e.teacherComment && <div className="mt-4 rounded bg-paper p-3 text-sm"><p className="font-medium">Comentario del docente{e.reviewer ? ` (${e.reviewer})` : ''}</p><p>{e.teacherComment}</p></div>}
            </Panel>
          </div>

          <Panel title="Recomendaciones de mejoramiento" className="mb-6">
            <ul className="grid md:grid-cols-2 gap-4">
              {out.recommendations.map((r: any) => (
                <li key={r.title} className="border border-line rounded-md p-4">
                  <div className="flex items-start justify-between gap-2"><p className="font-medium">{r.title}</p><Badge tone={r.priority === 'alta' ? 'low' : r.priority === 'media' ? 'mid' : 'neutral'}>Prioridad {r.priority}</Badge></div>
                  <p className="text-sm text-ink-2 mt-1">{r.detail}</p>
                  {r.resources.length > 0 && <p className="text-xs text-muted mt-2">Recursos: {r.resources.join(' · ')}</p>}
                </li>
              ))}
            </ul>
          </Panel>
        </>
      )}

      {ver && (
        <Panel title="Verificación técnica del código" className="mb-6" actions={<Badge tone={ver.score.label.includes('satisfactoria') ? 'high' : 'mid'}>{ver.score.label}</Badge>}>
          <div className="grid md:grid-cols-3 gap-6 text-sm">
            <div><p className="font-semibold mb-1">Inventario</p><p>{ver.inventory.files} archivos · {ver.inventory.lines} líneas</p>
              <p className="text-muted">{Object.entries(ver.inventory.byLanguage).map(([k, v]: any) => `${k} (${v.files})`).join(', ')}</p>
              <p className="mt-1">README: {ver.inventory.hasReadme ? 'sí' : 'no'} · Dependencias: {ver.inventory.hasDependencies ? 'sí' : 'no'}</p></div>
            <div><p className="font-semibold mb-1">Sintaxis y análisis estático</p><p>{ver.syntax.passed}/{ver.syntax.checked} archivos sin errores</p>
              {ver.syntax.errors.map((x: any) => <p key={x.path} className="text-low">{x.path}: {x.error}</p>)}
              <p>{ver.staticAnalysis.functions} funciones · {ver.staticAnalysis.classes} clases · {Math.round(ver.staticAnalysis.documentedRatio * 100)} % documentadas</p>
              {ver.staticAnalysis.aiLibraries.length > 0 && <p className="text-muted">Librerías: {ver.staticAnalysis.aiLibraries.join(', ')}</p>}</div>
            <div><p className="font-semibold mb-1">Pruebas unitarias</p>
              {ver.tests.ran ? <p>{ver.tests.framework}: <span className="text-teal-dark">{ver.tests.passed} aprobadas</span>, <span className={ver.tests.failed ? 'text-low' : ''}>{ver.tests.failed} fallidas</span></p> : <p className="text-muted">{ver.tests.note}</p>}
              {ver.security.findings.length > 0 && <p className="text-low mt-1">Posibles secretos: {ver.security.findings.map((f: any) => `${f.path}:${f.line}`).join(', ')}</p>}</div>
          </div>
          {ver.tests.output && <details className="mt-4"><summary className="cursor-pointer text-sm text-teal">Ver salida de las pruebas</summary><pre className="mt-2 bg-ink text-white/90 text-xs p-3 rounded overflow-x-auto whitespace-pre-wrap">{ver.tests.output}</pre></details>}
          <p className="text-xs text-muted mt-4">Entorno aislado: {Object.values(ver.isolation).join(' · ')}</p>
        </Panel>
      )}

      {isStaff && out && (
        <Panel title="Trazabilidad">
          <dl className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3 text-sm">
            {[
              ['Modelo', `${PROVIDER[e.provider] ?? e.provider} · ${e.model}`], ['Versión del prompt', e.promptVersion], ['Versión de rúbrica', `v${e.rubricVersion}`],
              ['Intentos del modelo', e.usage?.attempts], ['Tokens (entrada / salida)', e.usage?.input ? `${e.usage.input} / ${e.usage.output}` : 'no aplica'], ['Duración', e.durationMs ? `${(e.durationMs / 1000).toFixed(1)} s` : '—'],
              ['Revisado por', e.reviewer ?? 'pendiente'], ['Fecha de revisión', fmtDate(e.reviewedAt)], ['Publicado', fmtDate(e.publishedAt)],
            ].map(([k, v]) => <div key={k as string}><dt className="text-muted">{k}</dt><dd className="font-medium">{v ?? '—'}</dd></div>)}
          </dl>
          <p className="font-medium text-sm mt-4 mb-1">Evidencias analizadas</p>
          <ul className="text-xs text-muted space-y-0.5">{e.evidenceManifest.map((f: any) => <li key={f.id}>{f.filename} · SHA-256 {f.sha256}</li>)}</ul>
          {e.usage?.truncatedCode?.length > 0 && <p className="text-xs text-mid mt-2">Archivos recortados o excluidos por longitud: {e.usage.truncatedCode.join(', ')}</p>}
        </Panel>
      )}
    </>
  );
}
