import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { GeistSans } from 'geist/font/sans';
import { Toaster } from 'sonner';
import './globals.css';

const mortane = localFont({
  src: [
    {
      path: '../../public/fonts/mortane.ttf',
      weight: '100 900',
      style: 'normal',
    },
  ],
  variable: '--font-mortane',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default:  'Befhue',
    template: '%s | Befhue',
  },
  description: 'Befhue portal — agency management, tasks, clients, billing, and team.',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: '32x32' },
    ],
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
};

/**
 * Runs before React hydration — reads localStorage and applies the .dark
 * class immediately so there is zero flash of wrong theme on load.
 */
function ThemeScript() {
  const script = `
    (function() {
      try {
        var t = localStorage.getItem('di-theme');
        if (t === 'dark') {
          document.documentElement.classList.add('dark');
        }
      } catch(e) {}
    })();
  `;
  // dangerouslySetInnerHTML is intentional here — this must be an inline script
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${mortane.variable} ${GeistSans.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-full font-sans">
        {children}
        <Toaster
          richColors
          position="top-right"
          duration={4000}
          toastOptions={{ style: { fontFamily: 'var(--font-mortane), "Mortane", "Mortane Sans", sans-serif' } }}
        />
      </body>
    </html>
  );
}
