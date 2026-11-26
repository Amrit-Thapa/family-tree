import GoogleSignInButton from '@/components/auth/GoogleSignInButton';

export const metadata = {
  title: 'Sign In — Family Relationship Platform',
  description: 'Sign in with your Google account to access the Family Relationship Platform.',
};

interface SignInPageProps {
  searchParams: Promise<{ callbackUrl?: string }>;
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const { callbackUrl } = await searchParams;

  // Validate callbackUrl: only allow same-origin relative paths to prevent
  // open redirect. "//evil.com" and "/\evil.com" are protocol-relative URLs
  // that browsers resolve to another origin, so they are rejected.
  const isSafeCallback =
    !!callbackUrl &&
    callbackUrl.startsWith('/') &&
    !callbackUrl.startsWith('//') &&
    !callbackUrl.startsWith('/\\');
  const redirectTo = isSafeCallback ? callbackUrl : '/dashboard';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8 text-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Welcome
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Sign in to access your family trees and connections.
          </p>
        </div>

        <GoogleSignInButton redirectTo={redirectTo} />
      </div>
    </div>
  );
}
