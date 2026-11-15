'use client';
import Link from 'next/link';
import { useSession } from '@/components/session';
import { useApi } from '@/lib/hooks';
import { Badge, Empty, Grade, Loading, PageHead, Panel, StatusBadge } from '@/components/ui';
import { fmtDate, fmtGrade, PROVIDER } from '@/lib/format';

function StaffHome() {
  const stats = useApi<any>('/stats');
  const queue = useApi<any[]>('/evaluations?status=PENDING_REVIEW');
  const settings = useApi<any>('/settings');
  const s = stats.data;
  const n = (st: string) => s?.evaluations.find((e: any) => e.status === st)?.n ?? 0;
  return (
    <>
      <PageHead title="Panel docente" subtitle="Valoraciones pendientes, actividad y estado del motor de evaluación." />
      {s && (
        <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[['Estudiantes', s.students], ['Laboratorios', s.labs], ['Entregas', s.submissions], ['Por revisar', n('PENDING_REVIEW')]].map(([k, v]) => (
            <div key={k} className="bg-card border border-line rounded-lg px-4 py-3"><dt className="text-sm text-muted">{k}</dt><dd className="font-display text-3xl font-semibold num">{v}</dd></div>
          ))}
        </dl>
      )}
      <div className="grid lg:grid-cols-[2fr_1fr] gap-6">
        <Panel title="Pendientes de revisión" actions={<Link className="text-sm text-teal hover:underline" href="/app/evaluaciones">Ver todas</Link>}>
          {queue.loading ? <Loading /> : !queue.data?.length ? <Empty title="No hay valoraciones pendientes">Cuando una evaluación termine aparecerá aquí para que la revises.</Empty> : (
            <ul className="divide-y divide-line">
              {queue.data.slice(0, 8).map((e) => (
                <li key={e.id}><Link href={`/app/evaluaciones/${e.id}`} className="flex items-center justify-between gap-4 py-3 hover:text-teal">
                  <span><span className="font-medium">{e.studentName}</span><span className="block text-sm text-muted">{e.labTitle}</span></span>
                  <span className="text-right"><Grade value={e.preliminaryGrade} /><span className="block text-xs text-muted">preliminar</span></span>
                </Link></li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Motor de evaluación">
          {settings.data && (
            <div className="space-y-3 text-sm">
              <p><span className="text-muted">Proveedor:</span> <span className="font-medium">{PROVIDER[settings.data.ai.provider]}</span></p>
              <p><span className="text-muted">Modelo:</span> <span className="font-medium">{settings.data.ai.model}</span></p>
              {settings.data.ai.provider === 'demo' && <p className="rounded bg-marker-soft px-3 py-2">Estás en modo demo. Configura un modelo real en Administración para evaluaciones con IA.</p>}
              {settings.data.sandbox && <div><p className="text-muted mb-1">Sandbox de código</p><ul className="space-y-0.5">{Object.values(settings.data.sandbox.isolation).map((v: any) => <li key={v}>{v}</li>)}</ul></div>}
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}

function StudentHome() {
  const { user } = useSession();
  const pf = useApi<any>(`/portfolio/${user.id}`);
  const rep = useApi<any>(`/reports/student/${user.id}`);
  return (
    <>
      <PageHead title={`Hola, ${user.name.split(' ')[0]}`} subtitle="Sube tus laboratorios, revisa las valoraciones publicadas y sigue tu plan de fortalecimiento."
        actions={<Link href="/app/entregas/nueva" className="rounded-md bg-teal text-white px-4 py-2 font-medium hover:bg-teal-dark">Nueva entrega</Link>} />
      {rep.data && (
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <div className="bg-card border border-line rounded-lg p-5"><p className="text-sm text-muted">Promedio publicado</p><Grade value={rep.data.summary.average} size="lg" /></div>
          <div className="bg-card border border-line rounded-lg p-5"><p className="text-sm text-muted">Laboratorios evaluados</p><p className="font-display text-5xl font-semibold num">{rep.data.summary.labsEvaluated}<span className="text-xl text-muted">/{rep.data.summary.labsTotal}</span></p></div>
          <div className="bg-card border border-line rounded-lg p-5"><p className="text-sm text-muted">Tendencia</p><p className="font-display text-3xl font-semibold mt-2">{rep.data.summary.trendLabel}</p></div>
        </div>
      )}
      {pf.loading ? <Loading /> : pf.data && (
        <div className="grid lg:grid-cols-2 gap-6">
          {pf.data.cohorts.map((c: any) => (
            <Panel key={c.id} title={c.name}>
              <ul className="divide-y divide-line">
                {c.labs.map((l: any) => (
                  <li key={l.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{l.title}</p>
                      {l.latest ? <StatusBadge status={l.latest.evaluation?.status ?? null} /> : <Badge tone="none">Sin entrega</Badge>}
                    </div>
                    {l.latest ? <Link className="text-right hover:text-teal" href={`/app/entregas/${l.latest.id}`}><Grade value={l.latest.evaluation?.grade} /></Link>
                      : <Link className="text-sm text-teal hover:underline whitespace-nowrap" href={`/app/entregas/nueva?lab=${l.id}`}>Entregar</Link>}
                  </li>
                ))}
              </ul>
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}

export default function Home() {
  const { isStaff } = useSession();
  return isStaff ? <StaffHome /> : <StudentHome />;
}
