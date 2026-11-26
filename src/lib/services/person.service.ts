import { connectDB } from '@/lib/db/connection';
import Person from '@/lib/db/models/Person';
import TreeNode from '@/lib/db/models/TreeNode';
import Membership from '@/lib/db/models/Membership';
import Relationship from '@/lib/db/models/Relationship';
import { toObjectId } from '@/lib/utils/mongo';
import { ForbiddenError, NotFoundError, ValidationError } from '@/lib/utils/errors';
import type { GraphNodeData } from '@/lib/services/graph.service';
import type { Types } from 'mongoose';

// --- Types ---

export interface CreatePersonRequest {
  firstName: string; // required, 1-100 chars
  lastName?: string; // optional, 1-100 chars
  dateOfBirth?: string; // ISO date
  dateOfDeath?: string; // ISO date
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
}

export interface UpdatePersonRequest {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  dateOfDeath?: string;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
}

// --- Internal Helpers ---

const VALID_GENDERS = ['male', 'female', 'other', 'prefer_not_to_say'] as const;

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
 * Validates the CreatePersonRequest input.
 * Throws ValidationError for invalid fields.
 */
function validateCreatePersonInput(data: CreatePersonRequest): void {
  // firstName: required, 1-100 chars, reject whitespace-only
  if (!data.firstName || data.firstName.trim().length === 0) {
    throw new ValidationError(
      'First name is required',
      'INVALID_INPUT',
      { field: 'firstName' }
    );
  }
  if (data.firstName.trim().length > 100) {
    throw new ValidationError(
      'First name must be 100 characters or less',
      'INVALID_INPUT',
      { field: 'firstName' }
    );
  }

  // lastName: optional, but if provided must be 1-100 chars
  if (data.lastName !== undefined && data.lastName !== null) {
    if (data.lastName.trim().length === 0) {
      throw new ValidationError(
        'Last name cannot be empty if provided',
        'INVALID_INPUT',
        { field: 'lastName' }
      );
    }
    if (data.lastName.trim().length > 100) {
      throw new ValidationError(
        'Last name must be 100 characters or less',
        'INVALID_INPUT',
        { field: 'lastName' }
      );
    }
  }

  // gender: optional, must be valid enum
  if (data.gender !== undefined && !VALID_GENDERS.includes(data.gender)) {
    throw new ValidationError(
      'Gender must be one of: male, female, other, prefer_not_to_say',
      'INVALID_INPUT',
      { field: 'gender' }
    );
  }

  // dateOfBirth: optional, must be valid ISO date if provided
  if (data.dateOfBirth !== undefined) {
    const dob = new Date(data.dateOfBirth);
    if (isNaN(dob.getTime())) {
      throw new ValidationError(
        'Date of birth must be a valid date',
        'INVALID_INPUT',
        { field: 'dateOfBirth' }
      );
    }
  }

  // dateOfDeath: optional, must be valid ISO date if provided
  if (data.dateOfDeath !== undefined) {
    const dod = new Date(data.dateOfDeath);
    if (isNaN(dod.getTime())) {
      throw new ValidationError(
        'Date of death must be a valid date',
        'INVALID_INPUT',
        { field: 'dateOfDeath' }
      );
    }
  }
}

// --- Public API ---

/**
 * Creates a profile-only person node (no linked user account).
 * Validates admin role, input constraints, and records audit fields.
 */
export async function createProfileOnlyPerson(
  treeId: string,
  data: CreatePersonRequest,
  actorUserId: string
): Promise<GraphNodeData> {
  await connectDB();

  // Validate IDs
  const treeObjectId = toObjectId(treeId, 'treeId');
  const actorUserObjectId = toObjectId(actorUserId, 'actorUserId');

  // Authorization: actor must be admin of the tree
  await requireAdmin(treeObjectId, actorUserObjectId, 'add person nodes');

  // Validate input
  validateCreatePersonInput(data);

  // Trim name fields
  const trimmedFirstName = data.firstName.trim();
  const trimmedLastName = data.lastName?.trim() || undefined;

  // Create Person record
  const person = await Person.create({
    firstName: trimmedFirstName,
    lastName: trimmedLastName,
    dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
    dateOfDeath: data.dateOfDeath ? new Date(data.dateOfDeath) : undefined,
    gender: data.gender,
    createdBy: actorUserObjectId,
  });

  // Create TreeNode with linkedUserId: null (profile-only)
  const treeNode = await TreeNode.create({
    personId: person._id,
    treeId: treeObjectId,
    linkedUserId: null,
    addedBy: actorUserObjectId,
  });

  // Return GraphNodeData for the new node
  const graphNode: GraphNodeData = {
    id: treeNode._id.toString(),
    personId: person._id.toString(),
    firstName: person.firstName,
    lastName: person.lastName,
    dateOfBirth: person.dateOfBirth?.toISOString(),
    dateOfDeath: person.dateOfDeath?.toISOString(),
    gender: person.gender,
    linkedUserId: undefined,
  };

  return graphNode;
}


/**
 * Updates a person's details.
 * Allowed by: admin of the tree, OR the person themselves (linkedUserId matches actorUserId).
 */
export async function updatePerson(
  treeId: string,
  nodeId: string,
  data: UpdatePersonRequest,
  actorUserId: string
): Promise<GraphNodeData> {
  await connectDB();

  const treeObjectId = toObjectId(treeId, 'treeId');
  const nodeObjectId = toObjectId(nodeId, 'nodeId');
  const actorUserObjectId = toObjectId(actorUserId, 'actorUserId');

  // Find the TreeNode
  const treeNode = await TreeNode.findOne({
    _id: nodeObjectId,
    treeId: treeObjectId,
    deletedAt: null,
  });

  if (!treeNode) {
    throw new NotFoundError('Person not found in this tree', 'PERSON_NOT_FOUND');
  }

  // Authorization: admin OR the person themselves
  const isOwnNode = treeNode.linkedUserId?.toString() === actorUserId;

  if (!isOwnNode) {
    await requireAdmin(treeObjectId, actorUserObjectId, 'edit person details');
  }

  // Validate input
  if (data.firstName !== undefined) {
    if (!data.firstName || data.firstName.trim().length === 0) {
      throw new ValidationError(
        'First name is required',
        'INVALID_INPUT',
        { field: 'firstName' }
      );
    }
    if (data.firstName.trim().length > 100) {
      throw new ValidationError(
        'First name must be 100 characters or less',
        'INVALID_INPUT',
        { field: 'firstName' }
      );
    }
  }

  if (data.lastName !== undefined && data.lastName !== null && data.lastName.trim().length > 100) {
    throw new ValidationError(
      'Last name must be 100 characters or less',
      'INVALID_INPUT',
      { field: 'lastName' }
    );
  }

  if (data.gender !== undefined && data.gender !== null) {
    if (!VALID_GENDERS.includes(data.gender)) {
      throw new ValidationError(
        'Gender must be one of: male, female, other, prefer_not_to_say',
        'INVALID_INPUT',
        { field: 'gender' }
      );
    }
  }

  // Build update object
  const updateFields: Record<string, unknown> = {};
  if (data.firstName !== undefined) updateFields.firstName = data.firstName.trim();
  if (data.lastName !== undefined) updateFields.lastName = data.lastName?.trim() || undefined;
  if (data.dateOfBirth !== undefined) updateFields.dateOfBirth = data.dateOfBirth ? new Date(data.dateOfBirth) : undefined;
  if (data.dateOfDeath !== undefined) updateFields.dateOfDeath = data.dateOfDeath ? new Date(data.dateOfDeath) : undefined;
  if (data.gender !== undefined) updateFields.gender = data.gender || undefined;

  // Update the Person record
  const person = await Person.findByIdAndUpdate(
    treeNode.personId,
    { $set: updateFields },
    { new: true }
  );

  if (!person) {
    throw new NotFoundError('Person record not found', 'PERSON_NOT_FOUND');
  }

  // Return updated GraphNodeData
  const graphNode: GraphNodeData = {
    id: treeNode._id.toString(),
    personId: person._id.toString(),
    firstName: person.firstName,
    lastName: person.lastName,
    dateOfBirth: person.dateOfBirth?.toISOString(),
    dateOfDeath: person.dateOfDeath?.toISOString(),
    gender: person.gender,
    linkedUserId: treeNode.linkedUserId?.toString(),
  };

  return graphNode;
}

/**
 * Permanently deletes a person node, their Person record, and all related relationships.
 * Admin-only.
 */
export async function deletePerson(
  treeId: string,
  nodeId: string,
  actorUserId: string
): Promise<void> {
  await connectDB();

  const treeObjectId = toObjectId(treeId, 'treeId');
  const nodeObjectId = toObjectId(nodeId, 'nodeId');
  const actorUserObjectId = toObjectId(actorUserId, 'actorUserId');

  // Authorization: admin only
  await requireAdmin(treeObjectId, actorUserObjectId, 'delete person nodes');

  // Find the TreeNode
  const treeNode = await TreeNode.findOne({
    _id: nodeObjectId,
    treeId: treeObjectId,
    deletedAt: null,
  });

  if (!treeNode) {
    throw new NotFoundError('Person not found in this tree', 'PERSON_NOT_FOUND');
  }

  const personId = treeNode.personId;

  // Delete all relationships involving this person (hard delete)
  await Relationship.deleteMany({
    treeId: treeObjectId,
    $or: [
      { fromPersonId: personId },
      { toPersonId: personId },
    ],
  });

  // Delete the TreeNode (hard delete)
  await TreeNode.deleteOne({ _id: nodeObjectId });

  // Delete the Person record (hard delete)
  await Person.deleteOne({ _id: personId });
}
