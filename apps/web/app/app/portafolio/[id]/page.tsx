'use client';
import Link from 'next/link';
import { use } from 'react';
import { FileText, FileArchive, GitBranch, Image as Img } from 'lucide-react';
import { useApi } from '@/lib/hooks';
import { Badge, ErrorBox, Grade, Loading, PageHead, StatusBadge } from '@/components/ui';
import { fmtDate } from '@/lib/format';

const icon = (f: any) => f.kind === 'REPORT_PDF' ? FileText : f.kind === 'CODE_ZIP' ? (f.meta?.source === 'github' ? GitBranch : FileArchive) : Img;

export default function Portfolio({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, error, loading } = useApi<any>(`/portfolio/${id}`);
  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  return (
    <>
      <PageHead title={`Portafolio de ${data.student.name}`} subtitle={`${data.student.studentCode ? `Código ${data.student.studentCode} · ` : ''}Evidencias por cohorte y laboratorio, con la versión de rúbrica asociada a cada entrega.`}
        actions={<>
          <Link href={`/app/informe/${id}`} className="rounded-md border border-line bg-card px-4 py-2 font-medium hover:border-ink-2">Informe integrado</Link>
          <Link href={`/app/entregas/nueva?student=${id}`} className="rounded-md bg-teal text-white px-4 py-2 font-medium hover:bg-teal-dark">Nueva entrega</Link>
        </>} />
      <div className="space-y-10">
        {data.cohorts.map((c: any) => (
          <section key={c.id}>
            <h2 className="text-xl font-semibold mb-3">{c.name}</h2>
            <div className="bg-card border border-line rounded-lg divide-y divide-line">
              {c.labs.map((l: any) => (
                <div key={l.id} className="p-4 grid md:grid-cols-[1fr_auto] gap-4 items-center">
                  <div className="min-w-0">
                    <p className="font-medium">{l.title}</p>
                    {l.latest ? (
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-2">
                        <span className="text-muted">{fmtDate(l.latest.createdAt)}{l.submissions > 1 ? ` · ${l.submissions} entregas` : ''}</span>
                        {l.latest.files.map((f: any) => { const I = icon(f); return <a key={f.id} href={`/api/files/${f.id}`} className="inline-flex items-center gap-1 hover:text-teal"><I className="size-4" />{f.filename}</a>; })}
                      </div>
                    ) : <p className="text-sm text-muted mt-1">Sin entrega registrada.</p>}
                  </div>
                  <div className="flex items-center gap-4 md:justify-end">
                    {l.latest ? <>
                      <StatusBadge status={l.latest.evaluation?.status ?? null} />
                      <Grade value={l.latest.evaluation?.grade} />
                      <Link href={`/app/entregas/${l.latest.id}`} className="text-sm text-teal font-medium hover:underline">Abrir</Link>
                    </> : <Link href={`/app/entregas/nueva?lab=${l.id}&student=${id}`} className="text-sm text-teal font-medium hover:underline">Registrar entrega</Link>}
                  </div>
                </div>
              ))}
              {!c.labs.length && <p className="p-4 text-muted">Sin laboratorios.</p>}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
