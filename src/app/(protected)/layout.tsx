import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { verifySession } from '@/lib/auth/session';
import { connectDB } from '@/lib/db/connection';
import User from '@/lib/db/models/User';
import type { IUser } from '@/lib/db/models/User';
import SidebarNav from '@/components/layout/SidebarNav';
import MobileTopBar from '@/components/layout/MobileTopBar';

/**
 * Protected layout that wraps all authenticated routes.
 *
 * The proxy layer handles the primary auth check and callbackUrl redirect.
 * This layout serves as a secondary guard — if somehow reached without a
 * valid session, it redirects to sign-in with the current pathname as
 * callbackUrl so the user returns here after authenticating.
 */
export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await verifySession();

  if (!session) {
    // Read the pathname set by the proxy for callbackUrl
    const headersList = await headers();
    const pathname = headersList.get('x-pathname') || '/';
    const callbackUrl = encodeURIComponent(pathname);
    redirect(`/auth/signin?callbackUrl=${callbackUrl}`);
  }

  await connectDB();

  const user = await User.findById(session.userId).lean<IUser>();

  if (!user || user.deletedAt) {
    redirect('/auth/signin');
  }

  const userProfile = {
    id: user._id.toString(),
    displayName: user.displayName,
    email: user.email,
    photoURL: user.photoURL,
  };

  return (
    <div className="flex h-dvh flex-col overflow-hidden md:flex-row">
      <SidebarNav user={userProfile} />
      <MobileTopBar user={userProfile} />
      <main className="min-h-0 flex-1 overflow-y-auto bg-cream p-4 md:p-6">
        {children}
      </main>
    </div>
  );
}
