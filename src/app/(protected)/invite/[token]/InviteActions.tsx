'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface InviteActionsProps {
  token: string;
  treeName: string;
}

/**
 * Client component for invite accept/decline buttons.
 *
 * Handles the POST request to accept the invite and navigates
 * to the tree on success, or back to the dashboard on decline.
 */
export default function InviteActions({ token, treeName }: InviteActionsProps) {
  const router = useRouter();
  const [isAccepting, setIsAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAccept = async () => {
    setIsAccepting(true);
    setError(null);

    try {
      const res = await fetch(`/api/invites/${token}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        const data = await res.json();
        const errorMessage = data.error?.message || 'Failed to accept invite';
        throw new Error(errorMessage);
      }

      const data = await res.json();
      const treeId = data.membership?.treeId;

      // Navigate to the tree page on success
      if (treeId) {
        router.push(`/trees/${treeId}`);
      } else {
        router.push('/dashboard');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      setIsAccepting(false);
    }
  };

  const handleDecline = () => {
    router.push('/dashboard');
  };

  return (
    <div className="mt-6">
      {error && (
        <div
          role="alert"
          aria-live="polite"
          className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={handleAccept}
          disabled={isAccepting}
          className="w-full rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isAccepting ? 'Joining...' : `Join "${treeName}"`}
        </button>

        <button
          type="button"
          onClick={handleDecline}
          disabled={isAccepting}
          className="w-full rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-60"
        >
          Decline
        </button>
      </div>
    </div>
  );
}
