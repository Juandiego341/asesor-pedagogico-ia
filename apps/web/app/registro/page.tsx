'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { AuthFrame } from '@/components/auth-frame';
import { Button, ErrorBox, Field, Input } from '@/components/ui';

export default function RegisterPage() {
  const [f, setF] = useState({ name: '', email: '', studentCode: '', password: '' });
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError(null);
    try { await api('/auth/register', { body: { ...f, studentCode: f.studentCode || undefined } }); router.push('/app'); }
    catch (err) { setError(err); setLoading(false); }
  };
  return (
    <AuthFrame title="Crear cuenta de estudiante" footer={<>¿Ya tienes cuenta? <Link className="text-teal font-medium underline" href="/login">Inicia sesión</Link></>}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Nombre completo"><Input required value={f.name} onChange={set('name')} autoComplete="name" /></Field>
        <Field label="Correo"><Input type="email" required value={f.email} onChange={set('email')} autoComplete="email" /></Field>
        <Field label="Código estudiantil" hint="Opcional"><Input value={f.studentCode} onChange={set('studentCode')} /></Field>
        <Field label="Contraseña" hint="Mínimo 8 caracteres"><Input type="password" required minLength={8} value={f.password} onChange={set('password')} autoComplete="new-password" /></Field>
        <ErrorBox error={error} />
        <Button type="submit" loading={loading} className="w-full">Crear cuenta</Button>
      </form>
    </AuthFrame>
  );
}
