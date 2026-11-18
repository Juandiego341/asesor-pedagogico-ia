import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { getProject } from '@/lib/server';

export const dynamic = 'force-dynamic';

const STEPS = [
  ['Entrada', 'El docente registra el laboratorio y su rúbrica; el estudiante carga su informe en PDF y el código (ZIP o GitHub).'],
  ['Verificación técnica', 'El código se revisa en un entorno aislado y sin red: sintaxis, análisis estático y pruebas unitarias.'],
  ['Valoración con IA', 'El modelo elige un nivel por criterio y cita fragmentos textuales del trabajo. Cada cita se comprueba contra el material.'],
  ['Cálculo de la nota', 'El servidor aplica las ponderaciones de la rúbrica. El modelo nunca calcula la nota.'],
  ['Revisión docente', 'El docente ajusta niveles, aprueba y publica. Todo queda registrado: evidencias, versión de rúbrica y modelo usado.'],
];

function Specimen() {
  return (
    <figure className="bg-card border border-line rounded-lg shadow-[0_20px_50px_-30px_rgba(20,33,61,0.45)] overflow-hidden" aria-label="Ejemplo de valoración de un criterio">
      <div className="px-5 py-3 border-b border-line flex items-center justify-between text-sm">
        <span className="font-medium">Laboratorio 1 · Búsqueda heurística</span>
        <span className="text-muted">Rúbrica v1</span>
      </div>
      <div className="p-5 space-y-4">
        <div className="flex items-baseline justify-between gap-4">
          <p className="font-display text-lg font-semibold">Diseño de la heurística</p>
          <p className="text-sm text-muted num">20 %</p>
        </div>
        <div className="flex gap-1.5" role="list" aria-label="Niveles de desempeño">
          {[['Insuficiente', '1,0'], ['Aceptable', '3,0'], ['Bueno', '4,0'], ['Excelente', '5,0']].map(([n, v], i) => (
            <span key={n} role="listitem" className={`flex-1 rounded px-2 py-1.5 text-center text-xs ${i === 3 ? 'bg-teal text-white font-semibold' : 'bg-paper text-muted'}`}>{n}<br /><span className="num">{v}</span></span>
          ))}
        </div>
        <blockquote className="text-[15px] leading-relaxed text-ink-2 border-l-2 border-marker pl-3">
          «<span className="marker">Usamos la distancia Manhattan, que es admisible porque cada pieza debe moverse al menos su distancia Manhattan</span>…»
          <footer className="mt-2 flex items-center gap-1.5 text-xs text-teal-dark"><CheckCircle2 className="size-3.5" />Cita verificada · Informe, página 2</footer>
        </blockquote>
      </div>
      <div className="bg-ink text-white px-5 py-4">
        <p className="text-xs text-white/60 mb-1">Nota calculada por el servidor</p>
        <p className="num text-sm text-white/85">0,20×5,0 + 0,30×5,0 + 0,20×4,0 + 0,20×4,0 + 0,10×5,0</p>
        <p className="font-display text-3xl font-semibold mt-1 num">= 4,6 <span className="text-base font-normal text-white/60">de 5,0</span></p>
      </div>
    </figure>
  );
}

export default async function Home() {
  const p = await getProject();
  return (
    <div className="bg-paper">
      <header className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
        <span className="font-display text-lg font-semibold">Asesor Pedagógico <span className="text-teal">Inteligente</span></span>
        <nav className="flex items-center gap-5 text-sm">
          <a href="#proyecto" className="hidden sm:inline hover:text-teal">Proyecto</a>
          <a href="#equipo" className="hidden sm:inline hover:text-teal">Equipo</a>
          <Link href="/desarrollo" className="hidden sm:inline hover:text-teal">Desarrollo con IA</Link>
          <Link href="/login" className="rounded-md bg-ink text-white px-4 py-2 font-medium hover:bg-ink-2">Iniciar sesión</Link>
        </nav>
      </header>

      <section className="max-w-6xl mx-auto px-6 pt-10 pb-20 grid lg:grid-cols-[1.1fr_1fr] gap-12 items-center">
        <div>
          <p className="text-teal-dark font-medium mb-4">Universidad de Manizales · Curso de Inteligencia Artificial</p>
          <h1 className="text-5xl sm:text-6xl font-semibold">Notas que se pueden explicar.</h1>
          <p className="text-lg text-ink-2 mt-6 max-w-xl">Carga tus laboratorios de las cortes 1 y 2 y recibe una valoración por criterio, sustentada en citas de tu propio trabajo, con recomendaciones concretas para mejorar. Tu docente revisa y aprueba cada resultado.</p>
          <div className="flex flex-wrap gap-3 mt-8">
            <Link href="/login" className="rounded-md bg-teal text-white px-5 py-2.5 font-medium hover:bg-teal-dark">Entrar a la plataforma</Link>
            <a href="#como" className="rounded-md border border-line bg-card px-5 py-2.5 font-medium hover:border-ink-2">Ver cómo se evalúa</a>
          </div>
        </div>
        <Specimen />
      </section>

      <section id="proyecto" className="bg-card border-y border-line">
        <div className="max-w-6xl mx-auto px-6 py-16 grid lg:grid-cols-[1fr_2fr] gap-10">
          <h2 className="text-3xl font-semibold">Abstract</h2>
          <div className="space-y-8">
            <p className="text-lg leading-relaxed text-ink-2 max-w-[70ch]">{p?.abstract ?? 'Plataforma web para la evaluación, retroalimentación y fortalecimiento de competencias en Inteligencia Artificial.'}</p>
            {p && (
              <div className="grid sm:grid-cols-2 gap-8">
                <div><h3 className="font-semibold text-lg mb-3">Objetivos</h3><ul className="space-y-2 text-ink-2">{p.objectives.map((o) => <li key={o} className="pl-4 border-l-2 border-teal/40">{o}</li>)}</ul></div>
                <div><h3 className="font-semibold text-lg mb-3">Aportes</h3><ul className="space-y-2 text-ink-2">{p.contributions.map((o) => <li key={o} className="pl-4 border-l-2 border-marker">{o}</li>)}</ul></div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section id="como" className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-semibold mb-10">Cómo se evalúa un laboratorio</h2>
        <ol className="grid md:grid-cols-5 gap-6">
          {STEPS.map(([t, d], i) => (
            <li key={t} className="relative">
              <span className="font-display text-4xl font-semibold text-teal/30 num">{i + 1}</span>
              <h3 className="font-semibold text-lg mt-1">{t}</h3>
              <p className="text-ink-2 text-sm mt-2">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      {p && (
        <section className="max-w-6xl mx-auto px-6 pb-16 grid lg:grid-cols-[2fr_1fr] gap-10">
          <div>
            <h2 className="text-2xl font-semibold mb-4">Funcionalidades</h2>
            <ul className="grid sm:grid-cols-2 gap-x-8 gap-y-3 text-ink-2">{p.features.map((f) => <li key={f} className="flex gap-2"><CheckCircle2 className="size-5 text-teal shrink-0 mt-0.5" />{f}</li>)}</ul>
          </div>
          <div>
            <h2 className="text-2xl font-semibold mb-4">Tecnologías</h2>
            <ul className="flex flex-wrap gap-2">{p.technologies.map((t) => <li key={t} className="rounded border border-line bg-card px-2.5 py-1 text-sm">{t}</li>)}</ul>
          </div>
        </section>
      )}

      <section id="equipo" className="bg-ink text-white">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <h2 className="text-3xl font-semibold mb-2">Equipo desarrollador</h2>
          <p className="text-white/70 mb-10">Ingeniería de Sistemas y Telecomunicaciones · Profundización I</p>
          <ul className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {(p?.team ?? []).map((m) => (
              <li key={m.id}>
                {m.hasPhoto
                  ? <img src={`/api/team/${m.id}/photo`} alt={`Fotografía de ${m.name}`} className="aspect-[4/5] w-full object-cover rounded-md bg-white/10" />
                  : <div className="aspect-[4/5] w-full rounded-md bg-white/8 border border-white/15 flex items-center justify-center font-display text-5xl text-marker" aria-hidden>{m.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</div>}
                <p className="font-display text-lg font-semibold mt-3">{m.name}</p>
                <p className="text-marker text-sm">{m.role}</p>
                {m.bio && <p className="text-white/65 text-sm mt-1">{m.bio}</p>}
              </li>
            ))}
          </ul>
        </div>
      </section>
      <footer className="max-w-6xl mx-auto px-6 py-8 text-sm text-muted flex flex-wrap justify-between gap-4">
        <span>Proyecto final · Profundización I – Inteligencia Artificial · Universidad de Manizales</span>
        <Link href="/desarrollo" className="hover:text-teal">Cómo usamos la IA para construir esta plataforma</Link>
      </footer>
    </div>
  );
}
