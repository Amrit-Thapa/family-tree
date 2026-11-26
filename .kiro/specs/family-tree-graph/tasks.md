
# Implementation Plan: Family Tree Graph

## Overview

This plan implements the interactive family tree graph visualization feature using React Flow with dagre-based hierarchical layout. The implementation proceeds from dependency installation, through utility functions and service layer, to API routes and client components, finishing with invite system extension and integration wiring.

## Tasks

- [x] 1. Install dependencies and set up project structure
  - [x] 1.1 Install React Flow, dagre, and fast-check dependencies
    - Run `npm install @xyflow/react dagre` for production dependencies
    - Run `npm install -D @types/dagre fast-check` for dev dependencies
    - Verify `npm install` resolves without peer dependency errors
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 1.2 Create directory structure and TypeScript interfaces
    - Create `src/lib/services/graph.service.ts` with `GraphResponse`, `GraphNodeData`, `GraphRelationshipData` interfaces
    - Create `src/lib/services/person.service.ts` with `CreatePersonRequest` interface
    - Create `src/lib/services/relationship.service.ts` with `CreateRelationshipRequest` interface
    - Create `src/lib/graph/layout.ts` placeholder
    - Create `src/lib/graph/derived-relationships.ts` placeholder
    - Create `src/lib/graph/format-name.ts` placeholder
    - Create `src/lib/graph/group-relationships.ts` placeholder
    - _Requirements: 1.1, 1.3, 1.4, 5.4_

- [x] 2. Implement pure utility functions
  - [x] 2.1 Implement `formatDisplayName` in `src/lib/graph/format-name.ts`
    - Combine first + last name with a space separator
    - Return full name if combined length ≤ 30 characters
    - Truncate to 29 characters + "…" if combined length exceeds 30
    - _Requirements: 1.5_

  - [x] 2.2 Write property test for `formatDisplayName`
    - **Property 2: Name Truncation Correctness**
    - **Validates: Requirements 1.5**
    - Use fast-check to generate arbitrary firstName/lastName strings
    - Assert: output ≤ 30 chars, ends with "…" only when input exceeds 30, full name returned when ≤ 30

  - [x] 2.3 Implement `groupDirectRelationships` in `src/lib/graph/group-relationships.ts`
    - Accept personNodeId, relationships array, and nodes array
    - Partition relationships into parents, children, spouses groups
    - For parent_child: if person is in toNodeId position → the fromNodeId person is a parent; if person is in fromNodeId position → the toNodeId person is a child
    - For spouse: the other person is a spouse
    - Return `GroupedRelationships` object
    - _Requirements: 3.2_

  - [ ]* 2.4 Write property test for `groupDirectRelationships`
    - **Property 3: Direct Relationship Grouping Completeness**
    - **Validates: Requirements 3.2**
    - Use fast-check to generate random relationship sets
    - Assert: every relationship involving the person appears in exactly one group, no foreign relationships included

  - [x] 2.5 Implement `deriveRelationships` in `src/lib/graph/derived-relationships.ts`
    - Accept personNodeId, relationships array, and nodes array
    - Compute siblings (full and half) by finding persons sharing parents
    - Compute grandparents (2 hops up) and grandchildren (2 hops down)
    - Compute uncles/aunts (siblings of parents)
    - Compute cousins (children of parents' siblings)
    - Return array of `DerivedRelationship` objects with type labels
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [ ]* 2.6 Write property test for `deriveRelationships`
    - **Property 6: Derived Relationship Computation Correctness**
    - **Validates: Requirements 7.1, 7.2, 7.3**
    - Use fast-check to generate multi-generation family graph structures
    - Assert: every derived relationship is reachable via specified traversal path, no reachable relationship is omitted

  - [x] 2.7 Implement `computeDagreLayout` in `src/lib/graph/layout.ts`
    - Accept React Flow nodes and edges arrays
    - Configure dagre graph with `rankdir: 'TB'`, configurable `nodesep` and `ranksep`
    - Run dagre layout algorithm
    - Return nodes with computed x/y positions and unchanged edges
    - _Requirements: 1.2_

  - [ ]* 2.8 Write property test for `computeDagreLayout`
    - **Property 1: Layout Hierarchy Invariant**
    - **Validates: Requirements 1.2**
    - Use fast-check to generate random DAGs (nodes + parent-child edges)
    - Assert: every parent node has y-position strictly less than all its child nodes

- [x] 3. Checkpoint - Ensure all utility tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement service layer
  - [x] 4.1 Implement `graph.service.ts` — `getGraphData`
    - Connect to DB, validate treeId
    - Query all active TreeNodes for the tree (where `deletedAt` is null), populate Person data
    - Query all active Relationships for the tree (where `deletedAt` is null)
    - Map `Relationship.fromPersonId`/`toPersonId` to their corresponding TreeNode IDs
    - Return `GraphResponse` with nodes and relationships arrays
    - _Requirements: 1.1_

  - [x] 4.2 Implement `person.service.ts` — `createProfileOnlyPerson`
    - Connect to DB, validate treeId and actorUserId
    - Verify actor is admin of the tree (reuse `requireAdmin` pattern from invite.service.ts)
    - Validate input: firstName required (1-100 chars, reject whitespace-only), lastName optional (1-100 chars), dateOfBirth/dateOfDeath optional ISO dates, gender optional enum
    - Create Person record with `createdBy: actorUserId`
    - Create TreeNode with `personId`, `treeId`, `linkedUserId: null`, `addedBy: actorUserId`
    - Return `GraphNodeData` for the new node
    - _Requirements: 4.2, 4.3, 4.4, 4.6, 4.7_

  - [ ]* 4.3 Write property test for whitespace-only name rejection
    - **Property 4: Whitespace-Only Names Are Rejected**
    - **Validates: Requirements 4.4**
    - Use fast-check to generate whitespace-only strings (spaces, tabs, newlines)
    - Assert: validation rejects all whitespace-only strings as invalid firstName

  - [x] 4.4 Implement `relationship.service.ts` — `createRelationship` and `deleteRelationship`
    - `createRelationship`: validate admin role, both nodes exist in tree, no self-relationship, no duplicate of same type (check both directions for spouse), create Relationship record
    - `deleteRelationship`: validate admin role, relationship exists in tree, soft-delete by setting `deletedAt`
    - For spouse type: normalize direction (alphabetical by node ID) to prevent directional duplicates
    - _Requirements: 5.4, 5.5, 5.6, 5.7, 5.8_

  - [ ]* 4.5 Write property test for duplicate relationship detection
    - **Property 5: Duplicate Relationship Detection**
    - **Validates: Requirements 5.5**
    - Use fast-check to generate random node pairs and relationship types
    - Assert: after creating a relationship, attempting to create the same type between the same pair results in conflict error regardless of direction

  - [ ]* 4.6 Write unit tests for service layer
    - Test `getGraphData` returns correct shape with mock data
    - Test `createProfileOnlyPerson` validates input and creates records
    - Test `createRelationship` validates constraints (self-ref, duplicate, admin check)
    - Test `deleteRelationship` soft-deletes correctly
    - _Requirements: 4.6, 5.5, 5.6, 5.8_

- [x] 5. Checkpoint - Ensure all service tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement API routes
  - [x] 6.1 Implement `GET /api/trees/[treeId]/graph` route
    - Authenticate user via Firebase Auth (follow existing route patterns)
    - Verify user has active membership in the tree
    - Call `getGraphData(treeId)` and return JSON response
    - Handle errors with appropriate status codes (403, 404, 500)
    - _Requirements: 1.1, 1.7_

  - [x] 6.2 Implement `POST /api/trees/[treeId]/persons` route
    - Authenticate user, verify admin role
    - Parse and validate request body (firstName, lastName, dateOfBirth, dateOfDeath, gender)
    - Call `createProfileOnlyPerson` and return created node as JSON
    - Return 400 for validation errors, 403 for non-admin, 500 for server errors
    - _Requirements: 4.3, 4.4, 4.6_

  - [x] 6.3 Implement `POST /api/trees/[treeId]/relationships` route
    - Authenticate user, verify admin role
    - Parse and validate request body (fromNodeId, toNodeId, type)
    - Call `createRelationship` and return created relationship as JSON
    - Return 400 for validation errors, 403 for non-admin, 409 for duplicates
    - _Requirements: 5.4, 5.5, 5.6, 5.8_

  - [x] 6.4 Implement `DELETE /api/trees/[treeId]/relationships/[relationshipId]` route
    - Authenticate user, verify admin role
    - Call `deleteRelationship` and return 204 on success
    - Return 403 for non-admin, 404 for not found
    - _Requirements: 5.7_

  - [ ]* 6.5 Write integration tests for API routes
    - Test GET graph endpoint returns correct data shape
    - Test POST persons endpoint validates input and enforces admin role
    - Test POST relationships endpoint validates constraints
    - Test DELETE relationships endpoint soft-deletes
    - Test authorization (non-admin gets 403)
    - _Requirements: 1.1, 4.6, 5.6_

- [x] 7. Checkpoint - Ensure all API route tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implement client components
  - [x] 8.1 Implement `PersonNode` custom React Flow node component
    - Create `src/components/graph/PersonNode.tsx`
    - Display person's formatted name (using `formatDisplayName`), profile photo or placeholder avatar
    - Apply highlighted border when `isCurrentUser` is true
    - Use React Flow's `Handle` components for edge connections
    - _Requirements: 1.5, 1.8_

  - [x] 8.2 Implement `SidePanel` component
    - Create `src/components/graph/SidePanel.tsx`
    - Slide-in panel from right side on node click (within 300ms transition)
    - Display person details: first name, last name, date of birth, date of death, profile photo; omit fields with no value
    - Display direct relationships grouped by type (parents, children, spouses) using `groupDirectRelationships`
    - Display derived relationships with type labels using `deriveRelationships`
    - Show "no relationships" message when no direct relationships exist
    - Show "no extended family connections" message when no derived relationships exist
    - Include close button and close on outside click
    - Relationship names are clickable links that navigate to that node
    - Show loading skeleton while data loads
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [x] 8.3 Implement `AddPersonForm` component
    - Create `src/components/graph/AddPersonForm.tsx`
    - Form fields: firstName (required), lastName (optional), dateOfBirth (optional date picker), dateOfDeath (optional date picker), gender (optional select)
    - Client-side validation: firstName required and non-empty after trim, 1-100 char limits
    - Show warning (not error) if dateOfDeath < dateOfBirth
    - Submit via POST to `/api/trees/[treeId]/persons`
    - Display field-level error messages from API response
    - Only visible to admin users
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 8.4 Implement `AddRelationshipForm` component
    - Create `src/components/graph/AddRelationshipForm.tsx`
    - Form to select target person (dropdown of all persons in tree except current), relationship type (parent-child or spouse), and direction (for parent-child: who is parent, who is child)
    - Submit via POST to `/api/trees/[treeId]/relationships`
    - Display error messages for conflicts, self-reference, validation errors
    - Only visible to admin users
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.8_

  - [x] 8.5 Implement `FamilyTreeGraph` main graph component
    - Create `src/components/graph/FamilyTreeGraph.tsx`
    - Fetch graph data from `GET /api/trees/[treeId]/graph`
    - Transform API data into React Flow nodes (using `PersonNode` type) and edges (solid+arrow for parent-child, dashed+no-arrow for spouse)
    - Compute layout positions using `computeDagreLayout`
    - Configure React Flow with: pan on drag, zoom on scroll/pinch, min zoom 0.1, max zoom 4, fit view on initial render
    - Render zoom-in, zoom-out, fit-to-view control buttons
    - Allow node dragging (positions revert on reload)
    - Handle node click → open SidePanel with selected node data
    - Show empty state message when no nodes exist
    - Show error state with retry button on fetch failure
    - Mark current user's node with `isCurrentUser: true`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 8.6 Integrate graph into tree page
    - Update `src/app/(protected)/trees/[treeId]/page.tsx` to render `FamilyTreeGraph` component
    - Pass `treeId`, `currentUserId`, and `role` from `TreeProvider` context
    - Include "Add Person" button (admin-only) that opens the AddPersonForm
    - Wire relationship creation/deletion callbacks to refresh graph data and re-layout
    - Wire derived relationship recomputation on relationship changes
    - _Requirements: 1.1, 4.1, 5.1, 7.5_

- [x] 9. Checkpoint - Ensure graph renders correctly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Extend invite system with relationship capture
  - [x] 10.1 Extend Invite model with relationship fields
    - Add optional fields to Invite schema: `relationshipType` (enum: 'parent_child' | 'spouse'), `targetPersonNodeId` (ObjectId ref to TreeNode), `inviteeIsParent` (Boolean)
    - All three fields are optional — existing invites continue to work unchanged
    - _Requirements: 6.1, 6.2_

  - [x] 10.2 Extend `createInviteLink` to accept relationship options
    - Add optional `relationshipType`, `targetPersonNodeId`, `inviteeIsParent` to `CreateInviteOptions`
    - Validate: if `relationshipType` is provided, `targetPersonNodeId` must reference an active TreeNode in the tree
    - Validate: if type is 'spouse', `inviteeIsParent` should not be stored
    - Store relationship fields on the Invite document
    - Reject if target person is deleted or not in the tree
    - _Requirements: 6.1, 6.2, 6.6_

  - [x] 10.3 Extend `acceptInvite` to auto-create relationship
    - After membership creation, check if invite has `relationshipType` set
    - If yes: find or create a TreeNode for the invitee in the tree
    - Create Relationship edge between invitee's TreeNode and `targetPersonNodeId`
    - For parent_child: use `inviteeIsParent` to determine fromNodeId/toNodeId
    - Wrap relationship creation in try/catch — if it fails (duplicate, target deleted), still return success for membership but include a notification flag
    - _Requirements: 6.3, 6.4, 6.5_

  - [ ]* 10.4 Write unit tests for invite relationship extension
    - Test `createInviteLink` with relationship options validates target person
    - Test `acceptInvite` creates relationship on acceptance
    - Test `acceptInvite` gracefully handles relationship creation failure
    - Test invite without relationship info works as before
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

- [ ] 11. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- All tests use Vitest (run with `npx vitest run`)
- fast-check is used for property-based testing alongside Vitest
- React Flow (`@xyflow/react`) and `dagre` are new dependencies to install
- Existing Person, TreeNode, and Relationship models are reused without schema changes
- Only the Invite model needs 3 optional fields added

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["2.1", "2.3", "2.5", "2.7"] },
    { "id": 3, "tasks": ["2.2", "2.4", "2.6", "2.8"] },
    { "id": 4, "tasks": ["4.1", "4.2", "4.4"] },
    { "id": 5, "tasks": ["4.3", "4.5", "4.6"] },
    { "id": 6, "tasks": ["6.1", "6.2", "6.3", "6.4"] },
    { "id": 7, "tasks": ["6.5"] },
    { "id": 8, "tasks": ["8.1", "8.3", "8.4"] },
    { "id": 9, "tasks": ["8.2", "8.5"] },
    { "id": 10, "tasks": ["8.6"] },
    { "id": 11, "tasks": ["10.1"] },
    { "id": 12, "tasks": ["10.2"] },
    { "id": 13, "tasks": ["10.3"] },
    { "id": 14, "tasks": ["10.4"] }
  ]
}
```
