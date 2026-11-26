'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTree } from '@/components/tree/TreeProvider';
import { UsersIcon, CalendarIcon } from '@/components/icons';
import FamilyTreeGraph from '@/components/graph/FamilyTreeGraph';
import AddPersonForm from '@/components/graph/AddPersonForm';
import type { GraphNodeData } from '@/lib/services/graph.service';

/**
 * Tree overview page — the landing page when navigating to /trees/[treeId].
 *
 * Displays tree name, description, metadata, navigation links to
 * sub-sections (members, settings), and the interactive family tree graph.
 * Admins can add new person nodes via the "Add Person" button.
 */
export default function TreeOverviewPage() {
  const { tree, role, userId } = useTree();
  const currentUserId = userId;

  const [showAddPersonForm, setShowAddPersonForm] = useState(false);
  const [graphRefreshKey, setGraphRefreshKey] = useState(0);

  const isAdmin = role === 'admin';

  const formattedCreatedAt = new Date(tree.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const formattedUpdatedAt = new Date(tree.updatedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  function handlePersonCreated(_node: GraphNodeData): void {
    setShowAddPersonForm(false);
    setGraphRefreshKey((prev) => prev + 1);
  }

  function handleCancelAddPerson(): void {
    setShowAddPersonForm(false);
  }

  return (
    <div className="space-y-8">
      {/* Header & Overview */}
      <div className="mx-auto max-w-3xl space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{tree.name}</h1>
          {tree.description && (
            <p className="mt-2 text-sm text-gray-600">{tree.description}</p>
          )}
          <div className="mt-3 flex items-center gap-4 text-sm text-gray-500">
            <span className="inline-flex items-center gap-1">
              <CalendarIcon className="h-4 w-4" />
              Created {formattedCreatedAt}
            </span>
            <span className="inline-flex items-center gap-1 capitalize rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-800">
              {role}
            </span>
          </div>
        </div>

        {/* Quick Info */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Details</h2>
          <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-gray-500">Last Updated</dt>
              <dd className="mt-1 text-sm text-gray-900">{formattedUpdatedAt}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Your Role</dt>
              <dd className="mt-1 text-sm text-gray-900 capitalize">{role}</dd>
            </div>
          </dl>
        </div>

        {/* Navigation Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Link
            href={`/trees/${tree.id}/members`}
            className="flex items-start gap-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-100">
              <UsersIcon className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Members</h3>
              <p className="mt-1 text-xs text-gray-500">
                View members and invite new people to this tree.
              </p>
            </div>
          </Link>

          {isAdmin && (
            <Link
              href={`/trees/${tree.id}/settings`}
              className="flex items-start gap-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100">
                <svg
                  className="h-5 w-5 text-gray-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Settings</h3>
                <p className="mt-1 text-xs text-gray-500">
                  Update tree name, description, or delete the tree.
                </p>
              </div>
            </Link>
          )}
        </div>
      </div>

      {/* Family Tree Graph Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Family Tree</h2>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setShowAddPersonForm((prev) => !prev)}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              {showAddPersonForm ? 'Close Form' : 'Add Person'}
            </button>
          )}
        </div>

        {/* Add Person Form (admin-only, toggled) */}
        {showAddPersonForm && (
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <AddPersonForm
              treeId={tree.id}
              role={role}
              onPersonCreated={handlePersonCreated}
              onCancel={handleCancelAddPerson}
            />
          </div>
        )}

        {/* Graph Canvas */}
        <div className="h-[650px] rounded-xl border border-gray-200 bg-slate-50 shadow-sm overflow-hidden">
          <FamilyTreeGraph
            key={graphRefreshKey}
            treeId={tree.id}
            currentUserId={currentUserId}
            role={role}
          />
        </div>
      </div>
    </div>
  );
}
