'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithPopup } from 'firebase/auth';
import { clientAuth, googleProvider } from '@/lib/auth/firebase-client';
import { GoogleIcon } from '@/components/icons/GoogleIcon';

/**
 * Firebase auth errors include a `code` property for programmatic handling.
 */
interface FirebaseAuthError extends Error {
  code?: string;
}

const DEFAULT_REDIRECT = '/dashboard';

/**
 * Maps a caught error to a user-friendly message string.
 */
function getErrorMessage(err: unknown): string {
  if (!(err instanceof Error)) {
    return 'An unexpected error occurred. Please try again.';
  }

  const code = (err as FirebaseAuthError).code;

  if (code === 'auth/popup-closed-by-user') {
    return 'Sign-in was cancelled. Please try again.';
  }
  if (code === 'auth/network-request-failed') {
    return 'Network error. Please check your connection and try again.';
  }
  if (code?.startsWith('auth/')) {
    return 'Authentication failed. Please try again.';
  }

  return err.message;
}

interface GoogleSignInButtonProps {
  /** Where to redirect after successful sign-in. Defaults to /dashboard. */
  redirectTo?: string;
}

export default function GoogleSignInButton({
  redirectTo = DEFAULT_REDIRECT,
}: GoogleSignInButtonProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSignIn() {
    setError(null);
    setIsLoading(true);

    try {
      const result = await signInWithPopup(clientAuth, googleProvider);
      const idToken = await result.user.getIdToken();

      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'Sign-in failed. Please try again.');
      }

      router.push(redirectTo);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <button
        onClick={handleSignIn}
        disabled={isLoading}
        className="flex items-center gap-3 rounded-lg border border-gray-300 bg-white px-6 py-3 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        aria-label="Sign in with Google"
      >
        <GoogleIcon className="h-5 w-5" />
        {isLoading ? 'Signing in...' : 'Sign in with Google'}
      </button>

      {error && (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}
    </div>
  );
}
