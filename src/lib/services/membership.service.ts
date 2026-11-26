import { Types } from 'mongoose';
import { connectDB } from '@/lib/db/connection';
import Membership, { IMembership } from '@/lib/db/models/Membership';
import type { MembershipRole } from '@/lib/types/membership';
import { toObjectId } from '@/lib/utils/mongo';
import { withOptionalTransaction } from '@/lib/utils/transaction';
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '@/lib/utils/errors';

// --- Types ---

export interface MemberResult {
  id: string;
  userId: string;
  treeId: string;
  role: MembershipRole;
  joinedAt: Date;
  invitedBy: string | null;
}

// --- Internal Helpers ---

function toMemberResult(membership: IMembership): MemberResult {
  return {
    id: membership._id.toString(),
    userId: membership.userId.toString(),
    treeId: membership.treeId.toString(),
    role: membership.role,
    joinedAt: membership.joinedAt,
    invitedBy: membership.invitedBy?.toString() ?? null,
  };
}

/**
 * Verifies that the actor is an active admin of the given tree.
 * Throws ForbiddenError if not.
 */
async function requireAdmin(
  treeObjectId: Types.ObjectId,
  actorUserObjectId: Types.ObjectId,
  action: string
): Promise<IMembership> {
  const actorMembership = await Membership.findOne({
    treeId: treeObjectId,
    userId: actorUserObjectId,
    role: 'admin',
    deletedAt: null,
  });

  if (!actorMembership) {
    throw new ForbiddenError(
      `Only an admin can ${action}`,
      'NOT_ADMIN'
    );
  }

  return actorMembership;
}

/**
 * Finds an active membership for the given user in the given tree.
 * Throws NotFoundError if not found.
 */
async function findActiveMembership(
  treeObjectId: Types.ObjectId,
  userObjectId: Types.ObjectId
): Promise<IMembership> {
  const membership = await Membership.findOne({
    treeId: treeObjectId,
    userId: userObjectId,
    deletedAt: null,
  });

  if (!membership) {
    throw new NotFoundError(
      'Member not found in this family tree',
      'MEMBER_NOT_FOUND'
    );
  }

  return membership;
}

/**
 * Checks if the tree has more than one admin. Throws ForbiddenError if not.
 */
async function enforceLastAdminProtection(
  treeObjectId: Types.ObjectId,
  errorCode: string
): Promise<void> {
  const adminCount = await Membership.countDocuments({
    treeId: treeObjectId,
    role: 'admin',
    deletedAt: null,
  });

  if (adminCount <= 1) {
    throw new ForbiddenError(
      'Cannot remove or demote the last admin. Promote another member to admin first.',
      errorCode
    );
  }
}



// --- Public API ---

/**
 * Lists all active members of a family tree.
 *
 * @param treeId - The ID of the tree
 * @returns Array of active memberships
 * @throws ValidationError if treeId format is invalid
 */
export async function getMembers(treeId: string): Promise<MemberResult[]> {
  await connectDB();

  const treeObjectId = toObjectId(treeId, 'treeId');

  const memberships = await Membership.find({
    treeId: treeObjectId,
    deletedAt: null,
  })
    .sort({ joinedAt: 1 })
    .lean<IMembership[]>();

  return memberships.map(toMemberResult);
}

/**
 * Changes a member's role within a family tree.
 *
 * Enforces last-admin protection: cannot demote the last remaining admin.
 * Uses a transaction to prevent race conditions on the admin count check.
 *
 * @param treeId - The ID of the tree
 * @param targetUserId - The ID of the user whose role is being changed
 * @param newRole - The new role to assign
 * @param actorUserId - The ID of the user performing the action (must be admin)
 * @returns The updated membership
 * @throws ValidationError if any ID format is invalid
 * @throws ForbiddenError if actor is not an admin
 * @throws NotFoundError if target membership does not exist
 * @throws ForbiddenError if demoting the last admin
 */
export async function changeMemberRole(
  treeId: string,
  targetUserId: string,
  newRole: MembershipRole,
  actorUserId: string
): Promise<MemberResult> {
  await connectDB();

  const treeObjectId = toObjectId(treeId, 'treeId');
  const targetUserObjectId = toObjectId(targetUserId, 'targetUserId');
  const actorUserObjectId = toObjectId(actorUserId, 'actorUserId');

  return withOptionalTransaction(async () => {
    await requireAdmin(treeObjectId, actorUserObjectId, 'change member roles');

    const targetMembership = await findActiveMembership(treeObjectId, targetUserObjectId);

    // No-op if the role is already the same
    if (targetMembership.role === newRole) {
      return toMemberResult(targetMembership);
    }

    // Last-admin protection: if demoting an admin, ensure they are not the last one
    if (targetMembership.role === 'admin' && newRole !== 'admin') {
      await enforceLastAdminProtection(treeObjectId, 'LAST_ADMIN_DEMOTION');
    }

    // Apply the role change
    targetMembership.role = newRole;
    await targetMembership.save();

    return toMemberResult(targetMembership);
  });
}

/**
 * Removes a member from a family tree using soft delete.
 *
 * Enforces last-admin protection: cannot remove the last remaining admin.
 * Prevents self-removal — admins should use a dedicated "leave tree" flow.
 * Access is revoked immediately (soft-deleted membership is excluded from
 * all active queries).
 *
 * Uses a transaction to prevent race conditions on the admin count check.
 *
 * @param treeId - The ID of the tree
 * @param targetUserId - The ID of the user being removed
 * @param actorUserId - The ID of the user performing the removal (must be admin)
 * @returns The removed membership
 * @throws ValidationError if any ID format is invalid or actor tries self-removal
 * @throws ForbiddenError if actor is not an admin
 * @throws NotFoundError if target membership does not exist
 * @throws ForbiddenError if removing the last admin
 */
export async function removeMember(
  treeId: string,
  targetUserId: string,
  actorUserId: string
): Promise<MemberResult> {
  await connectDB();

  const treeObjectId = toObjectId(treeId, 'treeId');
  const targetUserObjectId = toObjectId(targetUserId, 'targetUserId');
  const actorUserObjectId = toObjectId(actorUserId, 'actorUserId');

  // Prevent self-removal via this endpoint
  if (targetUserId === actorUserId) {
    throw new ValidationError(
      'Cannot remove yourself. Use the "Leave tree" option instead.',
      'SELF_REMOVAL',
      { field: 'targetUserId' }
    );
  }

  return withOptionalTransaction(async () => {
    await requireAdmin(treeObjectId, actorUserObjectId, 'remove members');

    const targetMembership = await findActiveMembership(treeObjectId, targetUserObjectId);

    // Last-admin protection: if removing an admin, ensure they are not the last one
    if (targetMembership.role === 'admin') {
      await enforceLastAdminProtection(treeObjectId, 'LAST_ADMIN_REMOVAL');
    }

    // Soft delete: set deletedAt and deletedBy for immediate access revocation
    targetMembership.deletedAt = new Date();
    targetMembership.deletedBy = actorUserObjectId;
    await targetMembership.save();

    return toMemberResult(targetMembership);
  });
}

/**
 * Gets a user's active membership for a specific tree.
 * Used for authorization checks throughout the application.
 *
 * @param userId - The ID of the user
 * @param treeId - The ID of the tree
 * @returns The membership if found, or null if the user is not an active member
 * @throws ValidationError if any ID format is invalid
 */
export async function getMembership(
  userId: string,
  treeId: string
): Promise<MemberResult | null> {
  await connectDB();

  const userObjectId = toObjectId(userId, 'userId');
  const treeObjectId = toObjectId(treeId, 'treeId');

  const membership = await Membership.findOne({
    userId: userObjectId,
    treeId: treeObjectId,
    deletedAt: null,
  }).lean<IMembership>();

  if (!membership) {
    return null;
  }

  return toMemberResult(membership);
}
