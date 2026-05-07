import Link from 'next/link';
import { verifySession } from '@/lib/auth/session';
import { listUserTrees, getMemberCounts, TreeResult } from '@/lib/services/tree.service';
import { UsersIcon, CalendarIcon } from '@/components/icons';

/**
 * Dashboard page showing the user's family trees as cards.
 *
 * This is a Server Component that fetches data directly from the
 * database via the tree service. Auth is verified by the protected
 * layout — verifySession here is only used to obtain the userId.
 */
export default async function DashboardPage() {
  // The protected layout guarantees a valid session; we call verifySession
  // only to retrieve the userId (not for auth gating).
  const session = (await verifySession())!;

  const trees = await listUserTrees(session.userId);
  const memberCounts = await getMemberCounts(trees.map((t) => t.id));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">My Family Trees</h1>
        <Link
          href="/trees/new"
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          Create Tree
        </Link>
      </div>

      {trees.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {trees.map((tree) => (
            <TreeCard
              key={tree.id}
              tree={tree}
              memberCount={memberCounts.get(tree.id) ?? 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Empty state shown when the user has no family trees.
 */
function EmptyState() {
  return (
    <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
      <h3 className="mt-2 text-sm font-semibold text-gray-900">
        No family trees
      </h3>
      <p className="mt-1 text-sm text-gray-500">
        Get started by creating your first family tree.
      </p>
      <div className="mt-6">
        <Link
          href="/trees/new"
          className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          <span aria-hidden="true">+ </span>
          New Family Tree
        </Link>
      </div>
    </div>
  );
}

/**
 * Card component displaying a single family tree's summary.
 */
function TreeCard({
  tree,
  memberCount,
}: {
  tree: TreeResult;
  memberCount: number;
}) {
  const formattedDate = new Date(tree.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <Link
      href={`/trees/${tree.id}`}
      className="block rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
    >
      <h2 className="text-lg font-semibold text-gray-900 truncate">
        {tree.name}
      </h2>

      {tree.description && (
        <p className="mt-1 text-sm text-gray-500 line-clamp-2">
          {tree.description}
        </p>
      )}

      <div className="mt-4 flex items-center gap-4 text-sm text-gray-600">
        <span className="inline-flex items-center gap-1">
          <UsersIcon className="h-4 w-4" />
          {memberCount} {memberCount === 1 ? 'member' : 'members'}
        </span>

        <span className="inline-flex items-center gap-1">
          <CalendarIcon className="h-4 w-4" />
          {formattedDate}
        </span>
      </div>
    </Link>
  );
}
