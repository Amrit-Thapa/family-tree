import GoogleSignInButton from '@/components/auth/GoogleSignInButton';

export const metadata = {
  title: 'Sign in — Family Tree',
  description: 'Sign in with your Google account to see your family trees.',
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-cream px-4">
      <div className="w-full max-w-sm space-y-8 rounded-[2rem] border-2 border-stone-200/70 bg-white px-8 py-10 text-center shadow-[0_6px_0_0_rgb(231_229_228)] animate-pop-in">
        <div>
          <div aria-hidden="true" className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-leaf-100 text-3xl animate-float">
            🌳
          </div>
          <h1 className="text-3xl font-semibold text-stone-900">
            Welcome back! 👋
          </h1>
          <p className="mt-2 text-sm text-stone-600">
            Hop in to see your family trees and everyone in them.
          </p>
        </div>

        <GoogleSignInButton redirectTo={redirectTo} />
      </div>
    </div>
  );
}
