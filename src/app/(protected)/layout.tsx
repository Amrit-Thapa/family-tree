import { redirect } from 'next/navigation';
import { verifySession } from '@/lib/auth/session';
import { connectDB } from '@/lib/db/connection';
import User from '@/lib/db/models/User';
import type { IUser } from '@/lib/db/models/User';
import SidebarNav from '@/components/layout/SidebarNav';

/**
 * Protected layout that wraps all authenticated routes.
 *
 * Verifies the session server-side and redirects to /auth/signin
 * if the session is invalid. Renders a sidebar navigation with
 * user profile information alongside the page content.
 */
export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await verifySession();

  if (!session) {
    redirect('/auth/signin');
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
    <div className="flex h-screen overflow-hidden">
      <SidebarNav user={userProfile} />
      <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
        {children}
      </main>
    </div>
  );
}
