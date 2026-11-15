'use client';
import Link from 'next/link';
import { use, useState } from 'react';
import { useApi } from '@/lib/hooks';
import { useSession } from '@/components/session';
import { Empty, ErrorBox, Loading, PageHead, Panel } from '@/components/ui';
import { MindMap } from '@/components/mindmap';

export default function MapPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { isStaff } = useSession();
  const [inc, setInc] = useState(false);
  const m = useApi<any>(`/mindmap/student/${id}${inc ? '?includeUnpublished=true' : ''}`, [inc]);
  return (
    <>
      <PageHead title="Mapa de competencias en IA" subtitle={m.data ? `${m.data.student.name} · Temáticas de las cohortes 1 y 2, sus relaciones y el nivel de dominio alcanzado.` : undefined}
        actions={<>
          {isStaff && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={inc} onChange={(e) => setInc(e.target.checked)} />Incluir valoraciones sin publicar</label>}
          <Link href={`/app/informe/${id}`} className="rounded-md border border-line bg-card px-4 py-2 font-medium hover:border-ink-2">Informe integrado</Link>
        </>} />
      {m.loading && !m.data ? <Loading /> : m.error ? <ErrorBox error={m.error} /> : !m.data.categories.length
        ? <Panel><Empty title="Aún no hay temáticas">Registra laboratorios con sus temáticas y evalúa entregas para construir el mapa.</Empty></Panel>
        : <MindMap key={String(inc)} data={m.data} />}
    </>
  );
}
