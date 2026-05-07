import { Types } from 'mongoose';
import { connectDB } from '@/lib/db/connection';
import FamilyTree, { IFamilyTree } from '@/lib/db/models/FamilyTree';
import Membership from '@/lib/db/models/Membership';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '@/lib/utils/errors';
import { CreateTreeInput, UpdateTreeInput } from '@/lib/validations/tree';

// --- Constants ---

export const MAX_TREES_PER_USER = 20;
export const RESTORE_WINDOW_DAYS = 30;
export const RESTORE_WINDOW_MS = RESTORE_WINDOW_DAYS * 24 * 60 * 60 * 1000;

// --- Types ---

export interface TreeResult {
  id: string;
  name: string;
  description: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  deletedBy: string | null;
  totalStorageBytes: number;
  storageLimit: number;
}

export interface CreateTreeResult {
  tree: TreeResult;
  membership: {
    id: string;
    userId: string;
    treeId: string;
    role: 'admin';
    joinedAt: Date;
  };
}

// --- Helpers ---

/**
 * Validates and converts a string to a Mongoose ObjectId.
 * Throws a ValidationError if the format is invalid.
 */
function toObjectId(id: string, label: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) {
    throw new ValidationError(`Invalid ${label} ID format`, 'INVALID_ID', {
      field: label,
    });
  }
  return new Types.ObjectId(id);
}

/**
 * Checks if a Mongoose error is a duplicate key error (code 11000).
 */
function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: number }).code === 11000
  );
}

function toTreeResult(tree: IFamilyTree): TreeResult {
  return {
    id: tree._id.toString(),
    name: tree.name,
    description: tree.description ?? null,
    createdBy: tree.createdBy.toString(),
    createdAt: tree.createdAt,
    updatedAt: tree.updatedAt,
    deletedAt: tree.deletedAt,
    deletedBy: tree.deletedBy?.toString() ?? null,
    totalStorageBytes: tree.totalStorageBytes,
    storageLimit: tree.storageLimit,
  };
}

// --- Public API ---

/**
 * Creates a new family tree with the given name and description.
 *
 * Validates:
 * 1. Name uniqueness per user (among non-deleted trees created by this user)
 * 2. 20-tree limit (active trees where user is admin)
 *
 * Creates:
 * - FamilyTree record
 * - Initial Admin Membership for the creating user
 *
 * Handles race conditions: if a concurrent request creates a tree with the
 * same name, the unique index will reject the duplicate and we map the
 * Mongo duplicate key error to a clean ConflictError.
 *
 * @param userId - The ID of the user creating the tree
 * @param input - Validated tree creation input (name, description)
 * @returns The created tree and membership
 * @throws ValidationError if userId format is invalid
 * @throws ConflictError if tree name already exists for this user
 * @throws ValidationError if user has reached the 20-tree limit
 */
export async function createTree(
  userId: string,
  input: CreateTreeInput
): Promise<CreateTreeResult> {
  await connectDB();

  const userObjectId = toObjectId(userId, 'userId');

  // Check name uniqueness: no active (non-deleted) tree with same name by this user
  const existingTree = await FamilyTree.findOne({
    createdBy: userObjectId,
    name: input.name,
    deletedAt: null,
  });

  if (existingTree) {
    throw new ConflictError(
      'A family tree with this name already exists',
      'TREE_NAME_EXISTS',
      { field: 'name' }
    );
  }

  // Enforce 20-tree limit: count active trees where user is admin
  const adminTreeCount = await Membership.countDocuments({
    userId: userObjectId,
    role: 'admin',
    deletedAt: null,
  });

  if (adminTreeCount >= MAX_TREES_PER_USER) {
    throw new ValidationError(
      `You have reached the maximum limit of ${MAX_TREES_PER_USER} family trees`,
      'TREE_LIMIT_REACHED'
    );
  }

  // Create the FamilyTree record — handle race condition via unique index
  let tree: IFamilyTree;
  try {
    tree = await FamilyTree.create({
      name: input.name,
      description: input.description,
      createdBy: userObjectId,
    });
  } catch (error: unknown) {
    if (isDuplicateKeyError(error)) {
      throw new ConflictError(
        'A family tree with this name already exists',
        'TREE_NAME_EXISTS',
        { field: 'name' }
      );
    }
    throw error;
  }

  // Create the initial Admin Membership
  const membership = await Membership.create({
    userId: userObjectId,
    treeId: tree._id,
    role: 'admin',
    joinedAt: new Date(),
  });

  return {
    tree: toTreeResult(tree),
    membership: {
      id: membership._id.toString(),
      userId: membership.userId.toString(),
      treeId: membership.treeId.toString(),
      role: 'admin',
      joinedAt: membership.joinedAt,
    },
  };
}

/**
 * Fetches a family tree by ID, ensuring it is not soft-deleted.
 *
 * @param treeId - The ID of the tree to fetch
 * @returns The tree data
 * @throws ValidationError if treeId format is invalid
 * @throws NotFoundError if tree does not exist or is soft-deleted
 */
export async function getTree(treeId: string): Promise<TreeResult> {
  await connectDB();

  const treeObjectId = toObjectId(treeId, 'treeId');

  const tree = await FamilyTree.findOne({
    _id: treeObjectId,
    deletedAt: null,
  });

  if (!tree) {
    throw new NotFoundError('Family tree not found', 'TREE_NOT_FOUND');
  }

  return toTreeResult(tree);
}

/**
 * Updates a family tree's name and/or description.
 *
 * Validates:
 * - The requesting user has an active admin or editor membership on the tree
 * - Name uniqueness if the name is being changed
 *
 * @param treeId - The ID of the tree to update
 * @param userId - The ID of the user performing the update (used for authorization)
 * @param input - Validated update input (name, description)
 * @returns The updated tree data
 * @throws ValidationError if treeId or userId format is invalid
 * @throws NotFoundError if tree does not exist or is soft-deleted
 * @throws ForbiddenError if user does not have edit permissions on the tree
 * @throws ConflictError if new name conflicts with another tree by the same creator
 */
export async function updateTree(
  treeId: string,
  userId: string,
  input: UpdateTreeInput
): Promise<TreeResult> {
  await connectDB();

  const treeObjectId = toObjectId(treeId, 'treeId');
  const userObjectId = toObjectId(userId, 'userId');

  const tree = await FamilyTree.findOne({
    _id: treeObjectId,
    deletedAt: null,
  });

  if (!tree) {
    throw new NotFoundError('Family tree not found', 'TREE_NOT_FOUND');
  }

  // Verify the requesting user has edit permissions (admin or editor)
  const userMembership = await Membership.findOne({
    treeId: treeObjectId,
    userId: userObjectId,
    role: { $in: ['admin', 'editor'] },
    deletedAt: null,
  });

  if (!userMembership) {
    throw new ForbiddenError(
      'You do not have permission to update this family tree',
      'INSUFFICIENT_PERMISSIONS'
    );
  }

  // If name is being changed, validate uniqueness
  if (input.name && input.name !== tree.name) {
    const existingTree = await FamilyTree.findOne({
      createdBy: tree.createdBy,
      name: input.name,
      deletedAt: null,
      _id: { $ne: treeObjectId },
    });

    if (existingTree) {
      throw new ConflictError(
        'A family tree with this name already exists',
        'TREE_NAME_EXISTS',
        { field: 'name' }
      );
    }
  }

  // Apply updates
  if (input.name !== undefined) {
    tree.name = input.name;
  }
  if (input.description !== undefined) {
    tree.description = input.description;
  }

  await tree.save();

  return toTreeResult(tree);
}

/**
 * Soft-deletes a family tree.
 *
 * Only allowed if the requesting user is the sole admin of the tree.
 * Sets deletedAt and deletedBy fields.
 *
 * Uses a single aggregation to verify admin status and count admins
 * in one database round trip.
 *
 * @param treeId - The ID of the tree to soft-delete
 * @param userId - The ID of the user requesting deletion
 * @returns The soft-deleted tree data
 * @throws ValidationError if treeId or userId format is invalid
 * @throws NotFoundError if tree does not exist or is already soft-deleted
 * @throws ForbiddenError if user is not an admin or is not the sole admin
 */
export async function softDeleteTree(
  treeId: string,
  userId: string
): Promise<TreeResult> {
  await connectDB();

  const treeObjectId = toObjectId(treeId, 'treeId');
  const userObjectId = toObjectId(userId, 'userId');

  const tree = await FamilyTree.findOne({
    _id: treeObjectId,
    deletedAt: null,
  });

  if (!tree) {
    throw new NotFoundError('Family tree not found', 'TREE_NOT_FOUND');
  }

  // Single query: count all admins and check if user is among them
  const adminMemberships = await Membership.find({
    treeId: treeObjectId,
    role: 'admin',
    deletedAt: null,
  }).select('userId');

  const isUserAdmin = adminMemberships.some((m) =>
    m.userId.equals(userObjectId)
  );

  if (!isUserAdmin) {
    throw new ForbiddenError(
      'Only an admin can delete a family tree',
      'NOT_ADMIN'
    );
  }

  if (adminMemberships.length > 1) {
    throw new ForbiddenError(
      'Cannot delete a family tree with multiple admins. Other admins must be removed first.',
      'MULTIPLE_ADMINS'
    );
  }

  // Perform soft delete
  tree.deletedAt = new Date();
  tree.deletedBy = userObjectId;
  await tree.save();

  return toTreeResult(tree);
}

/**
 * Restores a soft-deleted family tree within the 30-day restore window.
 *
 * @param treeId - The ID of the tree to restore
 * @param userId - The ID of the user requesting restoration
 * @returns The restored tree data
 * @throws ValidationError if treeId or userId format is invalid
 * @throws NotFoundError if tree does not exist or is not soft-deleted
 * @throws ForbiddenError if user is not the one who deleted the tree
 * @throws ValidationError if the 30-day restore window has passed
 */
export async function restoreTree(
  treeId: string,
  userId: string
): Promise<TreeResult> {
  await connectDB();

  const treeObjectId = toObjectId(treeId, 'treeId');
  const userObjectId = toObjectId(userId, 'userId');

  const tree = await FamilyTree.findOne({
    _id: treeObjectId,
    deletedAt: { $ne: null },
  });

  if (!tree) {
    throw new NotFoundError(
      'Family tree not found or is not deleted',
      'TREE_NOT_FOUND'
    );
  }

  // Only the user who deleted the tree can restore it
  if (!tree.deletedBy || !tree.deletedBy.equals(userObjectId)) {
    throw new ForbiddenError(
      'Only the admin who deleted this tree can restore it',
      'NOT_DELETING_ADMIN'
    );
  }

  // Check 30-day restore window using timestamp comparison (avoids float division)
  const deletedAt = tree.deletedAt!;
  const restoreDeadline = new Date(deletedAt.getTime() + RESTORE_WINDOW_MS);

  if (Date.now() > restoreDeadline.getTime()) {
    throw new ValidationError(
      'The 30-day restore window has expired. This tree can no longer be restored.',
      'RESTORE_WINDOW_EXPIRED'
    );
  }

  // Restore the tree
  tree.deletedAt = null;
  tree.deletedBy = null;
  await tree.save();

  return toTreeResult(tree);
}

/**
 * Fetches active member counts for a list of tree IDs in a single aggregation.
 *
 * @param treeIds - Array of tree ID strings
 * @returns Map of treeId → member count
 */
export async function getMemberCounts(
  treeIds: string[]
): Promise<Map<string, number>> {
  if (treeIds.length === 0) {
    return new Map();
  }

  await connectDB();

  const objectIds = treeIds.map((id) => new Types.ObjectId(id));

  const results = await Membership.aggregate<{
    _id: Types.ObjectId;
    count: number;
  }>([
    {
      $match: {
        treeId: { $in: objectIds },
        deletedAt: null,
      },
    },
    {
      $group: {
        _id: '$treeId',
        count: { $sum: 1 },
      },
    },
  ]);

  const map = new Map<string, number>();
  for (const result of results) {
    map.set(result._id.toString(), result.count);
  }
  return map;
}

/**
 * Lists all active family trees where the user has an active membership.
 *
 * Uses aggregation with $lookup to fetch memberships and trees in a single
 * database round trip.
 *
 * @param userId - The ID of the user
 * @returns Array of trees the user is a member of
 * @throws ValidationError if userId format is invalid
 */
export async function listUserTrees(userId: string): Promise<TreeResult[]> {
  await connectDB();

  const userObjectId = toObjectId(userId, 'userId');

  // Single aggregation: find memberships → lookup trees → filter active
  const results = await Membership.aggregate<{
    tree: IFamilyTree[];
  }>([
    {
      $match: {
        userId: userObjectId,
        deletedAt: null,
      },
    },
    {
      $lookup: {
        from: 'familytrees',
        localField: 'treeId',
        foreignField: '_id',
        as: 'tree',
      },
    },
    { $unwind: '$tree' },
    {
      $match: {
        'tree.deletedAt': null,
      },
    },
    { $sort: { 'tree.updatedAt': -1 } },
    {
      $replaceRoot: { newRoot: '$tree' },
    },
  ]);

  return (results as unknown as IFamilyTree[]).map(toTreeResult);
}
