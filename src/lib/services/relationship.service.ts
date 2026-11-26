import { Types } from 'mongoose';
import { connectDB } from '@/lib/db/connection';
import Relationship from '@/lib/db/models/Relationship';
import TreeNode from '@/lib/db/models/TreeNode';
import Membership from '@/lib/db/models/Membership';
import { toObjectId } from '@/lib/utils/mongo';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '@/lib/utils/errors';
import type { GraphRelationshipData } from '@/lib/services/graph.service';

// --- Types ---

export interface CreateRelationshipRequest {
  fromNodeId: string; // TreeNode._id (father/mother/spouse A)
  toNodeId: string; // TreeNode._id (child/spouse B)
  type: 'father' | 'mother' | 'spouse';
}

// --- Internal Helpers ---

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

/**
 * Finds an active TreeNode by ID and verifies it belongs to the specified tree.
 * Returns the TreeNode document or throws NotFoundError.
 */
async function findActiveTreeNode(
  nodeId: Types.ObjectId,
  treeId: Types.ObjectId,
  label: string
) {
  const node = await TreeNode.findOne({
    _id: nodeId,
    treeId: treeId,
    deletedAt: null,
  });

  if (!node) {
    throw new NotFoundError(
      `${label} not found in this tree`,
      'NODE_NOT_FOUND'
    );
  }

  return node;
}

// --- Public API ---

/**
 * Creates a relationship between two persons in the tree.
 *
 * Types:
 * - 'father': fromNode is the father of toNode (max 1 father per child)
 * - 'mother': fromNode is the mother of toNode (max 1 mother per child)
 * - 'spouse': fromNode and toNode are married (multiple allowed)
 *
 * Validates: admin role, both nodes exist in tree, no self-relationship,
 * no duplicate, and enforces max 1 father + 1 mother per child.
 */
export async function createRelationship(
  treeId: string,
  data: CreateRelationshipRequest,
  actorUserId: string
): Promise<GraphRelationshipData> {
  await connectDB();

  const treeObjectId = toObjectId(treeId, 'treeId');
  const actorUserObjectId = toObjectId(actorUserId, 'actorUserId');
  const fromNodeObjectId = toObjectId(data.fromNodeId, 'fromNodeId');
  const toNodeObjectId = toObjectId(data.toNodeId, 'toNodeId');

  // Validate relationship type
  const validTypes = ['father', 'mother', 'spouse'] as const;
  if (!validTypes.includes(data.type as typeof validTypes[number])) {
    throw new ValidationError(
      'Relationship type must be father, mother, or spouse',
      'INVALID_TYPE',
      { field: 'type' }
    );
  }

  // No self-relationship
  if (data.fromNodeId === data.toNodeId) {
    throw new ValidationError(
      'Cannot create a relationship between a person and themselves',
      'SELF_RELATIONSHIP',
      { field: 'toNodeId' }
    );
  }

  // Authorization: actor must be admin
  await requireAdmin(treeObjectId, actorUserObjectId, 'create relationships');

  // Verify both nodes exist in the tree
  const [fromNode, toNode] = await Promise.all([
    findActiveTreeNode(fromNodeObjectId, treeObjectId, 'Source node'),
    findActiveTreeNode(toNodeObjectId, treeObjectId, 'Target node'),
  ]);

  let fromPersonId = fromNode.personId;
  let toPersonId = toNode.personId;

  if (data.type === 'spouse') {
    // Normalize direction by sorting person IDs alphabetically to prevent directional duplicates
    const fromStr = fromPersonId.toString();
    const toStr = toPersonId.toString();
    if (fromStr > toStr) {
      [fromPersonId, toPersonId] = [toPersonId, fromPersonId];
    }

    // Check for duplicate spouse relationship
    const existingSpouse = await Relationship.findOne({
      treeId: treeObjectId,
      fromPersonId,
      toPersonId,
      type: 'spouse',
      deletedAt: null,
    });

    if (existingSpouse) {
      throw new ConflictError(
        'A spouse relationship already exists between these persons',
        'DUPLICATE_RELATIONSHIP'
      );
    }
  } else {
    // father or mother: fromPerson is parent of toPerson (child)
    // Enforce max 1 father and max 1 mother per child
    const existingParentOfType = await Relationship.findOne({
      treeId: treeObjectId,
      toPersonId: toNode.personId,
      type: data.type,
      deletedAt: null,
    });

    if (existingParentOfType) {
      const label = data.type === 'father' ? 'father' : 'mother';
      throw new ConflictError(
        `This person already has a ${label}. Remove the existing ${label} first.`,
        'MAX_PARENT_REACHED',
        { field: 'type' }
      );
    }

    // Also check for exact duplicate (same parent → same child with same type)
    const exactDuplicate = await Relationship.findOne({
      treeId: treeObjectId,
      fromPersonId: fromNode.personId,
      toPersonId: toNode.personId,
      type: data.type,
      deletedAt: null,
    });

    if (exactDuplicate) {
      throw new ConflictError(
        'This relationship already exists',
        'DUPLICATE_RELATIONSHIP'
      );
    }
  }

  // Create the relationship record
  const relationship = await Relationship.create({
    treeId: treeObjectId,
    fromPersonId: data.type === 'spouse' ? fromPersonId : fromNode.personId,
    toPersonId: data.type === 'spouse' ? toPersonId : toNode.personId,
    type: data.type,
    spouseStatus: data.type === 'spouse' ? 'active' : undefined,
    createdBy: actorUserObjectId,
  });

  // Map person IDs back to tree node IDs for the response
  const fromTreeNode = await TreeNode.findOne({
    treeId: treeObjectId,
    personId: relationship.fromPersonId,
    deletedAt: null,
  });
  const toTreeNode = await TreeNode.findOne({
    treeId: treeObjectId,
    personId: relationship.toPersonId,
    deletedAt: null,
  });

  const result: GraphRelationshipData = {
    id: relationship._id.toString(),
    fromNodeId: fromTreeNode!._id.toString(),
    toNodeId: toTreeNode!._id.toString(),
    type: relationship.type,
  };

  if (relationship.type === 'spouse' && relationship.spouseStatus) {
    result.spouseStatus = relationship.spouseStatus;
  }

  return result;
}

/**
 * Updates the spouse status of a relationship (active/divorced/separated).
 * Admin-only.
 */
export async function updateSpouseStatus(
  treeId: string,
  relationshipId: string,
  status: 'active' | 'divorced' | 'separated',
  actorUserId: string
): Promise<void> {
  await connectDB();

  const treeObjectId = toObjectId(treeId, 'treeId');
  const relationshipObjectId = toObjectId(relationshipId, 'relationshipId');
  const actorUserObjectId = toObjectId(actorUserId, 'actorUserId');

  await requireAdmin(treeObjectId, actorUserObjectId, 'update relationship status');

  const relationship = await Relationship.findOne({
    _id: relationshipObjectId,
    treeId: treeObjectId,
    type: 'spouse',
    deletedAt: null,
  });

  if (!relationship) {
    throw new NotFoundError(
      'Spouse relationship not found in this tree',
      'RELATIONSHIP_NOT_FOUND'
    );
  }

  relationship.spouseStatus = status;
  await relationship.save();
}

/**
 * Permanently deletes a relationship.
 * Validates admin role and that the relationship exists in the tree.
 */
export async function deleteRelationship(
  treeId: string,
  relationshipId: string,
  actorUserId: string
): Promise<void> {
  await connectDB();

  const treeObjectId = toObjectId(treeId, 'treeId');
  const relationshipObjectId = toObjectId(relationshipId, 'relationshipId');
  const actorUserObjectId = toObjectId(actorUserId, 'actorUserId');

  // Authorization: actor must be admin
  await requireAdmin(treeObjectId, actorUserObjectId, 'delete relationships');

  // Find the relationship and verify it belongs to this tree
  const relationship = await Relationship.findOne({
    _id: relationshipObjectId,
    treeId: treeObjectId,
    deletedAt: null,
  });

  if (!relationship) {
    throw new NotFoundError(
      'Relationship not found in this tree',
      'RELATIONSHIP_NOT_FOUND'
    );
  }

  // Hard delete
  await Relationship.deleteOne({ _id: relationshipObjectId });
}
