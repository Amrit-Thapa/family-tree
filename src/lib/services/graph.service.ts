import { connectDB } from '@/lib/db/connection';
import TreeNode from '@/lib/db/models/TreeNode';
import Relationship from '@/lib/db/models/Relationship';
import { toObjectId } from '@/lib/utils/mongo';

// --- Types ---

export interface GraphNodeData {
  id: string; // TreeNode._id
  personId: string;
  firstName: string;
  lastName?: string;
  dateOfBirth?: string; // ISO date
  dateOfDeath?: string; // ISO date
  gender?: string;
  profilePhotoUrl?: string;
  linkedUserId?: string;
}

export interface GraphRelationshipData {
  id: string; // Relationship._id
  fromNodeId: string; // TreeNode._id of fromPerson
  toNodeId: string; // TreeNode._id of toPerson
  type: 'father' | 'mother' | 'spouse';
  spouseStatus?: 'active' | 'divorced' | 'separated';
}

export interface GraphResponse {
  nodes: GraphNodeData[];
  relationships: GraphRelationshipData[];
}

// --- Public API ---

/**
 * Fetches all active tree nodes (with person data) and relationships for the graph.
 * Maps Relationship.fromPersonId/toPersonId to their corresponding TreeNode IDs.
 *
 * @param treeId - The ID of the tree to fetch graph data for
 * @returns GraphResponse with nodes and relationships arrays
 * @throws ValidationError if treeId format is invalid
 * @throws NotFoundError if the tree has no nodes
 */
export async function getGraphData(treeId: string): Promise<GraphResponse> {
  await connectDB();

  const treeObjectId = toObjectId(treeId, 'treeId');

  // Query all active TreeNodes for this tree, populate Person data
  const treeNodes = await TreeNode.find({
    treeId: treeObjectId,
    deletedAt: null,
  }).populate('personId');

  if (treeNodes.length === 0) {
    return { nodes: [], relationships: [] };
  }

  // Build a map from personId → TreeNode._id for relationship mapping
  // After populate, node.personId is the full Person document, so we use ._id
  const personIdToNodeId = new Map<string, string>();
  for (const node of treeNodes) {
    const person = node.personId as unknown as { _id: { toString(): string } };
    personIdToNodeId.set(person._id.toString(), node._id.toString());
  }

  // Map TreeNodes to GraphNodeData
  const nodes: GraphNodeData[] = treeNodes.map((node) => {
    // The populated personId is now the full Person document
    const person = node.personId as unknown as {
      _id: { toString(): string };
      firstName: string;
      lastName?: string;
      dateOfBirth?: Date;
      dateOfDeath?: Date;
      gender?: string;
      profilePhotoId?: { toString(): string };
    };

    const graphNode: GraphNodeData = {
      id: node._id.toString(),
      personId: person._id.toString(),
      firstName: person.firstName,
    };

    if (person.lastName) {
      graphNode.lastName = person.lastName;
    }
    if (person.dateOfBirth) {
      graphNode.dateOfBirth = person.dateOfBirth.toISOString();
    }
    if (person.dateOfDeath) {
      graphNode.dateOfDeath = person.dateOfDeath.toISOString();
    }
    if (person.gender) {
      graphNode.gender = person.gender;
    }
    if (node.linkedUserId) {
      graphNode.linkedUserId = node.linkedUserId.toString();
    }

    return graphNode;
  });

  // Query all active Relationships for this tree
  const relationships = await Relationship.find({
    treeId: treeObjectId,
    deletedAt: null,
  });

  // Map relationships: fromPersonId/toPersonId → fromNodeId/toNodeId
  const graphRelationships: GraphRelationshipData[] = [];

  for (const rel of relationships) {
    const fromNodeId = personIdToNodeId.get(rel.fromPersonId.toString());
    const toNodeId = personIdToNodeId.get(rel.toPersonId.toString());

    // Only include relationships where both persons have active TreeNodes
    if (fromNodeId && toNodeId) {
      if (rel.type === 'father' || rel.type === 'mother' || rel.type === 'spouse') {
        const graphRel: GraphRelationshipData = {
          id: rel._id.toString(),
          fromNodeId,
          toNodeId,
          type: rel.type,
        };
        if (rel.type === 'spouse' && rel.spouseStatus) {
          graphRel.spouseStatus = rel.spouseStatus;
        }
        graphRelationships.push(graphRel);
      }
    }
  }

  return {
    nodes,
    relationships: graphRelationships,
  };
}
