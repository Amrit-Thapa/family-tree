"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="p-4 text-red-600">
      <p>Something went wrong while loading the tree.</p>
      <button onClick={reset} className="mt-2 underline">
        Try again
      </button>
    </div>
  );
}
