'use client';
import Link from 'next/link';
import { useApi } from '@/lib/hooks';
import { Empty, ErrorBox, Loading, Panel } from './ui';

/** Para docentes: elegir el estudiante cuyo portafolio, informe o mapa se consulta. */
export function StudentPicker({ base, title }: { base: string; title: string }) {
  const { data, error, loading } = useApi<any[]>('/users?role=STUDENT');
  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  return (
    <Panel title={title}>
      {!data?.length ? <Empty title="Aún no hay estudiantes">Crea estudiantes desde Administración o pídeles que se registren.</Empty> : (
        <ul className="divide-y divide-line">
          {data.map((s) => (
            <li key={s.id}>
              <Link href={`${base}/${s.id}`} className="flex items-center justify-between py-3 hover:text-teal">
                <span className="font-medium">{s.name}</span>
                <span className="text-sm text-muted">{s.studentCode || s.email}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

