'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { Button, ErrorBox, Field, Input, Select, Textarea } from './ui';

export function LabForm({ cohorts, initial, onSaved, onCancel }: { cohorts: any[]; initial?: any; onSaved: (l: any) => void; onCancel?: () => void }) {
  const [f, setF] = useState({
    cohortId: initial?.cohortId ?? cohorts[0]?.id, order: initial?.order ?? 1, title: initial?.title ?? '',
    description: initial?.description ?? '', objectives: initial?.objectives ?? '', topics: (initial?.topics ?? []).join('\n'),
    requiresCode: initial?.requiresCode ?? true,
  });
  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError(null);
    const body = { ...f, cohortId: Number(f.cohortId), order: Number(f.order), topics: f.topics.split('\n').map((t: string) => t.trim()).filter(Boolean) };
    try { onSaved(await api(initial ? `/labs/${initial.id}` : '/labs', { method: initial ? 'PATCH' : 'POST', body })); }
    catch (err) { setError(err); } finally { setSaving(false); }
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid sm:grid-cols-[1fr_120px] gap-4">
        <Field label="Corte"><Select value={f.cohortId} onChange={(e) => setF({ ...f, cohortId: e.target.value })}>{cohorts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
        <Field label="Orden"><Input type="number" min={1} value={f.order} onChange={(e) => setF({ ...f, order: e.target.value })} /></Field>
      </div>
      <Field label="Título"><Input required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
      <Field label="Descripción del laboratorio"><Textarea required rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
      <Field label="Objetivos"><Textarea rows={3} value={f.objectives} onChange={(e) => setF({ ...f, objectives: e.target.value })} /></Field>
      <Field label="Temáticas de IA" hint="Una por línea. Se usan para clasificar el mapa de competencias."><Textarea rows={4} value={f.topics} onChange={(e) => setF({ ...f, topics: e.target.value })} /></Field>
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={f.requiresCode} onChange={(e) => setF({ ...f, requiresCode: e.target.checked })} />La entrega requiere código fuente (ZIP o GitHub). Desmárcalo si el laboratorio es solo informe.</label>
      <ErrorBox error={error} />
      <div className="flex gap-2"><Button type="submit" loading={saving}>{initial ? 'Guardar cambios' : 'Crear laboratorio'}</Button>{onCancel && <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>}</div>
    </form>
  );
}
