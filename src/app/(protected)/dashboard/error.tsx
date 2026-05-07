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
      <h2 className="text-lg font-semibold text-gray-900">
        Something went wrong
      </h2>
      <p className="mt-2 text-sm text-gray-500">
        We couldn&apos;t load your family trees. Please try again.
      </p>
      <button
        onClick={reset}
        className="mt-4 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
      >
        Try again
      </button>
    </div>
  );
}
