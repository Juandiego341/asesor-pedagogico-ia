'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApi } from '@/lib/hooks';
import { useSession } from '@/components/session';
import { Badge, Button, ErrorBox, Loading, PageHead, Panel } from '@/components/ui';
import { LabForm } from '@/components/lab-form';

export default function Labs() {
  const { isStaff } = useSession();
  const { data, error, loading } = useApi<any[]>('/cohorts');
  const [creating, setCreating] = useState(false);
  const router = useRouter();
  return (
    <>
      <PageHead title="Laboratorios y rúbricas" subtitle="Cada laboratorio tiene su descripción, objetivos, temáticas y una rúbrica versionada. Solo se evalúa con rúbricas publicadas."
        actions={isStaff && !creating && <Button onClick={() => setCreating(true)}>Nuevo laboratorio</Button>} />
      {creating && data && <Panel title="Nuevo laboratorio" className="mb-6"><LabForm cohorts={data} onSaved={(l) => router.push(`/app/laboratorios/${l.id}`)} onCancel={() => setCreating(false)} /></Panel>}
      {loading && <Loading />}<ErrorBox error={error} />
      <div className="space-y-8">
        {data?.map((c) => (
          <section key={c.id}>
            <h2 className="text-xl font-semibold mb-3">{c.name} <span className="text-muted font-normal text-base">{c.period}</span></h2>
            <ul className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {c.labs.map((l: any) => (
                <li key={l.id}>
                  <Link href={`/app/laboratorios/${l.id}`} className="block h-full bg-card border border-line rounded-lg p-4 hover:border-teal">
                    <p className="font-display font-semibold leading-snug">{l.title}</p>
                    <p className="text-sm text-muted mt-2 line-clamp-2">{l.description}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {l.publishedRubric ? <Badge tone="high">Rúbrica v{l.publishedRubric.version} publicada</Badge> : <Badge tone="low">Sin rúbrica publicada</Badge>}
                      {l.draftRubric && <Badge tone="mid">Borrador v{l.draftRubric.version}</Badge>}
                    </div>
                  </Link>
                </li>
              ))}
              {!c.labs.length && <li className="text-muted">Este corte aún no tiene laboratorios.</li>}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
