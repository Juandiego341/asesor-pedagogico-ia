import type { Metadata } from 'next';
import '@fontsource-variable/bricolage-grotesque';
import '@fontsource-variable/public-sans';
import './globals.css';

export const metadata: Metadata = {
  title: 'Asesor Pedagógico Inteligente · Universidad de Manizales',
  description: 'Autoevaluación y fortalecimiento de competencias en Inteligencia Artificial con evaluación explicable y supervisión docente.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
