import Link from 'next/link';

export function AuthFrame({ title, children, footer }: { title: string; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-[1fr_480px]">
      <div className="hidden lg:flex flex-col justify-between bg-ink text-white p-12">
        <Link href="/" className="font-display text-xl font-semibold">Asesor Pedagógico <span className="text-marker">Inteligente</span></Link>
        <blockquote className="max-w-md">
          <p className="font-display text-3xl leading-snug">Cada nota se explica con evidencias del propio trabajo, y la última palabra la tiene el docente.</p>
          <p className="text-white/60 mt-4">Universidad de Manizales · Ingeniería de Sistemas y Telecomunicaciones</p>
        </blockquote>
        <p className="text-white/50 text-sm">Curso de Inteligencia Artificial · Cortes 1 y 2</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <h1 className="text-3xl font-semibold mb-6">{title}</h1>
          {children}
          <div className="mt-6 text-sm text-muted">{footer}</div>
        </div>
      </div>
    </div>
  );
}
