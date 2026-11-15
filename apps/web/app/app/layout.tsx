'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BookOpenCheck, ClipboardCheck, FolderOpen, Home, LogOut, Map, Settings, Upload, FileBarChart, Menu, X } from 'lucide-react';
import { api, User } from '@/lib/api';
import { SessionCtx } from '@/components/session';
import { Loading, cx } from '@/components/ui';
import { ROLE } from '@/lib/format';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const router = useRouter();
  useEffect(() => { api<{ user: User }>('/auth/me').then((r) => setUser(r.user)).catch(() => router.push('/login')); }, [router]);
  useEffect(() => setOpen(false), [path]);
  if (!user) return <Loading label="Verificando sesión…" />;
  const staff = user.role !== 'STUDENT';
  const nav = [
    { href: '/app', label: 'Inicio', icon: Home, show: true },
    { href: '/app/laboratorios', label: 'Laboratorios y rúbricas', icon: BookOpenCheck, show: true },
    { href: '/app/portafolio', label: 'Portafolio', icon: FolderOpen, show: true },
    { href: '/app/entregas/nueva', label: 'Nueva entrega', icon: Upload, show: true },
    { href: '/app/evaluaciones', label: 'Revisión docente', icon: ClipboardCheck, show: staff },
    { href: '/app/informe', label: 'Informe integrado', icon: FileBarChart, show: true },
    { href: '/app/mapa', label: 'Mapa de competencias', icon: Map, show: true },
    { href: '/app/admin', label: 'Administración', icon: Settings, show: user.role === 'ADMIN' },
  ].filter((n) => n.show);
  const logout = async () => { await api('/auth/logout', { method: 'POST' }); router.push('/login'); };
  return (
    <SessionCtx.Provider value={{ user, isStaff: staff }}>
      <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
        <aside className={cx('no-print bg-ink text-white/90 lg:sticky lg:top-0 lg:h-screen flex flex-col', open ? 'fixed inset-0 z-40' : 'hidden lg:flex')}>
          <div className="px-5 py-5 flex items-center justify-between">
            <Link href="/" className="font-display text-lg font-semibold text-white leading-tight">Asesor Pedagógico<br /><span className="text-marker">Inteligente</span></Link>
            <button className="lg:hidden" onClick={() => setOpen(false)} aria-label="Cerrar menú"><X /></button>
          </div>
          <nav className="flex-1 px-3 space-y-0.5" aria-label="Principal">
            {nav.map((n) => {
              const active = n.href === '/app' ? path === '/app' : path.startsWith(n.href);
              return (
                <Link key={n.href} href={n.href} aria-current={active ? 'page' : undefined}
                  className={cx('flex items-center gap-3 rounded-md px-3 py-2 text-[15px]', active ? 'bg-white/12 text-white font-medium' : 'hover:bg-white/8 text-white/75')}>
                  <n.icon className={cx('size-4', active && 'text-marker')} aria-hidden />{n.label}
                </Link>
              );
            })}
          </nav>
          <div className="p-4 border-t border-white/10 text-sm">
            <p className="font-medium text-white">{user.name}</p>
            <p className="text-white/60">{ROLE[user.role]}</p>
            <button onClick={logout} className="mt-3 inline-flex items-center gap-2 text-white/75 hover:text-white"><LogOut className="size-4" />Cerrar sesión</button>
          </div>
        </aside>
        <div className="min-w-0">
          <div className="lg:hidden no-print flex items-center justify-between bg-ink text-white px-4 py-3">
            <span className="font-display font-semibold">Asesor Pedagógico</span>
            <button onClick={() => setOpen(true)} aria-label="Abrir menú"><Menu /></button>
          </div>
          <main className="px-5 py-8 lg:px-10 max-w-[1200px]">{children}</main>
        </div>
      </div>
    </SessionCtx.Provider>
  );
}
