import { redirect } from 'next/navigation';
import { connectDB } from '@/lib/db/connection';
import { verifySession } from '@/lib/auth/session';
import Invite from '@/lib/db/models/Invite';
import FamilyTree from '@/lib/db/models/FamilyTree';
import User from '@/lib/db/models/User';
import Membership from '@/lib/db/models/Membership';
import InviteActions from './InviteActions';

interface InvitePageProps {
  params: Promise<{ token: string }>;
}

/**
 * Invite acceptance page.
 *
 * Displays invite details (tree name, role, inviter) and provides
 * accept/decline buttons. Handles error states for expired, exhausted,
 * revoked, and already-member scenarios.
 *
 * This is a server component under the protected route group,
 * so the user is guaranteed to be authenticated.
 */
export default async function InviteAcceptPage({ params }: InvitePageProps) {
  const { token } = await params;
  const session = await verifySession();

  if (!session) {
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent(`/invite/${token}`)}`);
  }

  await connectDB();

  // Look up the invite by token
  const invite = await Invite.findOne({ token });

  if (!invite) {
    return (
      <InviteErrorLayout
        title="Invalid Invite Link"
        message="This invite link is not valid. It may have been deleted or the URL is incorrect."
      />
    );
  }

  // Check computed status for error states
  const status = invite.computedStatus();

  if (status === 'revoked') {
    return (
      <InviteErrorLayout
        title="Invite Revoked"
        message="This invite link has been revoked by the tree administrator and is no longer valid."
      />
    );
  }

  if (status === 'expired') {
    return (
      <InviteErrorLayout
        title="Invite Expired"
        message="This invite link has expired. Please request a new invite link from the tree administrator."
      />
    );
  }

  if (status === 'exhausted') {
    return (
      <InviteErrorLayout
        title="Invite No Longer Valid"
        message="This invite link has reached its maximum number of uses and is no longer valid. Please request a new invite link from the tree administrator."
      />
    );
  }

  // Check if user is already a member
  const existingMembership = await Membership.findOne({
    userId: session.userId,
    treeId: invite.treeId,
    deletedAt: null,
  });

  if (existingMembership) {
    return (
      <InviteErrorLayout
        title="Already a Member"
        message="You are already a member of this family tree. No action is needed."
        linkHref={`/trees/${invite.treeId.toString()}`}
        linkText="Go to Tree"
      />
    );
  }

  // Fetch tree and inviter details for display
  const [tree, inviter] = await Promise.all([
    FamilyTree.findById(invite.treeId).lean(),
    User.findById(invite.invitedBy).lean(),
  ]);

  const treeName = tree?.name ?? 'Unknown Tree';
  const inviterName = inviter?.displayName ?? 'Unknown User';
  const role = invite.role;

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-100">
            <svg
              className="h-6 w-6 text-brand-600"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z"
              />
            </svg>
          </div>

          <h1 className="mt-4 text-xl font-semibold text-stone-900">
            You&apos;ve Been Invited
          </h1>
          <p className="mt-2 text-sm text-stone-600">
            <span className="font-medium text-stone-900">{inviterName}</span> has
            invited you to join a family tree.
          </p>
        </div>

        <div className="mt-6 rounded-xl border border-stone-100 bg-stone-50 p-4">
          <dl className="space-y-3">
            <div className="flex items-center justify-between">
              <dt className="text-sm text-stone-500">Tree</dt>
              <dd className="text-sm font-medium text-stone-900">{treeName}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-sm text-stone-500">Role</dt>
              <dd>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${getRoleBadgeColor(role)}`}>
                  {role}
                </span>
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-sm text-stone-500">Invited by</dt>
              <dd className="text-sm font-medium text-stone-900">{inviterName}</dd>
            </div>
          </dl>
        </div>

        <InviteActions token={token} treeName={treeName} />
      </div>
    </div>
  );
}

// --- Helper Components ---

function getRoleBadgeColor(role: string): string {
  switch (role) {
    case 'admin':
      return 'bg-sun-100 text-amber-800';
    case 'editor':
      return 'bg-leaf-100 text-leaf-700';
    case 'viewer':
      return 'bg-stone-100 text-stone-800';
    default:
      return 'bg-stone-100 text-stone-800';
  }
}

function InviteErrorLayout({
  title,
  message,
  linkHref,
  linkText,
}: {
  title: string;
  message: string;
  linkHref?: string;
  linkText?: string;
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-stone-200 bg-white p-8 shadow-sm text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
          <svg
            className="h-6 w-6 text-red-600"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
            />
          </svg>
        </div>

        <h1 className="mt-4 text-xl font-semibold text-stone-900">{title}</h1>
        <p className="mt-2 text-sm text-stone-600">{message}</p>

        <div className="mt-6">
          {linkHref && linkText ? (
            <a
              href={linkHref}
              className="inline-flex items-center rounded-full bg-brand-500 px-4 py-2 text-sm font-bold text-white hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 shadow-[0_3px_0_0_var(--color-brand-700)] disabled:shadow-none"
            >
              {linkText}
            </a>
          ) : (
            <a
              href="/dashboard"
              className="inline-flex items-center rounded-full bg-brand-500 px-4 py-2 text-sm font-bold text-white hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 shadow-[0_3px_0_0_var(--color-brand-700)] disabled:shadow-none"
            >
              Go to Dashboard
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
