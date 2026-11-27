'use client';

/**
 * Error boundary for the dashboard route segment.
 * Catches unhandled errors from the server component and shows a user-friendly fallback.
 */
export default function DashboardError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <h2 className="text-lg font-semibold text-stone-900">
        Something went wrong
      </h2>
      <p className="mt-2 text-sm text-stone-500">
        We couldn&apos;t load your family trees. Please try again.
      </p>
      <button
        onClick={reset}
        className="mt-4 rounded-full bg-brand-500 px-4 py-2 text-sm font-bold text-white hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 shadow-[0_3px_0_0_var(--color-brand-700)] disabled:shadow-none"
      >
        Try again
      </button>
    </div>
  );
}
