/**
 * Decision:
 * We model family as a graph, not a strict tree,
 * because real families include multiple parents,
 * remarriage, adoption, and non-hierarchical links.
 */


// Person represents an individual in the family graph
// Constraints:
// - Can have multiple relationships
// - Cannot be ancestor of themselves

/**
 * Domain Constraints:
 * - A person cannot be their own ancestor
 * - A person can have multiple parents (biological + adopted)
 * - Spouse relationships are bidirectional
 * - Sibling relationships are derived, not primary
 */

export type PersonId = string & { readonly brand: unique symbol };
export type RelationshipType =
  | "parent"
  | "spouse"
  | "sibling"
  | "adopted";

export interface Person {
  id: PersonId;
  firstName: string;
  lastName?: string;
  birthDate?: string;
  deathDate?: string;
}

export interface Relationship {
  from: PersonId;
  to: PersonId;
  type: RelationshipType;
}

export type FamilyGraph = {
  people: Record<PersonId, Person>;
  relationships: Relationship[];
};

// Example of enforcing constraints in comments:
// - When adding a relationship, ensure 'from' is not equal to 'to' for parent relationships
// - When adding a spouse relationship, ensure it is added in both directions
// - Sibling relationships should be derived from shared parents  
// - Validate that no cycles exist in parent-child relationships to prevent self-ancestry


export function canAddRelationship(
  graph: FamilyGraph,
  relationship: Relationship
): boolean {
  return true;
}