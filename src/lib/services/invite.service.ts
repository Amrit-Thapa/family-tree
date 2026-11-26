import crypto from 'crypto';
import { Types } from 'mongoose';
import { connectDB } from '@/lib/db/connection';
import Invite, { IInvite, InviteRelationshipType } from '@/lib/db/models/Invite';
import Membership from '@/lib/db/models/Membership';
import TreeNode from '@/lib/db/models/TreeNode';
import Person from '@/lib/db/models/Person';
import Relationship from '@/lib/db/models/Relationship';
import User from '@/lib/db/models/User';
import { toObjectId } from '@/lib/utils/mongo';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '@/lib/utils/errors';
import {
  INVITE_DEFAULT_EXPIRY_DAYS,
  DEFAULT_MAX_USES,
  INVITE_LABEL_MAX,
  MAX_USES_LIMIT,
} from '@/lib/constants/invite';
import type { MembershipRole } from '@/lib/types/membership';

// --- Types ---

export interface InviteResult {
  id: string;
  treeId: string;
  role: MembershipRole;
  token: string;
  label?: string;
  invitedBy: string;
  status: string;
  maxUses: number;
  usedCount: number;
  expiresAt: Date;
  createdAt: Date;
  inviteUrl: string;
}

export interface CreateInviteOptions {
  treeId: string;
  role: MembershipRole;
  invitedBy: string;
  label?: string;
  maxUses?: number;
  expiresInDays?: number;
  relationshipType?: InviteRelationshipType;
  targetPersonNodeId?: string;
  inviteeIsParent?: boolean;
}

export interface AcceptInviteResult {
  membershipId: string;
  treeId: string;
  role: MembershipRole;
  relationshipCreated?: boolean;
  relationshipError?: string;
}

// --- Internal Helpers ---

/**
 * Generates a cryptographically random URL-safe token.
 */
function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Builds the full invite URL from a token.
 */
function buildInviteUrl(token: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return `${baseUrl}/invite/${token}`;
}

/**
 * Converts an Invite document to the public result shape.
 */
function toInviteResult(invite: IInvite): InviteResult {
  return {
    id: invite._id.toString(),
    treeId: invite.treeId.toString(),
    role: invite.role,
    token: invite.token,
    label: invite.label,
    invitedBy: invite.invitedBy.toString(),
    status: invite.computedStatus(),
    maxUses: invite.maxUses,
    usedCount: invite.usedCount,
    expiresAt: invite.expiresAt,
    createdAt: invite.createdAt,
    inviteUrl: buildInviteUrl(invite.token),
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
): Promise<void> {
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
}

// --- Public API ---

/**
 * Creates a new invite link for a family tree.
 *
 * Generates a cryptographically random token, sets expiry and maxUses,
 * and returns the full invite URL.
 *
 * @param options - The invite creation options
 * @returns The created invite with full URL
 * @throws ValidationError if input is invalid
 * @throws ForbiddenError if the actor is not an admin of the tree
 */
export async function createInviteLink(
  options: CreateInviteOptions
): Promise<InviteResult> {
  await connectDB();

  const {
    treeId,
    role,
    invitedBy,
    label,
    maxUses = DEFAULT_MAX_USES,
    expiresInDays = INVITE_DEFAULT_EXPIRY_DAYS,
    relationshipType,
    targetPersonNodeId,
    inviteeIsParent,
  } = options;

  // Validate IDs
  const treeObjectId = toObjectId(treeId, 'treeId');
  const invitedByObjectId = toObjectId(invitedBy, 'invitedBy');

  // Validate role
  const validRoles: MembershipRole[] = ['admin', 'editor', 'viewer'];
  if (!validRoles.includes(role)) {
    throw new ValidationError(
      'Role must be admin, editor, or viewer',
      'INVALID_ROLE',
      { field: 'role' }
    );
  }

  // Validate label
  if (label !== undefined && label.length > INVITE_LABEL_MAX) {
    throw new ValidationError(
      `Label must be ${INVITE_LABEL_MAX} characters or less`,
      'INVALID_LABEL',
      { field: 'label' }
    );
  }

  // Validate maxUses
  if (maxUses < 1 || maxUses > MAX_USES_LIMIT) {
    throw new ValidationError(
      `Max uses must be between 1 and ${MAX_USES_LIMIT}`,
      'INVALID_MAX_USES',
      { field: 'maxUses' }
    );
  }

  // Validate expiresInDays
  if (expiresInDays < 1 || expiresInDays > 30) {
    throw new ValidationError(
      'Expiry must be between 1 and 30 days',
      'INVALID_EXPIRY',
      { field: 'expiresInDays' }
    );
  }

  // Validate relationship fields
  if (relationshipType) {
    const validRelTypes: InviteRelationshipType[] = ['father', 'mother', 'spouse'];
    if (!validRelTypes.includes(relationshipType)) {
      throw new ValidationError(
        'Relationship type must be father, mother, or spouse',
        'INVALID_RELATIONSHIP_TYPE',
        { field: 'relationshipType' }
      );
    }

    if (!targetPersonNodeId) {
      throw new ValidationError(
        'Target person node ID is required when relationship type is specified',
        'MISSING_TARGET_PERSON',
        { field: 'targetPersonNodeId' }
      );
    }

    const targetNodeObjectId = toObjectId(targetPersonNodeId, 'targetPersonNodeId');

    // Validate that the target TreeNode exists, is active, and belongs to this tree
    const targetNode = await TreeNode.findOne({
      _id: targetNodeObjectId,
      treeId: treeObjectId,
      deletedAt: null,
    });

    if (!targetNode) {
      throw new ValidationError(
        'The selected person is not available. They may not exist or have been removed from the tree.',
        'TARGET_PERSON_NOT_AVAILABLE',
        { field: 'targetPersonNodeId' }
      );
    }
  }

  // Authorization: actor must be admin
  await requireAdmin(treeObjectId, invitedByObjectId, 'create invite links');

  // Generate token and compute expiry
  const token = generateToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  // Build invite data with optional relationship fields
  const inviteData: Record<string, unknown> = {
    treeId: treeObjectId,
    role,
    token,
    label: label || undefined,
    invitedBy: invitedByObjectId,
    status: 'active',
    maxUses,
    usedCount: 0,
    expiresAt,
    acceptedBy: [],
  };

  if (relationshipType) {
    inviteData.relationshipType = relationshipType;
    inviteData.targetPersonNodeId = toObjectId(targetPersonNodeId!, 'targetPersonNodeId');

    // For father/mother, store inviteeIsParent; for spouse, do not store it
    if ((relationshipType === 'father' || relationshipType === 'mother') && inviteeIsParent !== undefined) {
      inviteData.inviteeIsParent = inviteeIsParent;
    }
  }

  // Create the invite
  const invite = await Invite.create(inviteData);

  return toInviteResult(invite);
}

/**
 * Accepts an invite link. Validates the token, checks expiry and usage limits,
 * checks for existing membership, creates a Membership, increments usedCount,
 * and records the acceptedBy entry.
 *
 * @param token - The invite token from the URL
 * @param userId - The ID of the user accepting the invite
 * @returns The created membership info
 * @throws NotFoundError if the token is invalid
 * @throws ValidationError if the invite is expired, exhausted, or revoked
 * @throws ConflictError if the user is already a member of the tree
 */
export async function acceptInvite(
  token: string,
  userId: string
): Promise<AcceptInviteResult> {
  await connectDB();

  const userObjectId = toObjectId(userId, 'userId');

  // Find the invite by token
  const invite = await Invite.findOne({ token });

  if (!invite) {
    throw new NotFoundError(
      'Invite link not found or is invalid',
      'INVITE_NOT_FOUND'
    );
  }

  // Check computed status
  const status = invite.computedStatus();

  if (status === 'revoked') {
    throw new ValidationError(
      'This invite link has been revoked',
      'INVITE_REVOKED'
    );
  }

  if (status === 'expired') {
    throw new ValidationError(
      'This invite link has expired. Please request a new invite from the admin.',
      'INVITE_EXPIRED'
    );
  }

  if (status === 'exhausted') {
    throw new ValidationError(
      'This invite link has reached its maximum number of uses',
      'INVITE_EXHAUSTED'
    );
  }

  // Check if user is already a member of this tree
  const existingMembership = await Membership.findOne({
    userId: userObjectId,
    treeId: invite.treeId,
    deletedAt: null,
  });

  if (existingMembership) {
    throw new ConflictError(
      'You are already a member of this family tree',
      'ALREADY_MEMBER'
    );
  }

  // Atomically accept the invite (prevents race conditions)
  const updatedInvite = await Invite.acceptForUser(invite._id, userObjectId);

  if (!updatedInvite) {
    // Race condition: another request used the last slot or user already accepted
    throw new ValidationError(
      'Unable to accept invite. It may have been used by another request.',
      'INVITE_ACCEPT_FAILED'
    );
  }

  // Mark invite as exhausted if usedCount reached maxUses
  if (updatedInvite.usedCount >= updatedInvite.maxUses) {
    updatedInvite.status = 'exhausted';
    await updatedInvite.save();
  }

  // Create the membership
  const membership = await Membership.create({
    userId: userObjectId,
    treeId: invite.treeId,
    role: invite.role,
    invitedBy: invite.invitedBy,
  });

  // Ensure the invitee has a Person + TreeNode in the tree (required for graph visibility)
  let inviteeTreeNode = await TreeNode.findOne({
    treeId: invite.treeId,
    linkedUserId: userObjectId,
    deletedAt: null,
  });

  if (!inviteeTreeNode) {
    // Check if this is a "claim node" invite — link user to existing node
    if (invite.claimNodeId) {
      const claimNode = await TreeNode.findOne({
        _id: invite.claimNodeId,
        treeId: invite.treeId,
        deletedAt: null,
        linkedUserId: null, // Must still be unclaimed
      });

      if (claimNode) {
        // Link the user to the existing TreeNode
        claimNode.linkedUserId = userObjectId;
        await claimNode.save();

        // Overwrite the Person's name with the user's Google account name
        const user = await User.findById(userObjectId);
        if (user?.displayName) {
          const nameParts = user.displayName.split(' ');
          const firstName = nameParts[0] || 'Unknown';
          const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : undefined;

          await Person.findByIdAndUpdate(claimNode.personId, {
            $set: {
              firstName,
              ...(lastName ? { lastName } : {}),
            },
          });
        }

        inviteeTreeNode = claimNode;
      } else {
        // Claim node was already claimed or deleted — fall through to create new
        const user = await User.findById(userObjectId);
        const displayName = user?.displayName || 'Unknown';
        const nameParts = displayName.split(' ');
        const firstName = nameParts[0] || 'Unknown';
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : undefined;

        const person = await Person.create({
          firstName,
          lastName,
          createdBy: userObjectId,
        });

        inviteeTreeNode = await TreeNode.create({
          personId: person._id,
          treeId: invite.treeId,
          linkedUserId: userObjectId,
          addedBy: invite.invitedBy,
        });
      }
    } else {
      // Standard invite — create new Person + TreeNode
      const user = await User.findById(userObjectId);
      const displayName = user?.displayName || 'Unknown';
      const nameParts = displayName.split(' ');
      const firstName = nameParts[0] || 'Unknown';
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : undefined;

      const person = await Person.create({
        firstName,
        lastName,
        createdBy: userObjectId,
      });

      inviteeTreeNode = await TreeNode.create({
        personId: person._id,
        treeId: invite.treeId,
        linkedUserId: userObjectId,
        addedBy: invite.invitedBy,
      });
    }
  }

  // Auto-create relationship if invite has relationship info
  let relationshipCreated: boolean | undefined;
  let relationshipError: string | undefined;

  if (invite.relationshipType && invite.targetPersonNodeId) {
    try {
      // Look up the target TreeNode to get its personId
      const targetTreeNode = await TreeNode.findOne({
        _id: invite.targetPersonNodeId,
        treeId: invite.treeId,
        deletedAt: null,
      });

      if (!targetTreeNode) {
        throw new Error('Target person node no longer exists in the tree');
      }

      // Determine fromPersonId and toPersonId based on relationship type and direction
      let fromPersonId: Types.ObjectId;
      let toPersonId: Types.ObjectId;

      if (invite.relationshipType === 'father' || invite.relationshipType === 'mother') {
        if (invite.inviteeIsParent) {
          // Invitee is the parent: from = invitee, to = target (child)
          fromPersonId = inviteeTreeNode.personId;
          toPersonId = targetTreeNode.personId;
        } else {
          // Invitee is the child: from = target (parent), to = invitee
          fromPersonId = targetTreeNode.personId;
          toPersonId = inviteeTreeNode.personId;
        }
      } else {
        // Spouse: normalize direction by sorting person IDs alphabetically
        const inviteePersonStr = inviteeTreeNode.personId.toString();
        const targetPersonStr = targetTreeNode.personId.toString();
        if (inviteePersonStr < targetPersonStr) {
          fromPersonId = inviteeTreeNode.personId;
          toPersonId = targetTreeNode.personId;
        } else {
          fromPersonId = targetTreeNode.personId;
          toPersonId = inviteeTreeNode.personId;
        }
      }

      // Create the Relationship edge
      await Relationship.create({
        treeId: invite.treeId,
        fromPersonId,
        toPersonId,
        type: invite.relationshipType,
        spouseStatus: invite.relationshipType === 'spouse' ? 'active' : undefined,
        createdBy: invite.invitedBy,
      });

      relationshipCreated = true;
    } catch (error: unknown) {
      // Relationship creation failed — membership still succeeds
      relationshipCreated = false;
      relationshipError =
        error instanceof Error
          ? error.message
          : 'Relationship could not be created automatically';
    }
  }

  const result: AcceptInviteResult = {
    membershipId: membership._id.toString(),
    treeId: invite.treeId.toString(),
    role: invite.role,
  };

  if (relationshipCreated !== undefined) {
    result.relationshipCreated = relationshipCreated;
  }
  if (relationshipError) {
    result.relationshipError = relationshipError;
  }

  return result;
}

/**
 * Revokes an active invite link.
 *
 * @param inviteId - The ID of the invite to revoke
 * @param actorUserId - The ID of the user performing the revocation (must be admin)
 * @returns The revoked invite
 * @throws ValidationError if IDs are invalid
 * @throws ForbiddenError if the actor is not an admin
 * @throws NotFoundError if the invite does not exist or is not active
 */
export async function revokeInvite(
  inviteId: string,
  actorUserId: string
): Promise<InviteResult> {
  await connectDB();

  const inviteObjectId = toObjectId(inviteId, 'inviteId');
  const actorUserObjectId = toObjectId(actorUserId, 'actorUserId');

  // Find the invite
  const invite = await Invite.findById(inviteObjectId);

  if (!invite) {
    throw new NotFoundError(
      'Invite not found',
      'INVITE_NOT_FOUND'
    );
  }

  // Authorization: actor must be admin of the invite's tree
  await requireAdmin(invite.treeId, actorUserObjectId, 'revoke invite links');

  // Check if invite is already revoked or not active
  const currentStatus = invite.computedStatus();
  if (currentStatus !== 'active') {
    throw new ValidationError(
      `Cannot revoke an invite that is already ${currentStatus}`,
      'INVITE_NOT_ACTIVE'
    );
  }

  // Revoke the invite
  invite.status = 'revoked';
  await invite.save();

  return toInviteResult(invite);
}

/**
 * Lists all active invite links for a family tree.
 *
 * @param treeId - The ID of the tree
 * @param actorUserId - The ID of the user requesting the list (must be admin)
 * @returns Array of active invites
 * @throws ValidationError if IDs are invalid
 * @throws ForbiddenError if the actor is not an admin
 */
export async function listActiveInvites(
  treeId: string,
  actorUserId: string
): Promise<InviteResult[]> {
  await connectDB();

  const treeObjectId = toObjectId(treeId, 'treeId');
  const actorUserObjectId = toObjectId(actorUserId, 'actorUserId');

  // Authorization: actor must be admin
  await requireAdmin(treeObjectId, actorUserObjectId, 'view invite links');

  // Find all invites for this tree that are still active
  // We query for status 'active' and then filter by computed status
  // to handle cases where expiry has passed but status wasn't updated
  const invites = await Invite.find({
    treeId: treeObjectId,
    status: 'active',
  }).sort({ createdAt: -1 });

  // Filter to only truly active invites (not expired by time)
  const activeInvites = invites.filter(
    (invite) => invite.computedStatus() === 'active'
  );

  return activeInvites.map(toInviteResult);
}
