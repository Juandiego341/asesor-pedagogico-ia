'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { useSession } from '@/components/session';
import { Button, ErrorBox, Field, Input, Loading, PageHead, Panel, Select, Textarea } from '@/components/ui';

function Form() {
  const { isStaff } = useSession();
  const q = useSearchParams();
  const cohorts = useApi<any[]>('/cohorts');
  const students = useApi<any[]>(isStaff ? '/users?role=STUDENT' : null);
  const [labId, setLabId] = useState(q.get('lab') || '');
  const [studentId, setStudentId] = useState(q.get('student') || '');
  const [mode, setMode] = useState<'zip' | 'github'>('zip');
  const [repoUrl, setRepoUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [report, setReport] = useState<File | null>(null);
  const [code, setCode] = useState<File | null>(null);
  const [extras, setExtras] = useState<File[]>([]);
  const [evaluate, setEvaluate] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [step, setStep] = useState<string | null>(null);
  const router = useRouter();
  if (cohorts.loading) return <Loading />;
  const labs = (cohorts.data ?? []).flatMap((c) => c.labs.map((l: any) => ({ ...l, cohort: c.name })));
  const lab = labs.find((l) => l.id === labId);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null);
    const form = new FormData();
    form.append('labId', labId);
    if (isStaff) form.append('studentId', studentId);
    if (notes) form.append('notes', notes);
    if (report) form.append('report', report);
    if (mode === 'zip' && code) form.append('code', code);
    if (mode === 'github') form.append('repoUrl', repoUrl);
    extras.forEach((f) => form.append('extras', f));
    try {
      setStep(mode === 'github' ? 'Descargando repositorio y leyendo el informe…' : 'Subiendo y leyendo archivos…');
      const s = await api('/submissions', { form });
      if (evaluate) { setStep('Solicitando evaluación…'); await api(`/submissions/${s.id}/evaluate`, { method: 'POST' }).catch(() => null); }
      router.push(`/app/entregas/${s.id}`);
    } catch (err) { setError(err); setStep(null); }
  };

  return (
    <form onSubmit={submit} className="grid lg:grid-cols-[3fr_2fr] gap-6">
      <Panel title="Datos de la entrega">
        <div className="space-y-4">
          {isStaff && <Field label="Estudiante"><Select required value={studentId} onChange={(e) => setStudentId(e.target.value)}><option value="">Selecciona…</option>{students.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>}
          <Field label="Laboratorio"><Select required value={labId} onChange={(e) => setLabId(e.target.value)}>
            <option value="">Selecciona…</option>
            {labs.map((l) => <option key={l.id} value={l.id} disabled={!l.publishedRubric}>{l.cohort} · {l.title}{!l.publishedRubric ? ' (sin rúbrica publicada)' : ''}</option>)}
          </Select></Field>
          <Field label="Informe del laboratorio (PDF con texto legible)" hint="Máximo 25 MB. No se aceptan PDF escaneados como imagen.">
            <Input type="file" accept="application/pdf,.pdf" required onChange={(e) => setReport(e.target.files?.[0] ?? null)} />
          </Field>
          <fieldset>
            <legend className="text-sm font-medium mb-2">Código fuente</legend>
            <div className="flex gap-4 mb-2 text-sm">
              <label className="flex items-center gap-2"><input type="radio" checked={mode === 'zip'} onChange={() => setMode('zip')} />Archivo ZIP</label>
              <label className="flex items-center gap-2"><input type="radio" checked={mode === 'github'} onChange={() => setMode('github')} />Repositorio de GitHub</label>
            </div>
            {mode === 'zip' ? <Input type="file" accept=".zip" required onChange={(e) => setCode(e.target.files?.[0] ?? null)} />
              : <Input type="url" required placeholder="https://github.com/usuario/repositorio" value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} />}
            <p className="text-xs text-muted mt-1">{mode === 'github' ? 'Debe ser público. Se guarda una copia con el commit exacto para trazabilidad.' : 'Se ignoran node_modules, .git, entornos virtuales y binarios.'}</p>
          </fieldset>
          <Field label="Evidencias opcionales" hint="Imágenes, diagramas, mapas mentales, presentaciones (PPTX), documentos o video.">
            <Input type="file" multiple accept="image/*,.pptx,.docx,.txt,.md,.mp4,.webm,.mov" onChange={(e) => setExtras(Array.from(e.target.files ?? []))} />
          </Field>
          <Field label="Notas para el docente (opcional)"><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={evaluate} onChange={(e) => setEvaluate(e.target.checked)} />Solicitar la evaluación inteligente al guardar</label>
          <ErrorBox error={error} />
          <Button type="submit" loading={!!step}>{step ?? 'Guardar entrega'}</Button>
        </div>
      </Panel>
      <Panel title="Laboratorio seleccionado">
        {lab ? (
          <div className="space-y-3 text-sm">
            <p className="font-medium text-base">{lab.title}</p>
            <p className="text-ink-2">{lab.description}</p>
            {lab.objectives && <p><span className="font-medium">Objetivos:</span> {lab.objectives}</p>}
            <p className="text-muted">Se evaluará con la rúbrica versión {lab.publishedRubric?.version}. Esa versión queda asociada a la entrega aunque la rúbrica cambie después.</p>
          </div>
        ) : <p className="text-muted">Elige un laboratorio para ver su descripción y objetivos.</p>}
      </Panel>
    </form>
  );
}

export default function NewSubmission() {
  return (<><PageHead title="Nueva entrega" subtitle="Cada entrega incluye el informe en PDF, el código fuente y queda asociada a la rúbrica vigente del laboratorio." /><Suspense><Form /></Suspense></>);
}
