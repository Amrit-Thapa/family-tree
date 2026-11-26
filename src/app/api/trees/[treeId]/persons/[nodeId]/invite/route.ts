import { NextRequest } from 'next/server';
import { z } from 'zod';
import { connectDB } from '@/lib/db/connection';
import { requireSession } from '@/lib/auth/require-session';
import { apiHandlerWithParams } from '@/lib/utils/api-handler';
import { validateBody } from '@/lib/utils/validate-body';
import { verifyTreeMembership } from '@/lib/utils/verify-tree-membership';
import { toObjectId } from '@/lib/utils/mongo';
import { ConflictError, NotFoundError } from '@/lib/utils/errors';
import TreeNode from '@/lib/db/models/TreeNode';
import Invite from '@/lib/db/models/Invite';
import crypto from 'crypto';

const createClaimInviteSchema = z.object({
  role: z.enum(['admin', 'editor', 'viewer']),
});

/**
 * POST /api/trees/[treeId]/persons/[nodeId]/invite
 *
 * Generates a claim invite link for a profile-only person node.
 * When someone accepts this invite, their account gets linked to this node.
 *
 * - Only works for nodes with no linkedUserId (profile-only)
 * - One active claim invite per node at a time
 * - Single use (maxUses: 1)
 * - Expires in 7 days
 *
 * Request body: { role: 'admin' | 'editor' | 'viewer' }
 * Success response: 201 { invite: { token, url, expiresAt } }
 */
export const POST = apiHandlerWithParams<{ treeId: string; nodeId: string }>(
  async (request: NextRequest, { params }) => {
    const { treeId, nodeId } = await params;
    const session = await requireSession();

    // Verify user is an admin of this tree
    await verifyTreeMembership(session.userId, treeId, 'admin');

    const input = await validateBody(request, createClaimInviteSchema);

    await connectDB();

    const treeObjectId = toObjectId(treeId, 'treeId');
    const nodeObjectId = toObjectId(nodeId, 'nodeId');

    // Verify the node exists and is profile-only (no linked user)
    const treeNode = await TreeNode.findOne({
      _id: nodeObjectId,
      treeId: treeObjectId,
      deletedAt: null,
    });

    if (!treeNode) {
      throw new NotFoundError('Person not found in this tree', 'PERSON_NOT_FOUND');
    }

    if (treeNode.linkedUserId) {
      throw new ConflictError(
        'This person already has a linked account',
        'ALREADY_CLAIMED'
      );
    }

    // Revoke any existing active claim invites for this node
    await Invite.updateMany(
      {
        treeId: treeObjectId,
        claimNodeId: nodeObjectId,
        status: 'active',
      },
      { $set: { status: 'revoked' } }
    );

    // Generate a new claim invite
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    const invite = await Invite.create({
      treeId: treeObjectId,
      role: input.role,
      token,
      label: `Claim invite for node`,
      invitedBy: toObjectId(session.userId, 'userId'),
      status: 'active',
      maxUses: 1,
      usedCount: 0,
      expiresAt,
      acceptedBy: [],
      claimNodeId: nodeObjectId,
    });

    // Build the invite URL
    const baseUrl = request.headers.get('origin') || request.headers.get('host') || '';
    const protocol = baseUrl.startsWith('http') ? '' : 'http://';
    const url = `${protocol}${baseUrl}/invite/${invite.token}`;

    return Response.json(
      {
        invite: {
          token: invite.token,
          url,
          expiresAt: invite.expiresAt.toISOString(),
          role: invite.role,
        },
      },
      { status: 201 }
    );
  }
);
