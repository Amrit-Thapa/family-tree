import { notFound } from 'next/navigation';
import { Types } from 'mongoose';
import { verifySession } from '@/lib/auth/session';
import { connectDB } from '@/lib/db/connection';
import FamilyTree from '@/lib/db/models/FamilyTree';
import Membership from '@/lib/db/models/Membership';
import type { IFamilyTree } from '@/lib/db/models/FamilyTree';
import type { IMembership } from '@/lib/db/models/Membership';
import TreeProvider from '@/components/tree/TreeProvider';

/**
 * Tree-scoped layout that verifies the user's membership in the tree,
 * determines their role, and provides tree context to child routes.
 *
 * Authorization logic:
 * 1. Verify the user's session (parent layout already does this, but we
 *    need the userId for membership lookup).
 * 2. Validate the treeId format.
 * 3. Look up the FamilyTree (must exist and not be soft-deleted).
 * 4. Look up the user's Membership (must exist and not be soft-deleted).
 * 5. If tree not found or no membership → notFound() (avoids leaking tree existence).
 * 6. Provide tree data and role to child routes via TreeProvider context.
 */
export default async function TreeLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ treeId: string }>;
}) {
  const { treeId } = await params;

  // Verify session to get the current user's ID
  const session = await verifySession();
  if (!session) {
    // Parent protected layout should have already redirected, but guard here too
    notFound();
  }

  // Validate treeId format
  if (!Types.ObjectId.isValid(treeId)) {
    notFound();
  }

  await connectDB();

  // Look up the tree (must exist and not be soft-deleted)
  const tree = await FamilyTree.findOne({
    _id: new Types.ObjectId(treeId),
    deletedAt: null,
  }).lean<IFamilyTree>();

  if (!tree) {
    notFound();
  }

  // Look up the user's membership (must exist and not be soft-deleted)
  const membership = await Membership.findOne({
    userId: new Types.ObjectId(session.userId),
    treeId: new Types.ObjectId(treeId),
    deletedAt: null,
  }).lean<IMembership>();

  if (!membership) {
    // Return 404 instead of 403 to avoid leaking tree existence
    notFound();
  }

  // Serialize tree data for the client context provider
  const treeData = {
    id: tree._id.toString(),
    name: tree.name,
    description: tree.description ?? null,
    createdBy: tree.createdBy.toString(),
    createdAt: tree.createdAt.toISOString(),
    updatedAt: tree.updatedAt.toISOString(),
  };

  return (
    <TreeProvider
      tree={treeData}
      role={membership.role}
      membershipId={membership._id.toString()}
    >
      {children}
    </TreeProvider>
  );
}
