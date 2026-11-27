'use client';

import { useState, useCallback } from 'react';
import { useTree } from '@/components/tree/TreeProvider';
import type { MembershipRole } from '@/lib/types/membership';

// --- Types ---

interface Member {
  id: string;
  userId: string;
  treeId: string;
  role: MembershipRole;
  joinedAt: string;
  invitedBy: string | null;
}

interface GeneratedInvite {
  inviteUrl: string;
  role: MembershipRole;
  label?: string;
  maxUses: number;
}

interface ActiveInvite {
  id: string;
  treeId: string;
  role: MembershipRole;
  token: string;
  label?: string;
  invitedBy: string;
  status: string;
  maxUses: number;
  usedCount: number;
  expiresAt: string;
  createdAt: string;
  inviteUrl: string;
}

// --- Constants ---

const INPUT_CLASSES =
  'mt-1 block w-full rounded-xl border border-stone-300 px-3 py-2 text-stone-900 placeholder-stone-400 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 sm:text-sm';

const ROLE_OPTIONS: MembershipRole[] = ['admin', 'editor', 'viewer'];

const ROLE_BADGE_COLORS: Record<MembershipRole, string> = {
  admin: 'bg-sun-100 text-amber-800',
  editor: 'bg-leaf-100 text-leaf-700',
  viewer: 'bg-stone-100 text-stone-800',
};

// --- Role Badge Component ---

function RoleBadge({ role }: { role: MembershipRole }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${ROLE_BADGE_COLORS[role]}`}
    >
      {role}
    </span>
  );
}

// --- Member Row Component ---

function MemberRow({
  member,
  currentMembershipId,
  onRoleChange,
  onRemove,
  isUpdating,
}: {
  member: Member;
  currentMembershipId: string;
  onRoleChange: (userId: string, newRole: MembershipRole) => void;
  onRemove: (userId: string) => void;
  isUpdating: boolean;
}) {
  const isCurrentUser = member.id === currentMembershipId;

  return (
    <div className="flex items-center justify-between border-b border-stone-100 py-3 last:border-b-0">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-medium text-brand-700">
          {member.userId.slice(-2).toUpperCase()}
        </div>
        <div>
          <p className="text-sm font-medium text-stone-900">
            {member.userId.slice(0, 8)}...
            {isCurrentUser && (
              <span className="ml-2 text-xs text-stone-500">(you)</span>
            )}
          </p>
          <p className="text-xs text-stone-500">
            Joined {new Date(member.joinedAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {isCurrentUser ? (
          <RoleBadge role={member.role} />
        ) : (
          <>
            <select
              value={member.role}
              onChange={(e) =>
                onRoleChange(member.userId, e.target.value as MembershipRole)
              }
              disabled={isUpdating}
              className="rounded-xl border border-stone-300 px-2 py-1 text-sm text-stone-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-50"
              aria-label={`Change role for member ${member.userId.slice(0, 8)}`}
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => onRemove(member.userId)}
              disabled={isUpdating}
              className="rounded-xl border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 disabled:opacity-50"
              aria-label={`Remove member ${member.userId.slice(0, 8)}`}
            >
              Remove
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// --- Invite Generation Section ---

function InviteSection({ treeId, onInviteGenerated }: { treeId: string; onInviteGenerated?: () => void }) {
  const [role, setRole] = useState<MembershipRole>('viewer');
  const [label, setLabel] = useState('');
  const [maxUses, setMaxUses] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedInvite, setGeneratedInvite] = useState<GeneratedInvite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    setGeneratedInvite(null);

    try {
      const body: Record<string, unknown> = { role };
      if (label.trim()) body.label = label.trim();
      if (maxUses && parseInt(maxUses, 10) > 0) body.maxUses = parseInt(maxUses, 10);

      const res = await fetch(`/api/trees/${treeId}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || 'Failed to generate invite link');
      }

      const data = await res.json();
      setGeneratedInvite({
        inviteUrl: data.invite.inviteUrl,
        role: data.invite.role,
        label: data.invite.label,
        maxUses: data.invite.maxUses,
      });
      onInviteGenerated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!generatedInvite) return;

    try {
      await navigator.clipboard.writeText(generatedInvite.inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Failed to copy to clipboard');
    }
  };

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-stone-900">Generate Invite Link</h2>
      <p className="mt-1 text-sm text-stone-600">
        Create a shareable link to invite new members to this tree.
      </p>

      <div className="mt-4 space-y-4">
        {/* Role selector */}
        <div>
          <label htmlFor="invite-role" className="block text-sm font-medium text-stone-700">
            Role <span className="text-red-500">*</span>
          </label>
          <select
            id="invite-role"
            value={role}
            onChange={(e) => setRole(e.target.value as MembershipRole)}
            className={INPUT_CLASSES}
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {/* Optional label */}
        <div>
          <label htmlFor="invite-label" className="block text-sm font-medium text-stone-700">
            Label <span className="text-xs text-stone-400">(optional)</span>
          </label>
          <input
            id="invite-label"
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder='e.g. "For Uncle Raj"'
            maxLength={100}
            className={INPUT_CLASSES}
          />
        </div>

        {/* Optional max uses */}
        <div>
          <label htmlFor="invite-max-uses" className="block text-sm font-medium text-stone-700">
            Max Uses <span className="text-xs text-stone-400">(optional, default: 1)</span>
          </label>
          <input
            id="invite-max-uses"
            type="number"
            value={maxUses}
            onChange={(e) => setMaxUses(e.target.value)}
            placeholder="1"
            min={1}
            max={100}
            className={INPUT_CLASSES}
          />
        </div>

        {/* Generate button */}
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isGenerating}
          className="rounded-full bg-brand-500 px-4 py-2 text-sm font-bold text-white hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 shadow-[0_3px_0_0_var(--color-brand-700)] disabled:shadow-none"
        >
          {isGenerating ? 'Generating...' : 'Generate Link'}
        </button>

        {/* Error display */}
        {error && (
          <div
            role="alert"
            aria-live="polite"
            className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        {/* Generated invite URL */}
        {generatedInvite && (
          <div className="rounded-xl border border-green-200 bg-green-50 p-4">
            <p className="text-sm font-medium text-green-800">Invite link generated!</p>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={generatedInvite.inviteUrl}
                className="flex-1 rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-700"
                aria-label="Generated invite URL"
              />
              <button
                type="button"
                onClick={handleCopy}
                className="shrink-0 rounded-xl border border-brand-300 bg-white px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1"
              >
                {copied ? 'Copied!' : 'Copy Link'}
              </button>
            </div>
            <p className="mt-2 text-xs text-green-700">
              Role: <span className="font-medium capitalize">{generatedInvite.role}</span>
              {generatedInvite.label && (
                <> · Label: <span className="font-medium">{generatedInvite.label}</span></>
              )}
              {' '}· Max uses: <span className="font-medium">{generatedInvite.maxUses}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Active Invite Links Section ---

function ActiveInvitesSection({
  treeId,
  refreshKey,
}: {
  treeId: string;
  refreshKey: number;
}) {
  const [invites, setInvites] = useState<ActiveInvite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRevoking, setIsRevoking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fetchCount, setFetchCount] = useState(0);

  const loadInvites = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/trees/${treeId}/invites`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || 'Failed to load invite links');
      }
      const data = await res.json();
      setInvites(data.invites);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [treeId]);

  // Trigger fetch on mount and when refreshKey changes
  if (fetchCount !== refreshKey + 1) {
    setFetchCount(refreshKey + 1);
    loadInvites();
  }

  const handleRevoke = async (inviteId: string) => {
    const confirmed = window.confirm(
      'Are you sure you want to revoke this invite link? It will no longer be usable.'
    );
    if (!confirmed) return;

    setIsRevoking(inviteId);
    setError(null);

    try {
      const res = await fetch(`/api/trees/${treeId}/invites/${inviteId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || 'Failed to revoke invite link');
      }

      // Remove the revoked invite from the list
      setInvites((prev) => prev.filter((inv) => inv.id !== inviteId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsRevoking(null);
    }
  };

  const formatExpiryDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) return 'Expired';
    if (diffDays === 1) return 'Expires tomorrow';
    if (diffDays <= 7) return `Expires in ${diffDays} days`;
    return `Expires ${date.toLocaleDateString()}`;
  };

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-stone-900">Active Invite Links</h2>
      <p className="mt-1 text-sm text-stone-600">
        Currently active invite links for this tree.
      </p>

      {error && (
        <div
          role="alert"
          aria-live="polite"
          className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <div className="mt-4">
        {isLoading ? (
          <div className="py-8 text-center text-sm text-stone-500">
            Loading invite links...
          </div>
        ) : invites.length === 0 ? (
          <div className="py-8 text-center text-sm text-stone-500">
            No active invite links.
          </div>
        ) : (
          <div className="space-y-3">
            {invites.map((invite) => (
              <div
                key={invite.id}
                className="flex items-center justify-between rounded-xl border border-stone-100 bg-stone-50 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-stone-900">
                      {invite.label || 'Untitled invite'}
                    </p>
                    <RoleBadge role={invite.role} />
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500">
                    <span>{formatExpiryDate(invite.expiresAt)}</span>
                    <span>
                      {invite.usedCount}/{invite.maxUses} used
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleRevoke(invite.id)}
                  disabled={isRevoking === invite.id}
                  className="ml-4 shrink-0 rounded-xl border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 disabled:opacity-50"
                  aria-label={`Revoke invite link ${invite.label || 'Untitled invite'}`}
                >
                  {isRevoking === invite.id ? 'Revoking...' : 'Revoke'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// --- Data fetching ---

async function fetchMembersData(treeId: string): Promise<Member[]> {
  const res = await fetch(`/api/trees/${treeId}/members`);
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error?.message || 'Failed to load members');
  }
  const data = await res.json();
  return data.members;
}

// --- Main Members Page ---

/**
 * Member management page (admin-only).
 *
 * Provides:
 * 1. A list of all active members with role badges, role change dropdowns, and remove buttons
 * 2. An invite link generation section with role selector, optional label, optional max-uses,
 *    "Generate Link" button, and "Copy Link" button
 *
 * Access control: If the user's role is not 'admin', a forbidden message is shown.
 * The tree-scoped layout already verifies membership, so we only need to check role.
 */
export default function MembersPage() {
  const { tree, role, membershipId } = useTree();

  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);
  const [inviteRefreshKey, setInviteRefreshKey] = useState(0);

  const loadMembers = useCallback(async () => {
    try {
      const data = await fetchMembersData(tree.id);
      setMembers(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [tree.id]);

  // Trigger initial fetch once for admin users.
  // Using state-based guard to avoid useEffect + setState lint issues.
  if (role === 'admin' && !hasFetched) {
    setHasFetched(true);
    loadMembers();
  }

  // Admin-only access enforcement
  if (role !== 'admin') {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
          <h1 className="text-xl font-semibold text-red-800">Access Denied</h1>
          <p className="mt-2 text-sm text-red-600">
            Only administrators can manage members.
          </p>
        </div>
      </div>
    );
  }

  const handleRoleChange = async (targetUserId: string, newRole: MembershipRole) => {
    setIsUpdating(true);
    setError(null);

    try {
      const res = await fetch(`/api/trees/${tree.id}/members`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId, role: newRole }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || 'Failed to change role');
      }

      // Refresh member list
      await loadMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRemove = async (targetUserId: string) => {
    const confirmed = window.confirm(
      'Are you sure you want to remove this member? They will lose access to this tree immediately.'
    );
    if (!confirmed) return;

    setIsUpdating(true);
    setError(null);

    try {
      const res = await fetch(`/api/trees/${tree.id}/members`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || 'Failed to remove member');
      }

      // Refresh member list
      await loadMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Members</h1>
        <p className="mt-1 text-sm text-stone-600">
          Manage members and invite new people to &ldquo;{tree.name}&rdquo;.
        </p>
      </div>

      {/* Error display */}
      {error && (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {/* Member List */}
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-stone-900">Current Members</h2>
        <p className="mt-1 text-sm text-stone-600">
          {members.length} {members.length === 1 ? 'member' : 'members'} in this tree.
        </p>

        <div className="mt-4">
          {isLoading ? (
            <div className="py-8 text-center text-sm text-stone-500">
              Loading members...
            </div>
          ) : members.length === 0 ? (
            <div className="py-8 text-center text-sm text-stone-500">
              No members found.
            </div>
          ) : (
            <div className="divide-y divide-stone-100">
              {members.map((member) => (
                <MemberRow
                  key={member.id}
                  member={member}
                  currentMembershipId={membershipId}
                  onRoleChange={handleRoleChange}
                  onRemove={handleRemove}
                  isUpdating={isUpdating}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Invite Link Generation */}
      <InviteSection treeId={tree.id} onInviteGenerated={() => setInviteRefreshKey((k) => k + 1)} />

      {/* Active Invite Links */}
      <ActiveInvitesSection treeId={tree.id} refreshKey={inviteRefreshKey} />
    </div>
  );
}
