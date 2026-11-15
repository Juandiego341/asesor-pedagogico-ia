'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useApi } from '@/lib/hooks';
import { cx, Empty, ErrorBox, Grade, Loading, PageHead, StatusBadge } from '@/components/ui';
import { fmtDate } from '@/lib/format';

const TABS = [['PENDING_REVIEW', 'Por revisar'], ['APPROVED', 'Aprobadas'], ['PUBLISHED', 'Publicadas'], ['FAILED', 'Fallidas'], ['', 'Todas']];

export default function Evaluations() {
  const [tab, setTab] = useState('PENDING_REVIEW');
  const { data, error, loading } = useApi<any[]>(`/evaluations${tab ? `?status=${tab}` : ''}`, [tab]);
  return (
    <>
      <PageHead title="Revisión docente" subtitle="Revisa la valoración sugerida, ajusta niveles si es necesario y publícala para que el estudiante la vea." />
      <div role="tablist" className="flex gap-1 border-b border-line mb-4 overflow-x-auto">
        {TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cx('px-3 py-2 text-sm whitespace-nowrap border-b-2 -mb-px', tab === k ? 'border-teal text-teal font-medium' : 'border-transparent text-muted hover:text-ink')}>{l}</button>)}
      </div>
      {loading ? <Loading /> : error ? <ErrorBox error={error} /> : !data?.length ? <Empty title="No hay evaluaciones en este estado" /> : (
        <div className="bg-card border border-line rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted"><tr><th className="p-3">Estudiante</th><th className="p-3">Laboratorio</th><th className="p-3">Estado</th><th className="p-3">Fecha</th><th className="p-3 text-right">Nota</th></tr></thead>
            <tbody>
              {data.map((e) => (
                <tr key={e.id} className="border-t border-line hover:bg-paper">
                  <td className="p-3"><Link href={`/app/evaluaciones/${e.id}`} className="font-medium hover:text-teal">{e.studentName}</Link></td>
                  <td className="p-3">{e.labTitle}</td>
                  <td className="p-3"><StatusBadge status={e.status} /></td>
                  <td className="p-3 text-muted whitespace-nowrap">{fmtDate(e.createdAt)}</td>
                  <td className="p-3 text-right"><Grade value={e.finalGrade ?? e.preliminaryGrade} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
