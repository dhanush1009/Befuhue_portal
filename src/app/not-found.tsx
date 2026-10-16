import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-canvas-dark">
      <div className="text-center px-4">
        <p className="text-8xl font-semibold text-brand mb-4">404</p>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Page not found</h1>
        <p className="text-sm text-gray-500 dark:text-violet-300/55 mb-6">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/dashboard"
          className="px-5 py-2.5 text-sm font-medium bg-brand text-white rounded-lg hover:bg-brand-hover transition-colors duration-150"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
