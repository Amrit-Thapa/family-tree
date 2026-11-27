'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTree } from '@/components/tree/TreeProvider';
import { UsersIcon } from '@/components/icons';
import FamilyTreeGraph from '@/components/graph/FamilyTreeGraph';
import AddPersonForm from '@/components/graph/AddPersonForm';
import type { GraphNodeData } from '@/lib/services/graph.service';

/**
 * Tree overview page — the landing page when navigating to /trees/[treeId].
 *
 * A compact header (name, role, links to members/settings) above the family
 * tree, which fills the rest of the screen.
 * Admins can add new person nodes via the "Add Person" button.
 */
export default function TreeOverviewPage() {
  const { tree, role, userId } = useTree();
  const currentUserId = userId;

  const [showAddPersonForm, setShowAddPersonForm] = useState(false);
  const [graphRefreshKey, setGraphRefreshKey] = useState(0);

  const isAdmin = role === 'admin';

  const formattedUpdatedAt = new Date(tree.updatedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  function handlePersonCreated(_node: GraphNodeData): void {
    setShowAddPersonForm(false);
    setGraphRefreshKey((prev) => prev + 1);
  }

  function handleCancelAddPerson(): void {
    setShowAddPersonForm(false);
  }

  const pillLink =
    'inline-flex h-10 items-center gap-1.5 rounded-full border-2 border-stone-200 bg-white px-3 text-sm font-bold text-stone-700 transition-colors hover:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2';

  return (
    <div className="flex h-full flex-col gap-3 md:gap-4">
      {/* Compact header so the tree gets the screen */}
      <header className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="w-full min-w-0 sm:w-auto sm:flex-1">
          <h1 className="truncate text-2xl font-bold text-stone-900">{tree.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500">
            <span className="rounded-full bg-brand-100 px-2.5 py-0.5 font-bold capitalize text-brand-800">{role}</span>
            <span>Updated {formattedUpdatedAt}</span>
          </div>
          {tree.description && (
            <p className="mt-1.5 line-clamp-2 text-sm text-stone-600">{tree.description}</p>
          )}
        </div>

        <nav className="flex items-center gap-2" aria-label="Tree sections">
          <Link href={`/trees/${tree.id}/members`} className={pillLink}>
            <UsersIcon className="h-4 w-4 text-brand-600" />
            Members
          </Link>
          {isAdmin && (
            <Link href={`/trees/${tree.id}/settings`} className={pillLink} aria-label="Settings">
              <span aria-hidden="true">⚙️</span>
              <span className="hidden sm:inline">Settings</span>
            </Link>
          )}
          {isAdmin && (
            <button
              type="button"
              onClick={() => setShowAddPersonForm((prev) => !prev)}
              aria-expanded={showAddPersonForm}
              className="inline-flex h-10 items-center gap-1 rounded-full bg-brand-500 px-4 text-sm font-bold text-white shadow-[0_3px_0_0_var(--color-brand-700)] hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
            >
              {showAddPersonForm ? 'Close' : '＋ Add person'}
            </button>
          )}
        </nav>
      </header>

      {/* Add Person Form (admin-only, toggled) */}
      {showAddPersonForm && (
        <div className="shrink-0 rounded-3xl border border-stone-200 bg-white p-4 shadow-sm sm:p-6">
          <AddPersonForm
            treeId={tree.id}
            role={role}
            onPersonCreated={handlePersonCreated}
            onCancel={handleCancelAddPerson}
          />
        </div>
      )}

      {/* The tree fills the rest of the screen */}
      <div className="min-h-[480px] flex-1 overflow-hidden rounded-3xl border border-stone-200 bg-[#fffdf8] shadow-sm">
        <FamilyTreeGraph
          key={graphRefreshKey}
          treeId={tree.id}
          currentUserId={currentUserId}
          role={role}
        />
      </div>
    </div>
  );
}
