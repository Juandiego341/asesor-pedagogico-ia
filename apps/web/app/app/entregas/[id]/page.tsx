'use client';
import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { useSession } from '@/components/session';
import { Button, ErrorBox, Grade, Loading, PageHead, Panel, StatusBadge } from '@/components/ui';
import { fmtDate, PROVIDER } from '@/lib/format';

const KIND: Record<string, string> = { REPORT_PDF: 'Informe PDF', CODE_ZIP: 'Código fuente', IMAGE: 'Imagen', SLIDES: 'Presentación', VIDEO: 'Video', OTHER: 'Anexo' };

export default function SubmissionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { isStaff } = useSession();
  const s = useApi<any>(`/submissions/${id}`);
  const settings = useApi<any>('/settings');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const router = useRouter();
  const running = s.data?.evaluations.some((e: any) => e.status === 'QUEUED' || e.status === 'RUNNING');
  useEffect(() => { if (!running) return; const t = setInterval(() => s.reload(), 3000); return () => clearInterval(t); }, [running, s.reload]);
  if (s.loading && !s.data) return <Loading />;
  if (s.error) return <ErrorBox error={s.error} />;
  const d = s.data;
  const evaluate = async () => { setBusy(true); setError(null); try { await api(`/submissions/${id}/evaluate`, { method: 'POST' }); s.reload(); } catch (e) { setError(e); } finally { setBusy(false); } };
  const remove = async () => { if (!confirm('¿Eliminar esta entrega y sus evaluaciones?')) return; try { await api(`/submissions/${id}`, { method: 'DELETE' }); router.push(`/app/portafolio/${d.studentId}`); } catch (e) { setError(e); } };
  const canEvaluate = isStaff || settings.data?.policy?.studentsCanEvaluate;
  return (
    <>
      <PageHead title={d.lab.title} subtitle={<>Entrega de <Link className="text-teal hover:underline" href={`/app/portafolio/${d.studentId}`}>{d.student.name}</Link> · {fmtDate(d.createdAt)} · Rúbrica v{d.rubric.version}</>}
        actions={<>
          {canEvaluate && <Button loading={busy} disabled={running} onClick={evaluate}>{d.evaluations.length ? 'Evaluar de nuevo' : 'Evaluar con IA'}</Button>}
          <Button variant="danger" onClick={remove}>Eliminar entrega</Button>
        </>} />
      <ErrorBox error={error} />
      <div className="grid lg:grid-cols-[2fr_3fr] gap-6 mt-2">
        <Panel title="Evidencias">
          <ul className="space-y-3">
            {d.files.map((f: any) => (
              <li key={f.id} className="text-sm">
                <a href={`/api/files/${f.id}`} className="font-medium hover:text-teal break-all">{f.filename}</a>
                <p className="text-muted">{KIND[f.kind]} · {(f.size / 1024).toFixed(0)} KB{f.meta?.pages ? ` · ${f.meta.pages} páginas` : ''}{f.meta?.files ? ` · ${f.meta.files} archivos de código` : ''}</p>
                {f.meta?.source === 'github' && <p className="text-muted break-all">{f.meta.url} · commit {f.meta.commit?.slice(0, 10) ?? f.meta.ref}</p>}
                <p className="text-xs text-muted break-all">SHA-256 {f.sha256.slice(0, 24)}…</p>
              </li>
            ))}
          </ul>
          {d.notes && <p className="mt-4 text-sm"><span className="font-medium">Notas:</span> {d.notes}</p>}
        </Panel>
        <Panel title="Evaluaciones">
          {!d.evaluations.length ? <p className="text-muted">Aún no se ha solicitado una evaluación.</p> : (
            <ul className="divide-y divide-line">
              {d.evaluations.map((e: any) => (
                <li key={e.id}>
                  <Link href={`/app/evaluaciones/${e.id}`} className="flex items-center justify-between gap-4 py-3 hover:text-teal">
                    <span>
                      <StatusBadge status={e.status} />
                      <span className="block text-sm text-muted mt-1">{fmtDate(e.createdAt)} · {PROVIDER[e.provider] ?? e.provider} · {e.model}</span>
                      {e.status === 'FAILED' && isStaff && <span className="block text-xs text-low mt-1">{e.error?.slice(0, 160)}</span>}
                    </span>
                    <Grade value={e.finalGrade ?? e.preliminaryGrade} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {running && <p className="text-sm text-muted mt-3">La evaluación corre en segundo plano. Esta página se actualiza sola.</p>}
          {!isStaff && <p className="text-sm text-muted mt-3">Verás la nota y la retroalimentación cuando tu docente apruebe y publique la valoración.</p>}
        </Panel>
      </div>
    </>
  );
}
