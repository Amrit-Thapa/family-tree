# Requirements Document

## Introduction

This feature adds an interactive family tree graph visualization to the tree overview page. The graph renders person nodes and relationship edges using React Flow with dagre-based auto-layout in a top-down hierarchy. Users can pan, zoom, and click nodes to view person details in a side panel. Admins can add profile-only person nodes (for ancestors/deceased) and define parent-child or spouse relationships between any two people in the tree. The invite system is extended to capture relationship type at invite creation, automatically creating the relationship edge when the invitee accepts.

## Glossary

- **Graph_Visualization**: The React Flow canvas that renders person nodes and relationship edges as an interactive, top-down directed graph on the tree page.
- **Person_Node**: A visual node in the graph representing a person (either linked to a user account or a profile-only entry).
- **Profile_Only_Node**: A Person_Node that has no linked user account, created manually by an admin to represent ancestors or deceased family members.
- **Relationship_Edge**: A visual edge in the graph connecting two Person_Nodes, representing either a parent-child or spouse relationship.
- **Side_Panel**: A panel that slides open on the right side of the tree page when a Person_Node is clicked, displaying that person's details and relationships.
- **Tree_Admin**: A user with the "admin" role membership in the current family tree.
- **Dagre_Layout**: The dagre graph layout algorithm that computes top-down hierarchical positions for nodes based on relationship edges.
- **Invite_Relationship**: The relationship type and target person captured at invite creation time, used to auto-create a Relationship_Edge when the invitee accepts.

## Requirements

### Requirement 1: Graph Rendering and Layout

**User Story:** As a tree member, I want to see my family tree rendered as an interactive graph, so that I can visually understand family relationships at a glance.

#### Acceptance Criteria

1. WHEN the tree page loads, THE Graph_Visualization SHALL fetch all active TreeNodes and Relationships for the current tree and render them as Person_Nodes and Relationship_Edges within 3 seconds for trees containing up to 500 Person_Nodes and 1000 Relationship_Edges.
2. THE Dagre_Layout SHALL compute node positions in a top-down hierarchical arrangement where parent nodes appear above child nodes, and Person_Nodes with no parent-child relationships are placed at the top level of the hierarchy.
3. WHEN a parent-child Relationship_Edge is rendered, THE Graph_Visualization SHALL display a directed edge (with an arrowhead pointing from parent to child) using a solid line from the parent Person_Node to the child Person_Node.
4. WHEN a spouse Relationship_Edge is rendered, THE Graph_Visualization SHALL display an undirected edge (with no arrowhead) using a dashed line connecting the two spouse Person_Nodes at the same hierarchical level.
5. THE Graph_Visualization SHALL display each Person_Node with the person's first name, last name (truncated with ellipsis if the combined name exceeds 30 characters), and profile photo (or a placeholder avatar if no photo exists).
6. WHEN the tree contains zero Person_Nodes, THE Graph_Visualization SHALL display an empty state message prompting the admin to add family members.
7. IF the data fetch for TreeNodes or Relationships fails, THEN THE Graph_Visualization SHALL display an error message indicating the graph could not be loaded and provide a retry action.
8. WHEN a Person_Node has a linkedUserId matching the current user, THE Graph_Visualization SHALL visually distinguish that node with a highlighted border to indicate the user's own node.

### Requirement 2: Graph Interaction (Pan, Zoom, Drag)

**User Story:** As a tree member, I want to pan, zoom, and navigate the family tree graph, so that I can explore large family trees comfortably.

#### Acceptance Criteria

1. THE Graph_Visualization SHALL support panning by mouse drag on the canvas background, and by touch drag on touch devices.
2. THE Graph_Visualization SHALL support zooming via mouse scroll wheel and pinch gestures on touch devices, with the zoom level constrained between 10% and 400% of the default scale.
3. THE Graph_Visualization SHALL provide zoom-in, zoom-out, and fit-to-view control buttons that are visible and accessible at all zoom levels.
4. THE Graph_Visualization SHALL allow users to drag individual Person_Nodes to reposition them within the current view; repositioned node positions SHALL revert to their computed layout positions when the User navigates away from the page or reloads.
5. WHEN the graph is first rendered, THE Graph_Visualization SHALL fit all nodes within the visible viewport.
6. WHEN a User initiates a drag action on a Person_Node, THE Graph_Visualization SHALL move that node rather than panning the canvas.

### Requirement 3: Node Click Side Panel

**User Story:** As a tree member, I want to click on a person in the graph to see their details, so that I can learn more about family members without leaving the graph view.

#### Acceptance Criteria

1. WHEN a user clicks a Person_Node, THE Side_Panel SHALL open on the right side of the page within 300 milliseconds and display the selected person's details including first name, last name, date of birth, date of death, and profile photo (or a placeholder avatar if no photo exists), omitting any field that has no value rather than displaying empty labels.
2. THE Side_Panel SHALL display a list of the selected person's direct relationships (parents, children, and spouses) with names linking to those Person_Nodes, grouped by relationship type; IF the person has no direct relationships, THEN THE Side_Panel SHALL display a message indicating no relationships exist.
3. WHEN a user clicks a relationship link in the Side_Panel, THE Graph_Visualization SHALL center on the linked Person_Node and open the Side_Panel for that person.
4. WHEN a user clicks outside the Side_Panel or clicks a close button, THE Side_Panel SHALL close.
5. WHILE the Side_Panel is open, THE Graph_Visualization SHALL remain visible and interactive behind the panel.
6. WHILE the Side_Panel is loading person details, THE Side_Panel SHALL display a loading indicator until the data is available for display.

### Requirement 4: Admin Adds Profile-Only Person Nodes

**User Story:** As a tree admin, I want to manually add person nodes for ancestors or deceased family members, so that the family tree includes people who cannot create their own accounts.

#### Acceptance Criteria

1. WHILE a User holds the Admin role on a Family_Tree, THE Platform SHALL display an "Add Person" button in the visualization view of that Family_Tree.
2. WHEN an Admin clicks "Add Person", THE Platform SHALL present a form with the following fields: first name (required, 1–100 characters), last name (optional, 1–100 characters), date of birth (optional, calendar date), date of death (optional, calendar date), and gender (optional).
3. WHEN the Admin submits the person form with valid input, THE Platform SHALL create a Person record and a Tree_Node with no linkedUserId associated with the current Family_Tree, and render the new node in the visualization view within 2 seconds.
4. IF an Admin submits the form without a first name or with a first name that is empty after trimming, THEN THE Platform SHALL display a field-level error message adjacent to the first name field indicating that first name is required, and SHALL prevent form submission.
5. IF an Admin submits the form with a date of death that is earlier than the date of birth (and both dates are provided), THEN THE Platform SHALL display a warning adjacent to the date fields but still allow submission, since dates may be approximate.
6. IF a User who does not hold the Admin role on the Family_Tree attempts to create a Person with no linkedUserId, THEN THE Platform SHALL reject the request with an HTTP 403 forbidden response.
7. WHEN a Person is created via the "Add Person" form, THE Platform SHALL record the creating Admin's identity and the creation timestamp for audit purposes.

### Requirement 5: Admin Defines Relationships

**User Story:** As a tree admin, I want to define relationships between any two people in the tree, so that the graph accurately represents family connections.

#### Acceptance Criteria

1. WHERE the user is a Tree_Admin, THE Side_Panel SHALL display an "Add Relationship" button for the selected person.
2. WHEN a Tree_Admin clicks "Add Relationship", THE System SHALL present a form to select a target person from the same tree and a relationship type (parent-child or spouse).
3. WHEN a Tree_Admin selects "parent-child" type, THE System SHALL require specifying which person is the parent and which is the child.
4. WHEN the Tree_Admin submits a relationship form with a target person selected, a relationship type chosen, and direction specified (if parent-child), THE System SHALL create a Relationship record and render the new Relationship_Edge in the Graph_Visualization with updated Dagre_Layout positions.
5. IF a relationship of the same type already exists between the two selected persons, THEN THE System SHALL reject the request with a conflict error.
6. IF a non-admin user attempts to create a Relationship, THEN THE System SHALL reject the request with a forbidden error.
7. WHERE the user is a Tree_Admin, THE Side_Panel SHALL allow deleting an existing relationship via a delete action on each listed relationship, and upon confirmation SHALL soft-delete the Relationship record and remove the corresponding Relationship_Edge from the Graph_Visualization.
8. IF a Tree_Admin selects the same person as both the source and target of a relationship, THEN THE System SHALL reject the request with a validation error indicating that a person cannot have a relationship with themselves.

### Requirement 6: Invite Link with Relationship Capture

**User Story:** As a tree admin, I want to specify the relationship between the invitee and an existing tree member when creating an invite link, so that the relationship is automatically established when the invite is accepted.

#### Acceptance Criteria

1. WHEN a Tree_Admin creates an invite link, THE System SHALL present optional fields to specify: relationship type (parent-child or spouse), the existing person in the tree the invitee relates to, and the direction (for parent-child: whether the invitee is the parent or the child). WHEN the relationship type is spouse, THE System SHALL not require or store a direction value.
2. WHEN the invite includes relationship information, THE System SHALL validate that the specified target person is an active (non-deleted) Person_Node in the tree, and SHALL store the relationship type, target person ID, and direction (if parent-child) on the Invite record.
3. WHEN an invitee accepts an invite that includes relationship information, THE System SHALL create a Person_Node for the invitee in the tree (if one does not already exist) and automatically create the corresponding Relationship_Edge between the invitee's Person_Node and the specified target person.
4. IF the invite does not include relationship information, THEN THE System SHALL create the membership without creating any Relationship_Edge.
5. IF the automatic relationship creation fails (e.g., duplicate relationship or target person was deleted after invite creation), THEN THE System SHALL still complete the membership creation and SHALL display a notification to the invitee indicating that the relationship could not be created automatically and must be added manually by an admin.
6. IF a Tree_Admin specifies a target person that does not exist or is soft-deleted in the tree, THEN THE System SHALL reject the invite creation and display an error indicating the selected person is not available.

### Requirement 7: Derived Relationship Display

**User Story:** As a tree member, I want to see derived relationships (grandparent, sibling, uncle, cousin) computed from the stored parent-child and spouse edges, so that I understand extended family connections.

#### Acceptance Criteria

1. THE Side_Panel SHALL display derived sibling relationships by identifying persons who share at least one parent with the selected person, distinguishing full siblings (sharing both parents) from half-siblings (sharing exactly one parent).
2. THE Side_Panel SHALL display derived grandparent relationships by traversing two levels of parent-child edges upward from the selected person, and derived grandchild relationships by traversing two levels of parent-child edges downward from the selected person.
3. THE Side_Panel SHALL display derived uncle/aunt relationships by identifying siblings of the selected person's parents, and derived cousin relationships by identifying children of the selected person's parents' siblings (first cousins only, one level of cousin depth).
4. THE Side_Panel SHALL label each displayed relationship with its computed type (sibling, half-sibling, grandparent, grandchild, uncle/aunt, cousin).
5. WHEN a new Relationship_Edge is added or removed, THE Side_Panel SHALL recompute and update derived relationships for all persons whose derived relationship set changes as a result of the edge modification within 2 seconds of the change.
6. IF the selected person has no derived relationships of any type, THEN THE Side_Panel SHALL display a message indicating no extended family connections were found rather than showing an empty relationship section.

### Requirement 8: React Flow and Dagre Installation

**User Story:** As a developer, I want React Flow and dagre installed as project dependencies, so that the graph visualization can be built using these libraries.

#### Acceptance Criteria

1. THE System SHALL include `@xyflow/react` as a production dependency in package.json with a version compatible with React 19.
2. THE System SHALL include `dagre` as a production dependency in package.json.
3. THE System SHALL include `@types/dagre` as a development dependency in package.json.
4. WHEN a developer runs `npm install`, THE System SHALL resolve all dependencies without version conflicts or peer dependency errors.
