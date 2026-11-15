'use client';
import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { fmtGrade, gradeTone, STATUS } from '@/lib/format';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');
export { cx };

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; loading?: boolean; size?: 'sm' | 'md' };
export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button({ variant = 'primary', loading, size = 'md', className, children, disabled, ...p }, ref) {
  const v = {
    primary: 'bg-teal text-white hover:bg-teal-dark',
    secondary: 'bg-card text-ink border border-line hover:border-ink-2',
    ghost: 'text-ink-2 hover:bg-line/50',
    danger: 'bg-card text-low border border-low/40 hover:bg-low-soft',
  }[variant];
  return (
    <button ref={ref} disabled={disabled || loading} className={cx('inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed', size === 'sm' ? 'px-2.5 py-1 text-sm' : 'px-4 py-2', v, className)} {...p}>
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}{children}
    </button>
  );
});

export function Panel({ title, actions, children, className }: { title?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cx('bg-card border border-line rounded-lg', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 px-5 pt-4 pb-3 border-b border-line">
          {title && <h2 className="text-lg font-semibold">{title}</h2>}
          {actions && <div className="flex gap-2">{actions}</div>}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function PageHead({ title, subtitle, actions }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div className="max-w-3xl">
        <h1 className="text-[28px] font-semibold">{title}</h1>
        {subtitle && <p className="text-muted mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2 no-print">{actions}</div>}
    </div>
  );
}

const TONES: Record<string, string> = {
  high: 'bg-teal-soft text-teal-dark', mid: 'bg-mid-soft text-mid', low: 'bg-low-soft text-low', neutral: 'bg-line/60 text-ink-2', none: 'bg-line/60 text-muted',
};
export function Badge({ tone = 'neutral', children }: { tone?: string; children: React.ReactNode }) {
  return <span className={cx('inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium whitespace-nowrap', TONES[tone])}>{children}</span>;
}
export function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <Badge tone="none">Sin evaluar</Badge>;
  const s = STATUS[status] ?? { label: status, tone: 'neutral' };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}
export function Grade({ value, size = 'md' }: { value: number | null | undefined; size?: 'md' | 'lg' }) {
  const t = gradeTone(value);
  const color = { high: 'text-high', mid: 'text-mid', low: 'text-low', none: 'text-muted' }[t];
  return <span className={cx('num font-display font-semibold', color, size === 'lg' ? 'text-5xl' : 'text-xl')}>{fmtGrade(value)}</span>;
}

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium mb-1">{label}</span>
      {children}
      {hint && !error && <span className="block text-xs text-muted mt-1">{hint}</span>}
      {error && <span className="block text-xs text-low mt-1">{error}</span>}
    </label>
  );
}
export const inputCls = 'w-full rounded-md border border-line bg-white px-3 py-2 text-[15px] focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20';
export const Input = (p: React.InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cx(inputCls, p.className)} />;
export const Textarea = (p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={cx(inputCls, p.className)} />;
export const Select = (p: React.SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={cx(inputCls, p.className)} />;

export function Loading({ label = 'Cargando…' }: { label?: string }) {
  return <div className="flex items-center gap-2 text-muted py-10 justify-center"><Loader2 className="size-5 animate-spin" />{label}</div>;
}
export function ErrorBox({ error }: { error: unknown }) {
  if (!error) return null;
  const e = error as { message?: string; errors?: { path?: string; message: string }[] };
  return (
    <div role="alert" className="rounded-md border border-low/30 bg-low-soft text-low px-4 py-3 text-sm">
      <p className="font-medium">{e.message || String(error)}</p>
      {e.errors?.length ? <ul className="list-disc ml-5 mt-1">{e.errors.map((x, i) => <li key={i}>{x.path ? `${x.path}: ` : ''}{x.message}</li>)}</ul> : null}
    </div>
  );
}
export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="text-center py-10 px-4">
      <p className="font-display text-lg font-semibold">{title}</p>
      {children && <div className="text-muted mt-1 max-w-md mx-auto">{children}</div>}
    </div>
  );
}
export function Bar({ value, max = 5 }: { value: number | null; max?: number }) {
  const t = gradeTone(value);
  const color = { high: 'bg-high', mid: 'bg-mid', low: 'bg-low', none: 'bg-line' }[t];
  return (
    <div className="h-2 w-full rounded-full bg-line/70 overflow-hidden" role="meter" aria-valuenow={value ?? 0} aria-valuemin={0} aria-valuemax={max}>
      <div className={cx('h-full rounded-full', color)} style={{ width: `${Math.max(0, Math.min(1, (value ?? 0) / max)) * 100}%` }} />
    </div>
  );
}
