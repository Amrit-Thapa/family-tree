'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';

/**
 * Represents the authenticated user returned by GET /api/auth/me.
 */
export interface AuthUser {
  id: string;
  firebaseUid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  lastLoginAt?: string;
  createdAt: string;
}

/**
 * Shape of the auth context value provided to consuming components.
 */
export interface AuthContextValue {
  /** The currently authenticated user, or null if not authenticated. */
  user: AuthUser | null;
  /** Whether the initial auth check is still in progress. */
  loading: boolean;
  /** Signs out the current user and redirects to the sign-in page. */
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * AuthProvider fetches the current user from the server on mount and provides
 * auth context (user, loading state, sign-out function) to the component tree.
 *
 * Wrap your application (or protected layout) with this provider to give
 * descendant components access to auth state via the useAuth() hook.
 */
export default function AuthProvider({ children }: AuthProviderProps) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchCurrentUser() {
      try {
        const response = await fetch('/api/auth/me');

        if (!response.ok) {
          // Not authenticated or session expired
          if (!cancelled) {
            setUser(null);
          }
          return;
        }

        const data = await response.json();

        if (!cancelled) {
          setUser(data.user ?? null);
        }
      } catch {
        // Network error or unexpected failure
        if (!cancelled) {
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchCurrentUser();

    return () => {
      cancelled = true;
    };
  }, []);

  const signOut = useCallback(async () => {
    try {
      await fetch('/api/auth/signout', { method: 'POST' });
    } catch {
      // Even if the API call fails, clear local state and redirect
    } finally {
      setUser(null);
      router.push('/auth/signin');
    }
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to consume the auth context. Must be used within an AuthProvider.
 *
 * @returns The current auth context value (user, loading, signOut).
 * @throws Error if used outside of an AuthProvider.
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
