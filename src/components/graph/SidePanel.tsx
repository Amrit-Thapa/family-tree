'use client';

import { useEffect, useRef, useState } from 'react';
import type { GraphNodeData, GraphRelationshipData } from '@/lib/services/graph.service';
import { groupDirectRelationships } from '@/lib/graph/group-relationships';
import { deriveRelationships, type DerivedRelationType } from '@/lib/graph/derived-relationships';
import { formatDisplayName } from '@/lib/graph/format-name';
import AddRelationshipForm from '@/components/graph/AddRelationshipForm';
import QuickAddRelationship from '@/components/graph/QuickAddRelationship';
import type { QuickAddKind } from '@/lib/graph/link-suggestions';

// --- Types ---

export interface SidePanelProps {
  node: GraphNodeData | null;
  relationships: GraphRelationshipData[];
  allNodes: GraphNodeData[];
  isAdmin: boolean;
  treeId: string;
  currentUserId?: string;
  onClose: () => void;
  onNavigateToNode: (nodeId: string) => void;
  onRelationshipCreated: (rel: GraphRelationshipData) => void;
  onRelationshipDeleted: (relId: string) => void;
  onPersonUpdated?: () => void;
  onPersonDeleted?: () => void;
}

// --- Helpers ---

/**
 * Formats an ISO date string to a human-readable format (e.g., "Jan 15, 1990").
 */
function formatDate(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    if (isNaN(date.getTime())) return isoDate;
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return isoDate;
  }
}

/** Extended-family sections, in display order (siblings live under Family). */
const EXTENDED_GROUPS: { type: DerivedRelationType; label: string }[] = [
  { type: 'grandparent', label: 'Grandparents' },
  { type: 'uncle_aunt', label: 'Uncles & Aunts' },
  { type: 'cousin', label: 'Cousins' },
  { type: 'grandchild', label: 'Grandchildren' },
];

/**
 * One person in a relationship list: their name (opens their panel), an
 * optional badge, and an optional remove button for stored relationships.
 */
function PersonRow({
  name,
  badge,
  onOpen,
  onRemove,
  removeLabel,
  removeDisabled,
}: {
  name: string;
  badge?: string;
  onOpen: () => void;
  onRemove?: () => void;
  removeLabel?: string;
  removeDisabled?: boolean;
}) {
  return (
    <li className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <button
          onClick={onOpen}
          className="truncate text-sm text-indigo-600 hover:text-indigo-800 hover:underline focus:outline-none focus:underline"
        >
          {name}
        </button>
        {badge && (
          <span className="shrink-0 text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
            {badge}
          </span>
        )}
      </div>
      {onRemove && (
        <button
          onClick={onRemove}
          disabled={removeDisabled}
          className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
          aria-label={removeLabel}
        >
          ✕
        </button>
      )}
    </li>
  );
}

// --- Loading Skeleton ---

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-4 p-6" aria-label="Loading person details">
      {/* Avatar skeleton */}
      <div className="flex items-center gap-3">
        <div className="h-16 w-16 rounded-full bg-gray-200" />
        <div className="space-y-2">
          <div className="h-4 w-32 rounded bg-gray-200" />
          <div className="h-3 w-24 rounded bg-gray-200" />
        </div>
      </div>
      {/* Details skeleton */}
      <div className="space-y-3 pt-4">
        <div className="h-3 w-40 rounded bg-gray-200" />
        <div className="h-3 w-36 rounded bg-gray-200" />
      </div>
      {/* Relationships skeleton */}
      <div className="space-y-3 pt-4">
        <div className="h-4 w-28 rounded bg-gray-200" />
        <div className="h-3 w-44 rounded bg-gray-200" />
        <div className="h-3 w-36 rounded bg-gray-200" />
      </div>
    </div>
  );
}

// --- Component ---

/**
 * SidePanel slides in from the right when a person node is clicked.
 * Displays person details, direct relationships (grouped), derived relationships,
 * and admin actions (add/delete relationships).
 */
export default function SidePanel({
  node,
  relationships,
  allNodes,
  isAdmin,
  treeId,
  currentUserId,
  onClose,
  onNavigateToNode,
  onRelationshipCreated,
  onRelationshipDeleted,
  onPersonUpdated,
  onPersonDeleted,
}: SidePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddRelationship, setShowAddRelationship] = useState(false);
  const [deletingRelId, setDeletingRelId] = useState<string | null>(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteRole, setInviteRole] = useState<'admin' | 'editor' | 'viewer'>('viewer');
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [isGeneratingInvite, setIsGeneratingInvite] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [quickAdd, setQuickAdd] = useState<QuickAddKind | null>(null);

  // Simulate brief loading state when node changes
  useEffect(() => {
    if (node) {
      setIsLoading(true);
      setShowAddRelationship(false);
      setQuickAdd(null);
      setShowEditForm(false);
      setShowDeleteConfirm(false);
      setEditError(null);
      setShowInviteForm(false);
      setInviteUrl(null);
      setInviteError(null);
      setCopied(false);
      const timer = setTimeout(() => setIsLoading(false), 150);
      return () => clearTimeout(timer);
    }
  }, [node?.id]);

  // Close on outside click
  useEffect(() => {
    if (!node) return;

    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    // Delay adding the listener to avoid closing immediately on the click that opened it
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [node, onClose]);

  // Compute relationships when node is available
  const grouped = node
    ? groupDirectRelationships(node.id, relationships, allNodes)
    : { father: null, mother: null, children: [], spouses: [] };

  const derived = node
    ? deriveRelationships(node.id, relationships, allNodes)
    : [];

  const siblings = derived.filter((r) => r.type === 'sibling' || r.type === 'half-sibling');
  const extendedGroups = EXTENDED_GROUPS.map((g) => ({
    ...g,
    people: derived.filter((r) => r.type === g.type),
  })).filter((g) => g.people.length > 0);

  /**
   * Handles deleting a relationship via the API.
   */
  async function handleDeleteRelationship(relId: string) {
    setDeletingRelId(relId);
    try {
      const res = await fetch(`/api/trees/${treeId}/relationships/${relId}`, {
        method: 'DELETE',
      });
      if (res.ok || res.status === 204) {
        onRelationshipDeleted(relId);
      }
    } catch {
      // Silently fail — user can retry
    } finally {
      setDeletingRelId(null);
    }
  }

  /**
   * Gets the relationship IDs that involve the current node for delete buttons.
   */
  function getRelationshipId(otherNodeId: string, type: 'father' | 'mother' | 'spouse'): string | undefined {
    return relationships.find(
      (r) =>
        r.type === type &&
        ((r.fromNodeId === node?.id && r.toNodeId === otherNodeId) ||
          (r.toNodeId === node?.id && r.fromNodeId === otherNodeId))
    )?.id;
  }

  const quickAddForm =
    node && quickAdd ? (
      <div className="rounded-lg border border-indigo-100 bg-indigo-50/30 p-3">
        <QuickAddRelationship
          key={`${node.id}-${quickAdd}`}
          treeId={treeId}
          person={node}
          kind={quickAdd}
          relationships={relationships}
          allNodes={allNodes}
          onDone={() => {
            onRelationshipCreated({
              id: 'refresh',
              fromNodeId: '',
              toNodeId: '',
              type: quickAdd === 'child' ? 'father' : quickAdd,
            });
            setQuickAdd(null);
          }}
          onCancel={() => setQuickAdd(null)}
        />
      </div>
    ) : null;

  // Can edit: admin OR the person themselves
  const canEdit = isAdmin || (currentUserId && node?.linkedUserId === currentUserId);
  // Can delete: admin only
  const canDelete = isAdmin;

  /**
   * Handles updating a person's details.
   */
  async function handleEditSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!node) return;

    setIsSaving(true);
    setEditError(null);

    const formData = new FormData(e.currentTarget);
    const body: Record<string, string | undefined> = {
      firstName: (formData.get('firstName') as string) || undefined,
      lastName: (formData.get('lastName') as string) || undefined,
      dateOfBirth: (formData.get('dateOfBirth') as string) || undefined,
      dateOfDeath: (formData.get('dateOfDeath') as string) || undefined,
      gender: (formData.get('gender') as string) || undefined,
    };

    try {
      const res = await fetch(`/api/trees/${treeId}/persons/${node.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        setEditError(data.error?.message || 'Failed to update person');
        return;
      }

      setShowEditForm(false);
      onPersonUpdated?.();
    } catch {
      setEditError('An unexpected error occurred');
    } finally {
      setIsSaving(false);
    }
  }

  /**
   * Handles permanently deleting a person.
   */
  async function handleDelete() {
    if (!node) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/trees/${treeId}/persons/${node.id}`, {
        method: 'DELETE',
      });

      if (res.ok || res.status === 204) {
        setShowDeleteConfirm(false);
        onClose();
        onPersonDeleted?.();
      }
    } catch {
      // Silently fail — user can retry
    } finally {
      setIsDeleting(false);
    }
  }

  /**
   * Generates a claim invite link for this person node.
   */
  async function handleGenerateInvite() {
    if (!node) return;

    setIsGeneratingInvite(true);
    setInviteError(null);
    setInviteUrl(null);
    setCopied(false);

    try {
      const res = await fetch(`/api/trees/${treeId}/persons/${node.id}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: inviteRole }),
      });

      if (!res.ok) {
        const data = await res.json();
        setInviteError(data.error?.message || 'Failed to generate invite');
        return;
      }

      const data = await res.json();
      setInviteUrl(data.invite.url);
    } catch {
      setInviteError('An unexpected error occurred');
    } finally {
      setIsGeneratingInvite(false);
    }
  }

  /**
   * Copies the invite URL to clipboard.
   */
  async function handleCopyInvite() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select text
    }
  }

  return (
    <div
      ref={panelRef}
      className={`
        fixed top-0 right-0 h-full w-96 max-w-full bg-white shadow-xl border-l border-gray-200
        transform transition-transform duration-300 ease-in-out z-50
        ${node ? 'translate-x-0' : 'translate-x-full'}
      `}
      role="complementary"
      aria-label="Person details panel"
      aria-hidden={!node}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        aria-label="Close panel"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {/* Panel content */}
      <div className="h-full overflow-y-auto">
        {isLoading && node ? (
          <LoadingSkeleton />
        ) : node ? (
          <div className="p-6 space-y-6">
            {/* Person header */}
            <div className="flex items-center gap-4">
              {node.profilePhotoUrl ? (
                <img
                  src={node.profilePhotoUrl}
                  alt={`${node.firstName}'s photo`}
                  className="h-16 w-16 rounded-full object-cover"
                />
              ) : (
                <div className="h-16 w-16 rounded-full bg-gray-200 flex items-center justify-center text-xl font-semibold text-gray-500">
                  {node.firstName.charAt(0).toUpperCase()}
                  {node.lastName?.charAt(0).toUpperCase() ?? ''}
                </div>
              )}
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {formatDisplayName(node.firstName, node.lastName)}
                </h2>
              </div>
            </div>

            {/* Edit / Delete actions */}
            {(canEdit || canDelete) && !showEditForm && !showDeleteConfirm && (
              <div className="flex gap-2">
                {canEdit && (
                  <button
                    onClick={() => setShowEditForm(true)}
                    className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    Edit
                  </button>
                )}
                {canDelete && (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    Delete
                  </button>
                )}
              </div>
            )}

            {/* Delete confirmation */}
            {showDeleteConfirm && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 space-y-3">
                <p className="text-sm text-red-800 font-medium">
                  Permanently delete {formatDisplayName(node.firstName, node.lastName)}?
                </p>
                <p className="text-xs text-red-600">
                  This will remove the person and all their relationships. This cannot be undone.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {isDeleting ? 'Deleting...' : 'Yes, Delete'}
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={isDeleting}
                    className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Invite to Claim (profile-only nodes, admin only) */}
            {isAdmin && !node.linkedUserId && (
              <div className="rounded-lg border border-indigo-100 bg-indigo-50/30 p-3 space-y-2">
                {!showInviteForm && !inviteUrl && (
                  <button
                    onClick={() => setShowInviteForm(true)}
                    className="w-full rounded-md border border-indigo-200 bg-white px-3 py-2 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
                  >
                    🔗 Invite Someone to Claim This Profile
                  </button>
                )}

                {showInviteForm && !inviteUrl && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-700">Generate invite link</p>
                    <div>
                      <label htmlFor="invite-role" className="block text-xs text-gray-500">Role</label>
                      <select
                        id="invite-role"
                        value={inviteRole}
                        onChange={(e) => setInviteRole(e.target.value as 'admin' | 'editor' | 'viewer')}
                        className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                      >
                        <option value="viewer">Viewer</option>
                        <option value="editor">Editor</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                    {inviteError && (
                      <p className="text-xs text-red-600">{inviteError}</p>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={handleGenerateInvite}
                        disabled={isGeneratingInvite}
                        className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {isGeneratingInvite ? 'Generating...' : 'Generate Link'}
                      </button>
                      <button
                        onClick={() => { setShowInviteForm(false); setInviteError(null); }}
                        className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {inviteUrl && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-green-700">✓ Invite link generated</p>
                    <div className="flex gap-1">
                      <input
                        type="text"
                        readOnly
                        value={inviteUrl}
                        className="flex-1 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-700 truncate"
                      />
                      <button
                        onClick={handleCopyInvite}
                        className="shrink-0 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                      >
                        {copied ? '✓ Copied' : 'Copy'}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500">Expires in 7 days. Single use.</p>
                  </div>
                )}
              </div>
            )}

            {/* Edit form */}
            {showEditForm && (
              <form onSubmit={handleEditSubmit} className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
                <div>
                  <label htmlFor="edit-firstName" className="block text-xs font-medium text-gray-700">First Name *</label>
                  <input
                    id="edit-firstName"
                    name="firstName"
                    type="text"
                    defaultValue={node.firstName}
                    required
                    maxLength={100}
                    className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label htmlFor="edit-lastName" className="block text-xs font-medium text-gray-700">Last Name</label>
                  <input
                    id="edit-lastName"
                    name="lastName"
                    type="text"
                    defaultValue={node.lastName ?? ''}
                    maxLength={100}
                    className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label htmlFor="edit-dateOfBirth" className="block text-xs font-medium text-gray-700">Date of Birth</label>
                  <input
                    id="edit-dateOfBirth"
                    name="dateOfBirth"
                    type="date"
                    defaultValue={node.dateOfBirth ? node.dateOfBirth.split('T')[0] : ''}
                    className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label htmlFor="edit-dateOfDeath" className="block text-xs font-medium text-gray-700">Date of Death</label>
                  <input
                    id="edit-dateOfDeath"
                    name="dateOfDeath"
                    type="date"
                    defaultValue={node.dateOfDeath ? node.dateOfDeath.split('T')[0] : ''}
                    className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label htmlFor="edit-gender" className="block text-xs font-medium text-gray-700">Gender</label>
                  <select
                    id="edit-gender"
                    name="gender"
                    defaultValue={node.gender ?? ''}
                    className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  >
                    <option value="">Not specified</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                  </select>
                </div>
                {editError && (
                  <p className="text-xs text-red-600">{editError}</p>
                )}
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {isSaving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowEditForm(false); setEditError(null); }}
                    disabled={isSaving}
                    className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {/* Person details — omit fields with no value */}
            <div className="space-y-2">
              {node.dateOfBirth && (
                <p className="text-sm text-gray-600">
                  <span className="font-medium text-gray-700">Born:</span>{' '}
                  {formatDate(node.dateOfBirth)}
                </p>
              )}
              {node.dateOfDeath && (
                <p className="text-sm text-gray-600">
                  <span className="font-medium text-gray-700">Died:</span>{' '}
                  {formatDate(node.dateOfDeath)}
                </p>
              )}
              {node.gender && (
                <p className="text-sm text-gray-600">
                  <span className="font-medium text-gray-700">Gender:</span>{' '}
                  {node.gender.charAt(0).toUpperCase() + node.gender.slice(1).replace(/_/g, ' ')}
                </p>
              )}
            </div>

            {/* Family: parents (always shown, with slots for missing ones), spouses, siblings, children */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                Family
              </h3>

              <div className="space-y-4">
                {/* Parents */}
                <div>
                  <h4 className="text-xs font-medium text-gray-500 uppercase mb-1">Parents</h4>
                  <ul className="space-y-1">
                    {(['father', 'mother'] as const).map((parentType) => {
                      const parent = grouped[parentType];
                      if (parent) {
                        return (
                          <PersonRow
                            key={parentType}
                            name={formatDisplayName(parent.firstName, parent.lastName)}
                            badge={parentType === 'father' ? 'Father' : 'Mother'}
                            onOpen={() => onNavigateToNode(parent.id)}
                            onRemove={
                              isAdmin
                                ? () => {
                                    const relId = getRelationshipId(parent.id, parentType);
                                    if (relId) handleDeleteRelationship(relId);
                                  }
                                : undefined
                            }
                            removeLabel={`Remove ${parentType} relationship`}
                            removeDisabled={deletingRelId !== null}
                          />
                        );
                      }
                      return (
                        <li key={parentType}>
                          {isAdmin ? (
                            <button
                              onClick={() => {
                                setShowAddRelationship(false);
                                setQuickAdd(parentType);
                              }}
                              aria-pressed={quickAdd === parentType}
                              className={`w-full rounded-md border border-dashed px-2 py-1.5 text-left text-sm transition-colors ${
                                quickAdd === parentType
                                  ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                                  : 'border-gray-300 text-gray-500 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700'
                              }`}
                            >
                              + Add {parentType}
                            </button>
                          ) : (
                            <span className="text-sm text-gray-400 italic">
                              {parentType === 'father' ? 'Father' : 'Mother'} not added
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  {(quickAdd === 'father' || quickAdd === 'mother') && (
                    <div className="mt-2">{quickAddForm}</div>
                  )}
                </div>

                {/* Spouses */}
                {grouped.spouses.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-gray-500 uppercase mb-1">
                      {grouped.spouses.length === 1 ? 'Spouse' : 'Spouses'}
                    </h4>
                    <ul className="space-y-1">
                      {grouped.spouses.map(({ node: spouse, status }) => (
                        <PersonRow
                          key={spouse.id}
                          name={formatDisplayName(spouse.firstName, spouse.lastName)}
                          badge={status && status !== 'active' ? status.charAt(0).toUpperCase() + status.slice(1) : undefined}
                          onOpen={() => onNavigateToNode(spouse.id)}
                          onRemove={
                            isAdmin
                              ? () => {
                                  const relId = getRelationshipId(spouse.id, 'spouse');
                                  if (relId) handleDeleteRelationship(relId);
                                }
                              : undefined
                          }
                          removeLabel={`Delete relationship with ${spouse.firstName}`}
                          removeDisabled={deletingRelId !== null}
                        />
                      ))}
                    </ul>
                  </div>
                )}

                {/* Siblings (derived from shared parents, so no remove button) */}
                {siblings.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-gray-500 uppercase mb-1">Siblings</h4>
                    <ul className="space-y-1">
                      {siblings.map((sib) => (
                        <PersonRow
                          key={sib.nodeId}
                          name={sib.personName}
                          badge={
                            sib.type === 'half-sibling'
                              ? sib.via
                                ? `Half · via ${sib.via}`
                                : 'Half-sibling'
                              : undefined
                          }
                          onOpen={() => onNavigateToNode(sib.nodeId)}
                        />
                      ))}
                    </ul>
                  </div>
                )}

                {/* Children */}
                {grouped.children.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-gray-500 uppercase mb-1">Children</h4>
                    <ul className="space-y-1">
                      {grouped.children.map((child) => (
                        <PersonRow
                          key={child.id}
                          name={formatDisplayName(child.firstName, child.lastName)}
                          onOpen={() => onNavigateToNode(child.id)}
                          onRemove={
                            isAdmin
                              ? () => {
                                  // Child relationship: this person is father or mother of the child
                                  const relId = relationships.find(
                                    (r) =>
                                      (r.type === 'father' || r.type === 'mother') &&
                                      r.fromNodeId === node?.id &&
                                      r.toNodeId === child.id
                                  )?.id;
                                  if (relId) handleDeleteRelationship(relId);
                                }
                              : undefined
                          }
                          removeLabel={`Delete relationship with ${child.firstName}`}
                          removeDisabled={deletingRelId !== null}
                        />
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* Extended family (derived), grouped by relationship */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                Extended Family
              </h3>

              {extendedGroups.length === 0 ? (
                <p className="text-sm text-gray-500 italic">
                  No extended family connections found.
                </p>
              ) : (
                <div className="space-y-4">
                  {extendedGroups.map((group) => (
                    <div key={group.type}>
                      <h4 className="text-xs font-medium text-gray-500 uppercase mb-1">
                        {group.label}
                      </h4>
                      <ul className="space-y-1">
                        {group.people.map((rel) => (
                          <PersonRow
                            key={rel.nodeId}
                            name={rel.personName}
                            onOpen={() => onNavigateToNode(rel.nodeId)}
                          />
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Admin: Add Relationship */}
            {isAdmin && (
              <div className="border-t border-gray-200 pt-4 space-y-3">
                {/* Quick-add buttons (parents are added from their slots above) */}
                {!showAddRelationship && quickAdd !== 'child' && quickAdd !== 'spouse' && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        setQuickAdd('child');
                      }}
                      className="rounded-md border border-gray-200 bg-gray-50 px-2 py-2 text-xs font-medium text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition-colors"
                    >
                      + Child
                    </button>
                    <button
                      onClick={() => {
                        setQuickAdd('spouse');
                      }}
                      className="rounded-md border border-gray-200 bg-gray-50 px-2 py-2 text-xs font-medium text-gray-700 hover:bg-pink-50 hover:text-pink-700 hover:border-pink-200 transition-colors"
                    >
                      + Spouse
                    </button>
                  </div>
                )}

                {/* Quick-add form for child / spouse */}
                {(quickAdd === 'child' || quickAdd === 'spouse') && quickAddForm}

                {/* Link existing person */}
                {!quickAdd && (
                  <>
                    {showAddRelationship ? (
                      <AddRelationshipForm
                        treeId={treeId}
                        currentNodeId={node.id}
                        allNodes={allNodes}
                        onRelationshipCreated={(rel) => {
                          onRelationshipCreated(rel);
                          setShowAddRelationship(false);
                        }}
                        onClose={() => setShowAddRelationship(false)}
                      />
                    ) : (
                      <button
                        onClick={() => setShowAddRelationship(true)}
                        className="w-full rounded-md border border-indigo-200 bg-white px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                      >
                        Link Existing Person
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
