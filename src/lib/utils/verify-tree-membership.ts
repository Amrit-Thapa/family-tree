import { Types } from 'mongoose';
import { connectDB } from '@/lib/db/connection';
import Membership from '@/lib/db/models/Membership';
import { NotFoundError } from '@/lib/utils/errors';
import type { MembershipRole } from '@/lib/types/membership';

export interface TreeMembershipResult {
  role: MembershipRole;
  membershipId: string;
}

/**
 * Verifies that a user has an active membership on a tree.
 * Optionally checks for a specific role (or set of roles).
 *
 * Returns the user's role and membershipId on success — useful for downstream
 * authorization decisions and audit logging without a second DB query.
 *
 * Throws NotFoundError (404) if no membership exists — avoids leaking tree existence.
 *
 * @param userId - The authenticated user's ID
 * @param treeId - The tree ID from the URL params
 * @param requiredRole - Optional role or array of roles the user must have
 * @returns The user's membership role and ID
 * @throws NotFoundError if treeId is invalid, tree doesn't exist, or user has no access
 */
export async function verifyTreeMembership(
  userId: string,
  treeId: string,
  requiredRole?: MembershipRole | MembershipRole[]
): Promise<TreeMembershipResult> {
  if (!Types.ObjectId.isValid(treeId)) {
    throw new NotFoundError('Family tree not found', 'TREE_NOT_FOUND');
  }

  await connectDB();

  const query: Record<string, unknown> = {
    userId: new Types.ObjectId(userId),
    treeId: new Types.ObjectId(treeId),
    deletedAt: null,
  };

  if (requiredRole) {
    query.role = Array.isArray(requiredRole)
      ? { $in: requiredRole }
      : requiredRole;
  }

  const membership = await Membership.findOne(query).lean<{
    _id: Types.ObjectId;
    role: MembershipRole;
  }>();

  if (!membership) {
    throw new NotFoundError('Family tree not found', 'TREE_NOT_FOUND');
  }

  return {
    role: membership.role,
    membershipId: membership._id.toString(),
  };
}
