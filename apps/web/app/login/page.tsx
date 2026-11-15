'use client';
import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { AuthFrame } from '@/components/auth-frame';
import { Button, ErrorBox, Field, Input } from '@/components/ui';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const next = useSearchParams().get('next') || '/app';
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError(null);
    try { await api('/auth/login', { body: { email, password } }); router.push(next.startsWith('/app') ? next : '/app'); }
    catch (err) { setError(err); setLoading(false); }
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Correo institucional"><Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
      <Field label="Contraseña"><Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
      <ErrorBox error={error} />
      <Button type="submit" loading={loading} className="w-full">Iniciar sesión</Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <AuthFrame title="Iniciar sesión" footer={<>¿Eres estudiante y no tienes cuenta? <Link className="text-teal font-medium underline" href="/registro">Regístrate</Link></>}>
      <Suspense><LoginForm /></Suspense>
    </AuthFrame>
  );
}
