# Requirements Document — Family Relationship Intelligence Platform

## Introduction

The Family Relationship Intelligence Platform is a multi-tenant, collaborative web application that solves a deeply human problem: social disconnection within families. At gatherings, weddings, reunions, and large family events, people frequently don't know how they're related to someone, what to call them, or what to talk about. This platform provides relationship clarity, family connection context, and long-term historical preservation.

The core architectural insight is that a **Person is a global entity, not a tree node**. The same person can appear across multiple family trees (father's side, husband's side, maternal side) as a shared reference — never duplicated. Family Trees are collaborative containers with shared ownership, role-based access, and multi-admin governance.

V1 focuses on: authentication, family tree creation with collaboration, person management with rich profiles, manual relationship linking, relationship path discovery ("How is this person connected to me?"), quick context profiles for gatherings, visual tree navigation, governance and trust mechanisms (claim verification, soft delete, conflict resolution, admin succession), and basic data export.

Automatic relationship inference is deferred to a later phase. This is a public multi-user product designed for many families, not a single-user personal tool.

## Glossary

- **Platform**: The Family Relationship Intelligence Platform application as a whole
- **User**: An authenticated individual who has signed in via Google Auth and holds a session; a User interacts with the Platform through a browser
- **Person**: A unique global entity representing a real human being within the family knowledge graph; a Person is independent of any single Family Tree and can be referenced across multiple trees; a Person may or may not be linked to a User account
- **Family_Tree**: A collaborative container that organizes a set of Persons and their Relationships into a navigable family structure; a Family_Tree has shared ownership among multiple administrators
- **Membership**: The association between a User and a Family_Tree, including the User's role (Admin, Editor, Viewer) within that tree
- **Relationship**: A directed, typed link between two Persons (e.g., parent-child, spouse, sibling) within the context of a Family_Tree
- **Relationship_Path**: An ordered sequence of Relationships connecting two Persons within a Family_Tree, used to answer "How is this person connected to me?"
- **Person_Profile**: The complete set of information about a Person, including biographical data, photos, notes, historical details, life events, profession, and location
- **Context_Card**: A summary view of a Person showing relationship path, recent life events, profession, location, and conversation starters — designed for quick reference before family gatherings
- **Session**: A secure, cookie-based authenticated session created after Google Auth verification on the backend; Sessions are HttpOnly, server-verified, and not dependent on client-side tokens
- **Admin**: A Membership role granting full control over a Family_Tree, including managing other members, editing all Persons and Relationships, modifying tree settings, reviewing claims, and managing merges
- **Editor**: A Membership role granting the ability to add and edit Persons and Relationships within a Family_Tree, but not manage members or tree settings
- **Viewer**: A Membership role granting read-only access to a Family_Tree's Persons, Relationships, and historical records
- **Invite**: A mechanism for an Admin to grant a new User access to a Family_Tree with a specified role
- **Historical_Record**: A structured entry attached to a Person capturing life events, stories, migration history, documents, or other family knowledge meant for generational preservation
- **Media_Asset**: A photo, document, or file uploaded and associated with a Person, a Historical_Record, or a Family_Tree
- **Linked_Person**: A Person entity that has been claimed by and verified for a User account, establishing that the User "is" that Person in the family graph; requires Admin approval
- **Tree_Node**: The representation of a Person within a specific Family_Tree, including tree-specific metadata such as position and display preferences; a Tree_Node references a Person but is not the Person itself
- **Claim_Request**: A pending request from a User to link their account to a Person record, subject to Admin approval before the Linked_Person association is created
- **Merge_Request**: A pending request to combine two Person records that represent the same real individual, subject to Admin review and approval
- **Soft_Delete**: A deletion strategy where records are marked with a deletedAt timestamp and deletedBy User reference rather than being permanently removed; soft-deleted records are excluded from normal queries but can be restored
- **Field_Visibility**: A per-field privacy setting on a Person_Profile that controls which roles can view sensitive information (e.g., "all members", "admins only", "owner and admins only")
- **Ownership_Transfer**: The process of transferring primary Admin responsibilities from one User to another within a Family_Tree

## Requirements

### Requirement 1: User Authentication via Google

**User Story:** As a visitor, I want to sign in using my Google account, so that I can securely access the Platform without creating a separate username and password.

#### Acceptance Criteria

1. WHEN a visitor clicks the "Sign in with Google" button, THE Platform SHALL initiate the Google OAuth 2.0 authentication flow using Firebase Authentication on the client side.
2. WHEN Firebase returns a valid Google ID token, THE Platform SHALL send the ID token to the backend for server-side verification against Google's public keys.
3. WHEN the backend successfully verifies the Google ID token, THE Platform SHALL create a secure, HttpOnly, SameSite=Strict session cookie with a configurable expiration (default: 7 days) and return it in the response.
4. WHEN the backend receives a Google ID token for a Google account that has no existing User record, THE Platform SHALL create a new User record with the Google profile information (display name, email, profile photo URL) and then create the session.
5. WHEN the backend receives a Google ID token for a Google account that already has an existing User record, THE Platform SHALL update the User's last login timestamp and create the session without creating a duplicate User record.
6. IF the Google ID token verification fails (expired, malformed, or invalid signature), THEN THE Platform SHALL return an HTTP 401 response with an error message and SHALL NOT create a session cookie.
7. IF the Firebase Authentication flow fails or is cancelled by the visitor, THEN THE Platform SHALL display an error message on the sign-in page and remain on the sign-in page.
8. WHEN a User clicks "Sign out", THE Platform SHALL invalidate the server-side session, clear the session cookie, and redirect the User to the sign-in page.

### Requirement 2: Session-Based Route Protection

**User Story:** As a platform operator, I want all application routes (except the sign-in page and public landing page) to be protected by server-side session verification, so that unauthenticated visitors cannot access family data.

#### Acceptance Criteria

1. THE Platform SHALL implement Next.js middleware that intercepts every request to protected routes and verifies the session cookie before allowing access.
2. WHEN a request to a protected route contains a valid, non-expired session cookie, THE Platform SHALL allow the request to proceed and make the authenticated User's identity available to Server Components and Route Handlers.
3. WHEN a request to a protected route contains no session cookie or an invalid/expired session cookie, THE Platform SHALL redirect the request to the sign-in page with an HTTP 302 response.
4. THE Platform SHALL allow unauthenticated access to the sign-in page and the public landing page without requiring a session cookie.
5. WHEN a session cookie is within 24 hours of expiration and the User makes a request, THE Platform SHALL issue a refreshed session cookie with a new expiration period to maintain seamless access.

### Requirement 3: API Rate Limiting

**User Story:** As a platform operator, I want API rate limiting on critical endpoints, so that the Platform is protected from abuse and denial-of-service attacks.

#### Acceptance Criteria

1. THE Platform SHALL enforce rate limits on authentication endpoints, limiting each IP address to 10 sign-in attempts per minute.
2. THE Platform SHALL enforce rate limits on invite creation endpoints, limiting each User to 20 invites per hour per Family_Tree.
3. THE Platform SHALL enforce rate limits on file upload endpoints, limiting each User to 30 uploads per hour.
4. THE Platform SHALL enforce rate limits on search endpoints, limiting each User to 60 search requests per minute.
5. THE Platform SHALL enforce rate limits on claim request endpoints, limiting each User to 5 claim requests per hour.
6. WHEN a rate limit is exceeded, THE Platform SHALL return an HTTP 429 response with a Retry-After header indicating when the User can retry.

### Requirement 4: Family Tree Creation and Settings

**User Story:** As a User, I want to create a new family tree and configure its basic settings, so that I can begin organizing my family's relationships and history.

#### Acceptance Criteria

1. WHEN a User submits the "Create Family Tree" form with a valid tree name (1–100 characters, non-empty after trimming), THE Platform SHALL create a new Family_Tree record and assign the creating User as the first Admin of that Family_Tree.
2. THE Platform SHALL require every Family_Tree to have a unique name within the scope of a single User's created trees.
3. WHEN a Family_Tree is created, THE Platform SHALL record the creation timestamp, the creating User's identity, and an optional description (up to 500 characters).
4. WHILE a User holds the Admin role on a Family_Tree, THE Platform SHALL allow the Admin to edit the tree name, description, and privacy settings.
5. WHEN an Admin requests deletion of a Family_Tree, THE Platform SHALL soft-delete the Family_Tree by setting a deletedAt timestamp and deletedBy reference, rather than permanently removing the record.
6. THE Platform SHALL restrict Family_Tree soft-deletion to an Admin, and only when the requesting Admin is the sole remaining Admin on the Family_Tree, to avoid deleting a tree without consent of other Admins.
7. WHILE a Family_Tree is soft-deleted, THE Platform SHALL exclude the Family_Tree from all normal queries, listings, and search results.
8. WHILE a Family_Tree is soft-deleted and within 30 days of the deletion date, THE Platform SHALL allow the deleting Admin to restore the Family_Tree and all its associated data.
9. WHEN a soft-deleted Family_Tree has been in the deleted state for more than 30 days, THE Platform SHALL permanently remove the Family_Tree and all associated Tree_Nodes, Relationships, Historical_Records, Media_Assets, Memberships, and audit log entries.
10. IF a User attempts to create a Family_Tree and the User already has 20 or more active (non-deleted) Family_Trees where the User is an Admin, THEN THE Platform SHALL reject the creation and return an error indicating the tree limit has been reached.

### Requirement 5: Family Tree Collaboration and Role-Based Access

**User Story:** As a Family_Tree Admin, I want to invite other Users to collaborate on my family tree with specific roles, so that family knowledge management is a shared responsibility.

#### Acceptance Criteria

1. WHILE a User holds the Admin role on a Family_Tree, THE Platform SHALL allow the Admin to create Invites by specifying an email address and a role (Admin, Editor, or Viewer).
2. WHEN an Admin creates an Invite, THE Platform SHALL generate a unique, cryptographically random invite token with a configurable expiration (default: 7 days) and send an invitation email to the specified address.
3. WHEN a User accepts a valid, non-expired Invite, THE Platform SHALL create a Membership record associating the User with the Family_Tree at the specified role.
4. IF a User attempts to accept an Invite that has expired, THEN THE Platform SHALL display an error message indicating the invite has expired and suggest the User request a new invite from the Admin.
5. IF a User attempts to accept an Invite for a Family_Tree where the User already has a Membership, THEN THE Platform SHALL display a message indicating the User is already a member and SHALL NOT create a duplicate Membership.
6. WHILE a User holds the Admin role on a Family_Tree, THE Platform SHALL allow the Admin to change any member's role or remove any member, except that an Admin SHALL NOT be able to remove or demote the last remaining Admin from the Family_Tree.
7. WHEN a Membership is removed, THE Platform SHALL revoke the User's access to the Family_Tree immediately, and subsequent requests by that User to access the Family_Tree SHALL be denied.
8. THE Platform SHALL enforce that every active Family_Tree has at least one Admin at all times.
9. WHILE a User holds the Viewer role on a Family_Tree, THE Platform SHALL restrict the User to read-only access: the Viewer SHALL be able to view Persons, Relationships, Historical_Records, and Media_Assets (subject to Field_Visibility settings) but SHALL NOT be able to create, edit, or delete any of them.
10. WHILE a User holds the Editor role on a Family_Tree, THE Platform SHALL allow the Editor to create, edit, and delete Persons, Relationships, Historical_Records, and Media_Assets within the Family_Tree, but SHALL NOT allow the Editor to manage Memberships, modify tree settings, review Claim_Requests, or approve Merge_Requests.

### Requirement 6: Admin Succession and Ownership Transfer

**User Story:** As a Family_Tree Admin, I want to transfer primary ownership to another Admin or ensure the tree survives if I become inactive, so that family knowledge is not lost due to a single point of failure.

#### Acceptance Criteria

1. WHILE a User holds the Admin role on a Family_Tree, THE Platform SHALL allow the Admin to initiate an Ownership_Transfer to any other member of the Family_Tree, which promotes the target member to Admin if they are not already.
2. WHEN an Ownership_Transfer is initiated, THE Platform SHALL send a notification email to the target User and require the target User to accept the transfer before it takes effect.
3. WHEN a Family_Tree has only one Admin and that Admin has not logged in for 180 consecutive days, THE Platform SHALL send an inactivity warning email to the Admin at 150 days and 170 days.
4. IF a Family_Tree has only one Admin and that Admin has not logged in for 180 consecutive days and has not responded to inactivity warnings, THEN THE Platform SHALL promote the longest-tenured Editor to Admin and send a notification email to the promoted User.
5. IF a Family_Tree has only one Admin, no Editors, and the Admin has been inactive for 180 days, THEN THE Platform SHALL send a final warning to all Viewers and retain the tree in a read-only frozen state until an Admin is restored or the tree is claimed.

### Requirement 7: Person Creation and Profile Management

**User Story:** As an Editor or Admin of a Family_Tree, I want to add new Persons and manage their profile information, so that the family knowledge base is rich and accurate.

#### Acceptance Criteria

1. WHEN an Admin or Editor submits the "Add Person" form with at least a first name (1–100 characters), THE Platform SHALL create a new Person record and associate the Person with the current Family_Tree as a Tree_Node.
2. THE Platform SHALL support the following optional Person_Profile fields: last name, maiden name, date of birth, date of death, gender, profession, location (city/country), phone number, email, biography (up to 2000 characters), and profile photo.
3. WHEN a Person is created, THE Platform SHALL record the creating User's identity and the creation timestamp for audit purposes.
4. WHILE a User holds the Admin or Editor role on a Family_Tree, THE Platform SHALL allow the User to edit any Person_Profile field for Persons associated with that Family_Tree, subject to Field_Visibility restrictions.
5. WHEN a Person_Profile is edited, THE Platform SHALL record the editing User's identity, the edit timestamp, and the fields that were changed for audit purposes.
6. THE Platform SHALL support uploading up to 20 photos per Person, with each photo not exceeding 5 MB in size and restricted to JPEG, PNG, or WebP formats.
7. IF a User attempts to upload a photo that exceeds 5 MB or is not in an accepted format, THEN THE Platform SHALL reject the upload and display a specific error message indicating the constraint that was violated.
8. WHEN an Admin or Editor deletes a Person from a Family_Tree, THE Platform SHALL soft-delete the Tree_Node and all Relationships involving that Person within that Family_Tree by setting deletedAt and deletedBy fields.
9. WHILE a Tree_Node is soft-deleted and within 30 days of the deletion date, THE Platform SHALL allow an Admin or Editor to restore the Tree_Node and its associated Relationships.
10. IF a Person is soft-deleted from all Family_Trees that reference the Person (no active Tree_Nodes remain), THE Platform SHALL retain the Person record in a soft-deleted state for 30 days before permanent deletion, and SHALL prompt the last-deleting User to confirm they understand the Person will be permanently removed after 30 days.

### Requirement 8: Field-Level Privacy Controls

**User Story:** As a User whose Person_Profile contains sensitive information, I want to control which roles can see specific fields like my phone number, email, or date of birth, so that my privacy is respected within the family tree.

#### Acceptance Criteria

1. THE Platform SHALL support three Field_Visibility levels for sensitive Person_Profile fields: "all_members" (visible to all Membership roles), "admins_only" (visible only to Admins), and "owner_and_admins" (visible only to the Linked_Person's User account and Admins).
2. THE Platform SHALL apply Field_Visibility controls to the following fields: date of birth, phone number, email, and biography.
3. WHEN a Person_Profile is displayed, THE Platform SHALL filter out fields that the requesting User's role does not have permission to view based on the Field_Visibility settings.
4. THE Platform SHALL default all privacy-controlled fields to "all_members" visibility when a Person is first created.
5. WHILE a User is the Linked_Person for a Person record, THE Platform SHALL allow the User to change the Field_Visibility settings for their own Person_Profile's sensitive fields.
6. WHILE a User holds the Admin role on a Family_Tree, THE Platform SHALL allow the Admin to view all fields regardless of Field_Visibility settings, to support administrative and dispute resolution needs.

### Requirement 9: Person Identity Linking Across Trees

**User Story:** As an Admin or Editor, I want to link a Person in my tree to an existing Person in another tree, so that the same real person is represented as a single entity across the platform without duplication.

#### Acceptance Criteria

1. WHEN an Admin or Editor is adding a Person to a Family_Tree, THE Platform SHALL offer a search function to find existing Persons by name, email, or date of birth before creating a new Person record.
2. WHEN the User selects an existing Person from search results, THE Platform SHALL create a new Tree_Node in the current Family_Tree referencing the existing Person record, rather than creating a duplicate Person.
3. THE Platform SHALL display a clear indicator on a Person_Profile when that Person is referenced in multiple Family_Trees, showing the count of trees (but not the tree names, to respect privacy of other trees).
4. WHEN a Person_Profile field is edited in one Family_Tree, THE Platform SHALL reflect the updated field across all Family_Trees that reference the same Person, since the Person is a shared global entity, and SHALL create an audit log entry visible to Admins of all affected Family_Trees.
5. WHILE a User does not hold at least Viewer access to a Family_Tree, THE Platform SHALL exclude Persons from that Family_Tree from the User's search results, to prevent information leakage across tree boundaries.

### Requirement 10: User-to-Person Account Linking (Claim Verification)

**User Story:** As a User, I want to claim a Person record as "me" in a family tree, with Admin verification, so that the platform knows my position in the family graph and identity claims are trustworthy.

#### Acceptance Criteria

1. WHEN a User views a Person_Profile within a Family_Tree where the User has at least Editor access, THE Platform SHALL offer a "This is me" action to initiate a Claim_Request to link the User's account to that Person record.
2. WHEN a User submits a "This is me" Claim_Request, THE Platform SHALL create a pending Claim_Request record and send a notification email to all Admins of the Family_Tree.
3. WHILE a Claim_Request is pending, THE Platform SHALL display the pending status on the Person_Profile visible to the claiming User and to Admins.
4. WHEN an Admin approves a Claim_Request, THE Platform SHALL create the Linked_Person association, send a notification email to the claiming User, and use the Linked_Person as the origin point for Relationship_Path calculations within that Family_Tree.
5. WHEN an Admin rejects a Claim_Request, THE Platform SHALL send a notification email to the claiming User with an optional reason provided by the Admin.
6. THE Platform SHALL allow a User to be linked to at most one Person per Family_Tree.
7. IF a User attempts to claim a Person that already has an approved Linked_Person association with a different User, THEN THE Platform SHALL reject the Claim_Request and display a message indicating the Person is already claimed.
8. IF a Claim_Request remains pending for more than 30 days without Admin action, THEN THE Platform SHALL send a reminder email to the Family_Tree Admins.
9. WHEN a User is linked to a Person, THE Platform SHALL display the User's profile photo and online status on the Person_Profile within the Family_Tree.

### Requirement 11: Manual Relationship Linking

**User Story:** As an Admin or Editor, I want to manually define relationships between Persons in a family tree, so that the family structure is accurately represented.

#### Acceptance Criteria

1. WHILE a User holds the Admin or Editor role on a Family_Tree, THE Platform SHALL allow the User to create a Relationship between any two Persons within that Family_Tree.
2. THE Platform SHALL support the following Relationship types in V1: parent-child, spouse, and sibling.
3. WHEN a User creates a parent-child Relationship, THE Platform SHALL store it as a directed link from parent to child, and SHALL automatically create the inverse link (child to parent) so that both directions are queryable.
4. WHEN a User creates a spouse Relationship, THE Platform SHALL store it as a bidirectional link between the two Persons.
5. WHEN a User creates a sibling Relationship, THE Platform SHALL store it as a bidirectional link between the two Persons.
6. IF a User attempts to create a Relationship that already exists between two Persons of the same type, THEN THE Platform SHALL reject the creation and display a message indicating the Relationship already exists.
7. IF a User attempts to create a parent-child Relationship where the child's date of birth is earlier than the parent's date of birth (and both dates are known), THEN THE Platform SHALL display a warning but still allow the Relationship to be created, since dates may be approximate or incorrect.
8. WHEN a Relationship is soft-deleted, THE Platform SHALL also soft-delete the corresponding inverse link to maintain data consistency.
9. THE Platform SHALL allow an optional label on a Relationship (e.g., "biological", "adoptive", "step") up to 50 characters.
10. WHEN a Relationship is created or edited, THE Platform SHALL record the acting User's identity and timestamp for audit purposes.

### Requirement 12: Relationship Conflict Resolution

**User Story:** As a Family_Tree Admin, I want clear rules for handling conflicting relationships (e.g., two different fathers assigned to the same person), so that data integrity is maintained and disputes can be resolved.

#### Acceptance Criteria

1. WHEN two Users create conflicting Relationships for the same Person (e.g., two parent-child Relationships assigning different fathers to the same child), THE Platform SHALL allow both Relationships to coexist and SHALL flag the conflict by displaying a visual indicator on the affected Person's profile.
2. THE Platform SHALL define a conflict as: a Person having more than two parent-child Relationships where the Person is the child (more than two parents), or a Person having more than one active spouse Relationship (unless explicitly labeled as historical/former).
3. WHILE a conflict exists on a Person, THE Platform SHALL display the conflict indicator to all members with at least Viewer access and SHALL display a detailed conflict summary to Admins.
4. WHILE a User holds the Admin role on a Family_Tree, THE Platform SHALL allow the Admin to resolve a conflict by choosing which Relationship to retain and which to soft-delete, with the resolution recorded in the audit log.
5. THE Platform SHALL retain the full audit trail of all conflicting Relationships, including soft-deleted ones, so that the history of the conflict is preserved.

### Requirement 13: Person Merge (Duplicate Resolution)

**User Story:** As a Family_Tree Admin, I want to merge two Person records that represent the same real individual, so that duplicates are eliminated and the family graph remains accurate.

#### Acceptance Criteria

1. WHILE a User holds the Admin role on a Family_Tree, THE Platform SHALL allow the Admin to initiate a Merge_Request by selecting two Person records within the same Family_Tree that the Admin believes represent the same individual.
2. WHEN a Merge_Request is initiated, THE Platform SHALL display a side-by-side comparison of the two Person_Profiles, highlighting differences in each field.
3. THE Platform SHALL require the Admin to choose, for each conflicting field, which value to retain in the merged Person record.
4. WHEN a Merge_Request is confirmed, THE Platform SHALL combine all Relationships, Historical_Records, Media_Assets, and Tree_Nodes from both Person records into the surviving Person record, soft-delete the non-surviving Person record, and record the merge in the audit log.
5. IF the non-surviving Person record is referenced in other Family_Trees, THEN THE Platform SHALL update those references to point to the surviving Person record and SHALL notify the Admins of the affected Family_Trees.
6. THE Platform SHALL allow an Admin to undo a merge within 30 days by restoring the soft-deleted Person record and reversing the reference updates.
7. THE Platform SHALL NOT support automatic or AI-driven merges in V1; all merges require explicit Admin review and confirmation.

### Requirement 14: Relationship Path Discovery

**User Story:** As a User attending a family gathering, I want to understand how a specific Person is connected to me through the family tree, so that I can approach them with confidence and context.

#### Acceptance Criteria

1. WHEN a User who has a Linked_Person in a Family_Tree selects another Person in the same Family_Tree, THE Platform SHALL compute and display the shortest Relationship_Path connecting the User's Linked_Person to the selected Person.
2. THE Platform SHALL display the Relationship_Path as a human-readable sequence of steps (e.g., "You → [parent of] → Rajesh → [spouse of] → Meena → [parent of] → Priya").
3. IF no Relationship_Path exists between the User's Linked_Person and the selected Person within the Family_Tree, THEN THE Platform SHALL display a message indicating that no connection was found and suggest that relationships may be missing from the tree.
4. WHEN multiple shortest paths of equal length exist, THE Platform SHALL display one path and indicate that alternative paths are available.
5. THE Platform SHALL compute Relationship_Paths using only active (non-soft-deleted) Relationships within the current Family_Tree context, not across different Family_Trees.
6. THE Platform SHALL complete Relationship_Path computation and display the result within 2 seconds for Family_Trees containing up to 500 Persons.

### Requirement 15: Quick Context Profile (Context Card)

**User Story:** As a User preparing for a family gathering, I want to see a quick summary of a Person including how they're related to me, their recent life events, profession, and location, so that I have conversation starters and social context.

#### Acceptance Criteria

1. WHEN a User selects a Person within a Family_Tree, THE Platform SHALL display a Context_Card containing: the Person's name, profile photo, relationship path to the User (if the User has a Linked_Person), profession, location, and the three most recent Historical_Records.
2. WHILE the User does not have a Linked_Person in the current Family_Tree, THE Platform SHALL display the Context_Card without the relationship path section and SHALL show a prompt to link their account to a Person.
3. THE Platform SHALL render the Context_Card within 1 second of the User selecting a Person, using cached or pre-fetched data where available.
4. WHEN a Context_Card is displayed, THE Platform SHALL show the Person's age (calculated from date of birth) or "Deceased" with the year of death if the date of death is recorded.
5. IF a Person has no Historical_Records, THEN THE Platform SHALL display the Context_Card without the recent events section rather than showing an empty section.
6. THE Platform SHALL respect Field_Visibility settings when rendering the Context_Card, hiding fields the requesting User does not have permission to view.

### Requirement 16: Historical Record Management

**User Story:** As an Admin or Editor, I want to attach historical records to a Person — including life events, stories, migration history, and documents — so that family knowledge is preserved across generations.

#### Acceptance Criteria

1. WHILE a User holds the Admin or Editor role on a Family_Tree, THE Platform SHALL allow the User to create a Historical_Record attached to any Person within that Family_Tree.
2. THE Platform SHALL support the following Historical_Record types: life event, story, migration, document, note, and custom.
3. WHEN a User creates a Historical_Record, THE Platform SHALL require a title (1–200 characters) and allow an optional description (up to 5000 characters), an optional date or date range, and optional Media_Asset attachments.
4. THE Platform SHALL support uploading up to 10 Media_Assets per Historical_Record, with each file not exceeding 10 MB, restricted to JPEG, PNG, WebP, PDF, and plain text formats.
5. IF a User attempts to upload a Media_Asset that violates size or format constraints, THEN THE Platform SHALL reject the upload and display a specific error message.
6. WHEN Historical_Records for a Person are displayed, THE Platform SHALL order them by date (most recent first), with undated records appearing at the end.
7. WHEN a Historical_Record is deleted, THE Platform SHALL soft-delete the record by setting deletedAt and deletedBy fields, and SHALL allow restoration within 30 days.
8. WHEN a Historical_Record is edited or deleted, THE Platform SHALL record the acting User's identity and timestamp for audit purposes.

### Requirement 17: Family Tree Visualization

**User Story:** As a User, I want to see a visual graph of the family tree, so that I can navigate relationships intuitively and understand the family structure at a glance.

#### Acceptance Criteria

1. WHEN a User opens the visualization view of a Family_Tree, THE Platform SHALL render an interactive graph displaying Persons as nodes and Relationships as edges.
2. THE Platform SHALL visually distinguish Relationship types using different edge styles: solid lines for parent-child, dashed lines for spouse, and dotted lines for sibling relationships.
3. THE Platform SHALL display each Person node with the Person's name and profile photo (or a default avatar if no photo exists).
4. WHEN a User clicks on a Person node in the visualization, THE Platform SHALL open the Context_Card for that Person.
5. THE Platform SHALL support panning and zooming on the visualization to navigate large family trees.
6. THE Platform SHALL render the initial visualization within 3 seconds for Family_Trees containing up to 500 Persons.
7. WHILE the visualization is displayed, THE Platform SHALL highlight the User's Linked_Person node with a distinct visual indicator (e.g., colored border) so the User can orient themselves in the graph.
8. THE Platform SHALL provide a "Center on me" action that pans and zooms the visualization to focus on the User's Linked_Person node.
9. THE Platform SHALL ensure that the tree visualization is usable on mobile devices with touch-based panning and pinch-to-zoom gestures.

### Requirement 18: Media Asset Management

**User Story:** As an Admin or Editor, I want to upload and manage photos and documents associated with Persons and historical records, so that family memories and artifacts are preserved digitally.

#### Acceptance Criteria

1. THE Platform SHALL store uploaded Media_Assets on the server's file system (or a configured object storage path) with a unique, non-guessable filename to prevent URL enumeration.
2. WHEN a Media_Asset is uploaded, THE Platform SHALL validate the file's MIME type against the allowed formats and reject files whose actual content type does not match the declared extension.
3. THE Platform SHALL serve Media_Assets only to Users who have at least Viewer access to the Family_Tree containing the associated Person or Historical_Record.
4. WHEN a Media_Asset is deleted, THE Platform SHALL soft-delete the Media_Asset record and retain the file on storage for 30 days before permanent removal.
5. THE Platform SHALL enforce a total storage limit of 500 MB per Family_Tree for all active (non-soft-deleted) Media_Assets combined.
6. IF a Media_Asset upload would cause the Family_Tree to exceed its 500 MB storage limit, THEN THE Platform SHALL reject the upload and display a message indicating the storage limit has been reached.

### Requirement 19: Search and Discovery

**User Story:** As a User, I want to search for Persons within my family trees, so that I can quickly find and navigate to the person I'm looking for.

#### Acceptance Criteria

1. WHEN a User enters a search query of at least 2 characters, THE Platform SHALL return matching Persons from all Family_Trees where the User has at least Viewer access.
2. THE Platform SHALL match search queries against Person first name, last name, maiden name, and location fields using case-insensitive partial matching.
3. THE Platform SHALL return search results within 500 milliseconds for a User with access to up to 10 Family_Trees containing a combined total of up to 5000 Persons.
4. THE Platform SHALL display search results grouped by Family_Tree, showing the Person's name, profile photo, and Family_Tree name.
5. WHEN a User selects a search result, THE Platform SHALL navigate the User to the Person_Profile within the relevant Family_Tree.

### Requirement 20: Notification System

**User Story:** As a User, I want to receive email notifications for important trust-related actions, so that I stay informed about changes that affect my family trees and identity.

#### Acceptance Criteria

1. THE Platform SHALL send email notifications for the following events: invite sent, invite accepted, Claim_Request submitted, Claim_Request approved, Claim_Request rejected, Membership removed, Ownership_Transfer initiated, and Ownership_Transfer completed.
2. WHEN a Person_Profile field is edited on a Person that is referenced in multiple Family_Trees, THE Platform SHALL send a notification email to the Admins of all affected Family_Trees summarizing the change.
3. THE Platform SHALL include in each notification email: the event type, the acting User's name, the affected Family_Tree name, a timestamp, and a direct link to the relevant page in the Platform.
4. THE Platform SHALL allow Users to configure notification preferences, with the ability to opt out of non-critical notifications (but not trust-related notifications such as Claim_Requests and Membership removals).
5. THE Platform SHALL send notification emails asynchronously so that the triggering action is not delayed by email delivery.

### Requirement 21: Audit Trail

**User Story:** As a Family_Tree Admin, I want to see a log of who made changes to the family tree, so that I can track contributions and identify incorrect edits.

#### Acceptance Criteria

1. THE Platform SHALL record an audit log entry for every create, update, soft-delete, restore, and merge operation on Persons, Relationships, Historical_Records, Media_Assets, Memberships, Claim_Requests, and Merge_Requests within a Family_Tree.
2. THE Platform SHALL include in each audit log entry: the acting User's identity, the operation type, the affected entity type and identifier, a timestamp, and a summary of the change.
3. WHILE a User holds the Admin role on a Family_Tree, THE Platform SHALL allow the Admin to view the audit log for that Family_Tree, ordered by timestamp (most recent first).
4. THE Platform SHALL retain audit log entries for at least 1 year.
5. THE Platform SHALL paginate audit log results, returning 50 entries per page.
6. THE Platform SHALL retain audit log entries even when the associated entity is permanently deleted, to preserve the historical record of actions.

### Requirement 22: Data Export

**User Story:** As a Family_Tree Admin, I want to export my family tree data, so that I have ownership over my family's information and can back it up independently.

#### Acceptance Criteria

1. WHILE a User holds the Admin role on a Family_Tree, THE Platform SHALL allow the Admin to export the Family_Tree data as a JSON file containing all Persons, Relationships, Historical_Records, and Membership metadata.
2. THE Platform SHALL include in the JSON export: Person_Profile fields (respecting Field_Visibility settings based on the exporting User's role), Relationship types and labels, Historical_Record titles and descriptions, and tree metadata.
3. THE Platform SHALL generate the export file within 30 seconds for Family_Trees containing up to 500 Persons.
4. THE Platform SHALL NOT include Media_Asset binary files in the JSON export, but SHALL include Media_Asset metadata (filename, type, upload date) with a note that media files can be downloaded separately.
5. WHEN an export is completed, THE Platform SHALL make the file available for download for 24 hours and then automatically delete the export file from the server.

### Requirement 23: Account Deletion

**User Story:** As a User, I want to delete my account and have my personal data removed, so that I can exercise my right to data privacy.

#### Acceptance Criteria

1. WHEN a User requests account deletion, THE Platform SHALL display a summary of the impact: number of Memberships that will be removed, number of Linked_Person associations that will be unlinked, and any Family_Trees where the User is the sole Admin.
2. IF the User is the sole Admin of one or more Family_Trees, THEN THE Platform SHALL require the User to either transfer Admin ownership or confirm deletion of those Family_Trees before proceeding with account deletion.
3. WHEN account deletion is confirmed, THE Platform SHALL: remove all Memberships for the User, unlink all Linked_Person associations, anonymize the User's identity in audit log entries (replacing the User's name with "Deleted User"), delete the User's session, and delete the User record.
4. THE Platform SHALL preserve all Historical_Records, Relationships, and Person records that the deleted User contributed, attributing them to "Deleted User" in the audit trail, so that family knowledge outlives individual accounts.
5. THE Platform SHALL complete account deletion within 30 days of the User's confirmation, in compliance with data privacy best practices.

### Requirement 24: Input Validation and Error Handling

**User Story:** As a User, I want clear, specific error messages when I provide invalid input, so that I can correct my mistakes without confusion.

#### Acceptance Criteria

1. THE Platform SHALL validate all user input on both the client side (for immediate feedback) and the server side (for security enforcement).
2. WHEN a User submits a form with invalid input, THE Platform SHALL display field-level error messages adjacent to each invalid field, specifying the constraint that was violated.
3. THE Platform SHALL sanitize all user-provided text input to prevent cross-site scripting (XSS) attacks before storing or rendering the input.
4. IF an unexpected server error occurs during any operation, THEN THE Platform SHALL return an HTTP 500 response with a generic error message to the User and log the detailed error (including stack trace) on the server for debugging.
5. THE Platform SHALL validate that all referenced entity IDs (Person, Family_Tree, Relationship, etc.) exist and that the requesting User has appropriate access before performing any operation, returning HTTP 403 for access violations and HTTP 404 for missing entities.

### Requirement 25: Responsive Design and Accessibility

**User Story:** As a User, I want to use the Platform on my phone, tablet, or desktop, so that I can look up family information at gatherings regardless of what device I have.

#### Acceptance Criteria

1. THE Platform SHALL render all pages responsively, adapting layout to viewport widths from 320px (mobile) to 2560px (large desktop).
2. THE Platform SHALL meet WCAG 2.1 Level AA compliance for all interactive elements, including sufficient color contrast ratios (4.5:1 for normal text, 3:1 for large text), keyboard navigability, and screen reader compatibility.
3. THE Platform SHALL use semantic HTML elements and ARIA attributes where necessary to ensure assistive technology compatibility.

### Requirement 26: Performance and Scalability Baseline

**User Story:** As a platform operator, I want the system to perform well under expected V1 load, so that users have a smooth experience.

#### Acceptance Criteria

1. THE Platform SHALL serve server-rendered pages with a Time to First Byte (TTFB) of under 800 milliseconds for authenticated requests under normal load (up to 100 concurrent users).
2. THE Platform SHALL support at least 1000 registered Users, 500 Family_Trees, and 50,000 Person records without degradation below the specified performance thresholds.
3. THE Platform SHALL implement database indexes on frequently queried fields (User email, Person name, Family_Tree membership, Relationship endpoints) to maintain query performance.
4. THE Platform SHALL use Next.js Server Components for data-heavy pages to minimize client-side JavaScript bundle size.

### Requirement 27: VPS Deployment Readiness

**User Story:** As a platform operator, I want to deploy the Platform on a VPS without dependency on Vercel-specific features, so that I maintain infrastructure control and cost predictability.

#### Acceptance Criteria

1. THE Platform SHALL be deployable using `next start` behind a reverse proxy (Nginx or Caddy) on a standard Linux VPS.
2. THE Platform SHALL not depend on Vercel-specific features (Edge Functions, Vercel KV, Vercel Blob, Vercel Analytics) for any core functionality.
3. THE Platform SHALL use environment variables for all configuration (database connection string, Firebase credentials, session secret, storage paths, domain name) following the twelve-factor app methodology.
4. THE Platform SHALL include a production-ready Docker configuration (Dockerfile and docker-compose.yml) that bundles the Next.js application and MongoDB for single-command deployment.
5. THE Platform SHALL support HTTPS termination at the reverse proxy level and SHALL set secure cookie attributes (Secure, HttpOnly, SameSite=Strict) that function correctly behind a reverse proxy with proper `X-Forwarded-Proto` header handling.
