import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, Public_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-display',
});

const publicSans = Public_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-sans',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'SIA ITMANV - Sistema Integral Académico y Facturación SUNAT',
  description:
    'Plataforma de gestión académica, admisión, matrículas, evaluación por competencias MINEDU, horarios sin cruces, tesorería y facturación electrónica SUNAT UBL 2.1 para el Instituto de Educación Superior Tecnológico ITMANV.',
  openGraph: {
    title: 'SIA ITMANV - Sistema Integral Académico y Facturación SUNAT',
    description:
      'Plataforma de gestión académica, admisión, matrículas, evaluación por competencias MINEDU, horarios sin cruces, tesorería y facturación electrónica SUNAT UBL 2.1 para el Instituto de Educación Superior Tecnológico ITMANV.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SIA ITMANV - Sistema Integral Académico y Facturación SUNAT',
    description:
      'Plataforma de gestión académica, admisión, matrículas, evaluación por competencias MINEDU, horarios sin cruces, tesorería y facturación electrónica SUNAT UBL 2.1 para el Instituto de Educación Superior Tecnológico ITMANV.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es-PE"
      className={`${plusJakarta.variable} ${publicSans.variable} ${jetbrainsMono.variable}`}
    >
      <body
        suppressHydrationWarning
        className="bg-slate-50 text-slate-900 antialiased selection:bg-blue-700 selection:text-white"
      >
        {children}
      </body>
    </html>
  );
}
