import { NextRequest } from 'next/server';
import { requireSession } from '@/lib/auth/require-session';
import { acceptInvite } from '@/lib/services/invite.service';
import { apiHandlerWithParams } from '@/lib/utils/api-handler';

/**
 * POST /api/invites/[token]/accept
 *
 * Accepts an invite link. The authenticated user joins the family tree
 * associated with the invite token at the specified role.
 *
 * Validates:
 * - User is authenticated (has valid session)
 * - Token exists and is valid
 * - Invite has not expired
 * - Invite has not exceeded its maximum use count
 * - User is not already a member of the tree
 *
 * Success response: 200 { membership: { membershipId, treeId, role } }
 * Error responses:
 *   401 - Not authenticated
 *   404 - Token not found / invalid
 *   400 - Invite expired, exhausted, or revoked
 *   409 - User is already a member of the tree
 *   500 - Unexpected error
 */
export const POST = apiHandlerWithParams<{ token: string }>(
  async (_request: NextRequest, { params }) => {
    const { token } = await params;
    const session = await requireSession();

    const result = await acceptInvite(token, session.userId);

    return Response.json({ membership: result }, { status: 200 });
  }
);
