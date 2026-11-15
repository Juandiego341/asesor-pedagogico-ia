'use client';
import Link from 'next/link';
import { use, useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { useSession } from '@/components/session';
import { Badge, Bar, Button, Empty, ErrorBox, Grade, Loading, PageHead, Panel, StatusBadge } from '@/components/ui';
import { fmtDate, fmtGrade } from '@/lib/format';

export default function Report({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { isStaff } = useSession();
  const [inc, setInc] = useState(false);
  const q = inc ? '?includeUnpublished=true' : '';
  const r = useApi<any>(`/reports/student/${id}${q}`, [inc]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  if (r.loading && !r.data) return <Loading />;
  if (r.error) return <ErrorBox error={r.error} />;
  const d = r.data;
  const plan = async () => { setBusy(true); setError(null); try { await api(`/reports/student/${id}/plan${q}`, { method: 'POST' }); await r.reload(); } catch (e) { setError(e); } finally { setBusy(false); } };
  const series = d.labs.filter((l: any) => l.grade !== null).map((l: any) => ({ name: `L${l.order}`, title: l.title, nota: l.grade, cohorte: l.cohort }));
  return (
    <>
      <PageHead title="Informe integrado del aprendizaje" subtitle={`${d.student.name} · Cohortes 1 y 2 · Generado ${fmtDate(d.generatedAt)}`}
        actions={<>
          {isStaff && <label className="flex items-center gap-2 text-sm mr-2"><input type="checkbox" checked={inc} onChange={(e) => setInc(e.target.checked)} />Incluir valoraciones sin publicar</label>}
          <Link href={`/app/mapa/${id}`} className="rounded-md border border-line bg-card px-4 py-2 font-medium hover:border-ink-2">Mapa de competencias</Link>
          <a href={`/api/reports/student/${id}/pdf${q}`} className="rounded-md bg-teal text-white px-4 py-2 font-medium hover:bg-teal-dark">Descargar PDF</a>
        </>} />
      {inc && <p className="mb-4 rounded-md bg-marker-soft px-4 py-2 text-sm">Este informe incluye valoraciones que el docente aún no ha publicado.</p>}

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-card border border-line rounded-lg p-5"><p className="text-sm text-muted">Promedio general</p><Grade value={d.summary.average} size="lg" /></div>
        <div className="bg-card border border-line rounded-lg p-5"><p className="text-sm text-muted">Laboratorios evaluados</p><p className="font-display text-5xl font-semibold num">{d.summary.labsEvaluated}<span className="text-xl text-muted">/{d.summary.labsTotal}</span></p></div>
        {d.byCohort.map((c: any) => <div key={c.cohort} className="bg-card border border-line rounded-lg p-5"><p className="text-sm text-muted">{c.name}</p><Grade value={c.average} size="lg" /><p className="text-xs text-muted">{c.evaluated} de {c.total} laboratorios</p></div>)}
      </div>

      <div className="grid lg:grid-cols-[3fr_2fr] gap-6 mb-6">
        <Panel title={`Evolución del aprendizaje · ${d.summary.trendLabel}`}>
          {series.length ? (
            <div className="h-64" role="img" aria-label="Gráfica de notas por laboratorio">
              <ResponsiveContainer>
                <LineChart data={series} margin={{ top: 10, right: 16, left: -16, bottom: 0 }}>
                  <CartesianGrid stroke="#dde3ea" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#5b6b7f' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} tick={{ fontSize: 12, fill: '#5b6b7f' }} axisLine={false} tickLine={false} />
                  <ReferenceLine y={3} stroke="#a16207" strokeDasharray="4 4" />
                  <Tooltip formatter={(v: any) => [fmtGrade(Number(v)), 'Nota']} labelFormatter={(_, p: any) => p?.[0]?.payload?.title ?? ''} />
                  <Line type="monotone" dataKey="nota" stroke="#0e7c6b" strokeWidth={2.5} dot={{ r: 4, fill: '#0e7c6b' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : <Empty title="Sin valoraciones publicadas">La evolución aparecerá cuando haya laboratorios evaluados.</Empty>}
        </Panel>
        <Panel title="Valoraciones por laboratorio">
          <ul className="divide-y divide-line">
            {d.labs.map((l: any) => (
              <li key={l.labId} className="py-2.5 flex items-center justify-between gap-3">
                <span className="min-w-0"><span className="block truncate text-sm font-medium">{l.title}</span><span className="text-xs text-muted">Cohorte {l.cohort}</span></span>
                <span className="flex items-center gap-3">{l.status && !l.validated && <StatusBadge status={l.status} />}{l.evaluationId ? <Link href={`/app/evaluaciones/${l.evaluationId}`}><Grade value={l.grade} /></Link> : <span className="text-sm text-muted">Sin evaluar</span>}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel title="Competencias desarrolladas y nivel de dominio" className="mb-6">
        {!d.competencies.length ? <p className="text-muted">Sin datos aún.</p> : (
          <ul className="space-y-4">
            {d.competencies.map((c: any) => (
              <li key={c.name} className="grid md:grid-cols-[260px_1fr_150px] gap-3 items-center">
                <span className="font-medium">{c.name}</span>
                <Bar value={c.score} />
                <span className="text-sm"><span className="num font-semibold">{fmtGrade(c.score)}</span> · {c.level}</span>
                <span className="md:col-span-3 text-xs text-muted -mt-2">Evidenciada en {c.labs.length} laboratorio(s): {c.labs.join(' · ')}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <Panel title="Conocimientos adquiridos">
          {d.learned.length ? <ul className="space-y-2">{d.learned.map((x: any) => <li key={x.text}><span>{x.text}</span><span className="block text-xs text-muted">{x.labs.join(' · ')}</span></li>)}</ul> : <p className="text-muted">Sin datos aún.</p>}
        </Panel>
        <Panel title="Brechas identificadas">
          {d.gaps.length > 0 && <ul className="space-y-2 mb-4">{d.gaps.map((g: any) => <li key={g.competency} className="flex justify-between gap-3"><span className="font-medium">{g.competency}</span><Badge tone="low">{fmtGrade(g.score)} · {g.level}</Badge></li>)}</ul>}
          {d.lowCriteria.length > 0 && <><p className="text-sm font-medium mb-1">Criterios con valor menor a 3,0</p><ul className="text-sm space-y-1">{d.lowCriteria.map((x: any, i: number) => <li key={i}>{x.criterion} <span className="text-muted">({x.lab}: {x.level})</span></li>)}</ul></>}
          {d.toStrengthen.length > 0 && <><p className="text-sm font-medium mt-4 mb-1">Señalados para fortalecer</p><ul className="text-sm list-disc ml-5 space-y-0.5">{d.toStrengthen.map((x: any) => <li key={x.text}>{x.text}</li>)}</ul></>}
          {!d.gaps.length && !d.lowCriteria.length && !d.toStrengthen.length && <p className="text-muted">No se identificaron brechas significativas.</p>}
        </Panel>
      </div>

      <Panel title="Plan personalizado de fortalecimiento" actions={<Button size="sm" loading={busy} onClick={plan}>{d.plan ? 'Actualizar plan' : 'Generar plan'}</Button>}>
        <ErrorBox error={error} />
        {d.plan ? (
          <div className="space-y-4">
            <p className="max-w-[75ch]">{d.plan.summary}</p>
            <p className="max-w-[75ch] text-ink-2">{d.plan.evolution}</p>
            <ol className="grid md:grid-cols-2 gap-4">
              {d.plan.goals.map((g: any, i: number) => (
                <li key={i} className="border border-line rounded-md p-4">
                  <p className="font-display font-semibold">{i + 1}. {g.competency}</p>
                  <p className="text-xs text-muted mb-2">Nivel actual: {g.currentLevel} · Plazo: {g.timeframe}</p>
                  <p className="text-sm">{g.objective}</p>
                  <ul className="text-sm list-disc ml-5 mt-2 space-y-0.5">{g.actions.map((a: string) => <li key={a}>{a}</li>)}</ul>
                  <p className="text-xs text-muted mt-2">Indicador: {g.indicator}</p>
                </li>
              ))}
            </ol>
            <p className="text-xs text-muted">Generado {fmtDate(d.plan.createdAt)} con {d.plan.provider} · {d.plan.model}</p>
          </div>
        ) : (
          <div>
            <p className="text-muted mb-3">Genera el plan a partir de los resultados consolidados. Mientras tanto, estas son las recomendaciones prioritarias:</p>
            <ul className="space-y-2">{d.recommendations.slice(0, 6).map((x: any, i: number) => <li key={i}><Badge tone={x.priority === 'alta' ? 'low' : 'mid'}>{x.priority}</Badge> <span className="font-medium">{x.title}</span> <span className="text-sm text-muted">({x.lab})</span></li>)}</ul>
          </div>
        )}
      </Panel>
    </>
  );
}
