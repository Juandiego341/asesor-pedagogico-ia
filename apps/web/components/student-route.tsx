'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from './session';
import { StudentPicker } from './student-picker';
import { Loading, PageHead } from './ui';

export function StudentRoute({ base, title, subtitle }: { base: string; title: string; subtitle: string }) {
  const { user, isStaff } = useSession();
  const router = useRouter();
  useEffect(() => { if (!isStaff) router.replace(`${base}/${user.id}`); }, [isStaff, user.id, base, router]);
  if (!isStaff) return <Loading />;
  return (<><PageHead title={title} subtitle={subtitle} /><StudentPicker base={base} title="Elige un estudiante" /></>);
}
