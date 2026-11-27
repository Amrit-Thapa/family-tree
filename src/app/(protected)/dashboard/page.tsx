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
        <div>
          <h1 className="text-3xl font-semibold text-stone-900">Your family trees 🌳</h1>
          <p className="mt-1 text-sm text-stone-500">Pick a tree to explore, or plant a new one.</p>
        </div>
        <Link
          href="/trees/new"
          className="rounded-full bg-brand-500 px-5 py-2.5 text-sm font-bold text-white shadow-[0_3px_0_0_var(--color-brand-700)] hover:bg-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
        >
          🌱 Plant a new tree
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
    <div className="rounded-[2rem] border-2 border-dashed border-stone-300 bg-white/60 p-12 text-center">
      <div aria-hidden="true" className="text-5xl animate-float">🌱</div>
      <h3 className="mt-4 text-xl font-semibold text-stone-900">
        No trees yet
      </h3>
      <p className="mt-1 text-sm text-stone-500">
        Every family starts somewhere. Plant your first tree and invite the relatives.
      </p>
      <div className="mt-6">
        <Link
          href="/trees/new"
          className="inline-flex items-center rounded-full bg-brand-500 px-5 py-2.5 text-sm font-bold text-white shadow-[0_3px_0_0_var(--color-brand-700)] hover:bg-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
        >
          🌱 Plant your first tree
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
      className="group block rounded-3xl border-2 border-stone-200/70 bg-white p-6 shadow-[0_4px_0_0_rgb(231_229_228)] transition-all duration-200 hover:-translate-y-1 hover:border-brand-200 hover:shadow-[0_6px_0_0_var(--color-brand-200)] focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-leaf-100 text-2xl group-hover:animate-wiggle"
        >
          🌳
        </span>
        <h2 className="text-xl font-semibold text-stone-900 truncate">
          {tree.name}
        </h2>
      </div>

      {tree.description && (
        <p className="mt-1 text-sm text-stone-500 line-clamp-2">
          {tree.description}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-bold text-stone-600">
        <span className="inline-flex items-center gap-1 rounded-full bg-sun-100 px-2.5 py-1 text-amber-800">
          <UsersIcon className="h-4 w-4" />
          {memberCount} {memberCount === 1 ? 'member' : 'members'}
        </span>

        <span className="inline-flex items-center gap-1 rounded-full bg-cream px-2.5 py-1">
          <CalendarIcon className="h-4 w-4" />
          {formattedDate}
        </span>
      </div>
    </Link>
  );
}
