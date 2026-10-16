import type { Metadata } from 'next';
import { QuoteRotator } from '@/components/auth/QuoteRotator';

export const metadata: Metadata = { title: 'Sign In' };

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#FAFAFC] px-6 py-16">
      {/* Ambient background blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="animate-blob absolute -left-40 -top-40 h-[420px] w-[420px] rounded-full bg-violet-200/50 blur-3xl" />
        <div className="animate-blob absolute -bottom-40 -right-32 h-[480px] w-[480px] rounded-full bg-violet-300/40 blur-3xl [animation-delay:3s]" />
        <div className="animate-blob absolute right-1/4 top-1/3 h-72 w-72 rounded-full bg-amber-100/40 blur-3xl [animation-delay:6s]" />
      </div>

      <div className="relative z-10 flex w-full max-w-md flex-col items-center">
        {/* Logo */}
        <img
          src="/branding/befhue-logo.png"
          alt="Befhue"
          className="animate-fade-in-up mb-8 h-12 w-auto object-contain"
        />

        {/* Card */}
        <div className="animate-fade-in-up w-full [animation-delay:100ms]">
          {children}
        </div>

        {/* Rotating quote */}
        <QuoteRotator />

        <p className="mt-8 text-center text-xs text-gray-400">
          © {new Date().getFullYear()} Befhue · All rights reserved
        </p>
      </div>
    </div>
  );
}
