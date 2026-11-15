'use client';
import Link from 'next/link';
import { use, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { useSession } from '@/components/session';
import { Badge, Button, ErrorBox, Loading, PageHead, Panel } from '@/components/ui';
import { LabForm } from '@/components/lab-form';
import { fmtDate } from '@/lib/format';

const TEMPLATE = {
  title: 'Rúbrica', competencies: [{ id: 'C1', name: 'Competencia 1', description: '' }],
  criteria: [{ id: 'K1', competencyId: 'C1', name: 'Criterio 1', description: '', weight: 100, levels: [
    { id: 'N1', name: 'Excelente', score: 5, descriptor: '' }, { id: 'N2', name: 'Bueno', score: 4, descriptor: '' },
    { id: 'N3', name: 'Aceptable', score: 3, descriptor: '' }, { id: 'N4', name: 'Insuficiente', score: 1, descriptor: '' }] }],
};

export default function LabPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { isStaff } = useSession();
  const lab = useApi<any>(`/labs/${id}`);
  const rubrics = useApi<any[]>(`/labs/${id}/rubrics`);
  const cohorts = useApi<any[]>('/cohorts');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const file = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const importFile = async (f: File) => {
    setBusy(true); setError(null);
    const form = new FormData(); form.append('file', f);
    try { const r = await api(`/labs/${id}/rubrics/import`, { form }); router.push(`/app/rubricas/${r.id}`); }
    catch (e) { setError(e); setBusy(false); }
  };
  const blank = async () => {
    setBusy(true); setError(null);
    try { const r = await api(`/labs/${id}/rubrics`, { body: { content: TEMPLATE } }); router.push(`/app/rubricas/${r.id}`); }
    catch (e) { setError(e); setBusy(false); }
  };
  if (lab.loading) return <Loading />;
  if (lab.error) return <ErrorBox error={lab.error} />;
  const l = lab.data;
  return (
    <>
      <PageHead title={l.title} subtitle={`${l.cohort?.name} · Laboratorio ${l.order}`}
        actions={<>
          <Link href={`/app/entregas/nueva?lab=${id}`} className="rounded-md border border-line bg-card px-4 py-2 font-medium hover:border-ink-2">Registrar entrega</Link>
          {isStaff && !editing && <Button variant="secondary" onClick={() => setEditing(true)}>Editar laboratorio</Button>}
        </>} />
      <div className="grid lg:grid-cols-[3fr_2fr] gap-6">
        <Panel title="Descripción y objetivos">
          {editing && cohorts.data ? <LabForm cohorts={cohorts.data} initial={l} onSaved={() => { setEditing(false); lab.reload(); }} onCancel={() => setEditing(false)} /> : (
            <div className="space-y-4 max-w-[70ch]">
              <p>{l.description}</p>
              {l.objectives && <div><h3 className="font-semibold mb-1">Objetivos</h3><p className="text-ink-2 whitespace-pre-line">{l.objectives}</p></div>}
              <div><h3 className="font-semibold mb-2">Temáticas de IA</h3><div className="flex flex-wrap gap-1.5">{l.topics.map((t: string) => <Badge key={t}>{t}</Badge>)}</div></div>
            </div>
          )}
        </Panel>
        <Panel title="Rúbricas">
          {rubrics.loading ? <Loading /> : (
            <ul className="divide-y divide-line mb-4">
              {rubrics.data?.map((r) => (
                <li key={r.id}><Link href={`/app/rubricas/${r.id}`} className="flex items-center justify-between py-3 hover:text-teal">
                  <span><span className="font-medium">Versión {r.version}</span><span className="block text-xs text-muted">{fmtDate(r.createdAt)} · {r.extractedBy}</span></span>
                  <span className="flex gap-1.5">
                    {r.issues.filter((i: any) => i.severity === 'error').length > 0 && <Badge tone="low">{r.issues.filter((i: any) => i.severity === 'error').length} errores</Badge>}
                    <Badge tone={r.status === 'PUBLISHED' ? 'high' : r.status === 'DRAFT' ? 'mid' : 'none'}>{{ PUBLISHED: 'Publicada', DRAFT: 'Borrador', ARCHIVED: 'Archivada' }[r.status as string]}</Badge>
                  </span>
                </Link></li>
              ))}
              {!rubrics.data?.length && <li className="py-3 text-muted">Aún no hay rúbricas para este laboratorio.</li>}
            </ul>
          )}
          {isStaff && (
            <div className="space-y-2">
              <input ref={file} type="file" hidden accept=".pdf,.docx,.txt,.md,.json,.csv" onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
              <Button className="w-full" loading={busy} onClick={() => file.current?.click()}>Importar rúbrica (PDF, DOCX, JSON o CSV)</Button>
              <Button className="w-full" variant="secondary" disabled={busy} onClick={blank}>Crear rúbrica desde cero</Button>
              <p className="text-xs text-muted">PDF y DOCX se interpretan con el modelo de IA configurado. CSV: columnas competencia;criterio;descripcion;peso;nivel;valor;descriptor.</p>
              <ErrorBox error={error} />
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
