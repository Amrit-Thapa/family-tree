# Implementation Tasks — Family Relationship Intelligence Platform

## Task 1: Project Setup and Infrastructure

- [x] 1.1 Initialize Next.js 14+ project with App Router, TypeScript, ESLint, and Tailwind CSS
- [x] 1.2 Set up MongoDB connection with Mongoose singleton pattern in `src/lib/db/connection.ts`
- [x] 1.3 Create all Mongoose model definitions in `src/lib/db/models/` (User, Session, FamilyTree, Membership, Person, TreeNode, Relationship, Invite, ClaimRequest, MergeRequest, HistoricalRecord, MediaAsset, AuditLog) with indexes as specified in the design document
- [ ] 1.4 Set up Firebase Admin SDK initialization in `src/lib/auth/firebase-admin.ts` and Firebase client SDK in `src/lib/auth/firebase-client.ts`
- [ ] 1.5 Create shared Zod validation schemas in `src/lib/validations/` for all entity types (tree, person, relationship, historical record, invite, claim, merge)
- [ ] 1.6 Create custom error classes in `src/lib/utils/errors.ts` (AppError, ValidationError, AuthError, ForbiddenError, NotFoundError, ConflictError, RateLimitError) with standardized API error response format
- [ ] 1.7 Create XSS sanitization utility in `src/lib/utils/sanitize.ts` using DOMPurify or similar library
- [ ] 1.8 Set up Nodemailer email transporter in `src/lib/email/transporter.ts` with configurable SMTP settings via environment variables
- [ ] 1.9 Create file storage abstraction in `src/lib/storage/` with `StorageInterface` and `LocalStorage` implementation
- [ ] 1.10 Set up rate limiting module in `src/lib/rate-limit/limiter.ts` using `rate-limiter-flexible` with in-memory store
- [ ] 1.11 Create Docker configuration (Dockerfile with multi-stage build, docker-compose.yml with app + mongo + nginx services, nginx.conf)
- [ ] 1.12 Create environment variable configuration with `.env.example` documenting all required variables

## Task 2: Authentication and Session Management

- [ ] 2.1 Implement `src/lib/auth/session.ts` with functions: createSession (generates crypto token, stores in MongoDB, sets HttpOnly cookie), verifySession (validates cookie token against DB), refreshSession (extends expiry if within 24h of expiration), invalidateSession (deletes from DB, clears cookie)
- [ ] 2.2 Implement Next.js middleware in `src/middleware.ts` that intercepts protected routes, calls verifySession, redirects to /auth/signin on failure, and passes user identity to request context
- [ ] 2.3 Implement `src/lib/services/auth.service.ts` with signIn (verify Firebase ID token, find-or-create User, create session), signOut (invalidate session), and getCurrentUser functions
- [ ] 2.4 Create Route Handler `POST /api/auth/signin` that accepts Firebase ID token, calls auth service, returns session cookie
- [ ] 2.5 Create Route Handler `POST /api/auth/signout` that invalidates session and clears cookie
- [ ] 2.6 Create Route Handler `GET /api/auth/me` that returns current authenticated user profile
- [ ] 2.7 Create sign-in page at `src/app/(public)/auth/signin/page.tsx` with GoogleSignInButton component that triggers Firebase signInWithPopup and posts ID token to /api/auth/signin
- [ ] 2.8 Create `src/components/auth/AuthProvider.tsx` client component that provides auth context (current user, loading state, sign-out function) to the component tree
- [ ] 2.9 Create protected layout at `src/app/(protected)/layout.tsx` that verifies session server-side and renders sidebar navigation with user profile

## Task 3: Family Tree CRUD and Soft Delete

- [ ] 3.1 Implement `src/lib/services/tree.service.ts` with createTree (validate name uniqueness per user, enforce 20-tree limit, create FamilyTree + initial Admin Membership), getTree, updateTree, softDeleteTree (sole-admin check), restoreTree, and listUserTrees functions
- [ ] 3.2 Implement `src/lib/services/audit.service.ts` with createAuditEntry function that records operation, entity type, entity ID, actor, summary, and changes; integrate with tree service for create/update/delete operations
- [ ] 3.3 Create Route Handlers for `/api/trees` (GET list, POST create) and `/api/trees/[treeId]` (GET detail, PATCH update, DELETE soft-delete) and `/api/trees/[treeId]/restore` (POST restore)
- [ ] 3.4 Create Server Actions for tree creation and update forms
- [ ] 3.5 Create dashboard page at `src/app/(protected)/dashboard/page.tsx` showing user's family trees as cards with name, description, member count, and creation date
- [ ] 3.6 Create tree creation page at `src/app/(protected)/trees/new/page.tsx` with form for name and description
- [ ] 3.7 Create tree-scoped layout at `src/app/(protected)/trees/[treeId]/layout.tsx` that verifies membership, determines role, and provides tree context to child routes
- [ ] 3.8 Create tree settings page at `src/app/(protected)/trees/[treeId]/settings/page.tsx` (admin-only) with edit form and soft-delete action with confirmation dialog

## Task 4: Membership, Invites, and Collaboration

- [ ] 4.1 Implement `src/lib/services/membership.service.ts` with getMembers, changeMemberRole (enforce last-admin protection), removeMember (enforce last-admin protection, immediate access revocation), and getMembership (for authorization checks) functions
- [ ] 4.2 Implement `src/lib/services/invite.service.ts` with createInvite (generate crypto token, set 7-day expiry), acceptInvite (validate token, check expiry, check existing membership, create Membership), revokeInvite, and listPendingInvites functions
- [ ] 4.3 Create email templates for invite notification in `src/lib/email/templates/` using HTML templates with invite link, tree name, and inviter name
- [ ] 4.4 Implement `src/lib/services/notification.service.ts` with sendInviteEmail, sendClaimNotification, sendMembershipChangeEmail, sendOwnershipTransferEmail, and sendCrossTreeEditNotification functions; respect user notification preferences; send asynchronously
- [ ] 4.5 Create Route Handlers for `/api/trees/[treeId]/members` (GET list, PATCH role change, DELETE remove) and `/api/trees/[treeId]/invites` (POST create, GET list, DELETE revoke)
- [ ] 4.6 Create Route Handler `POST /api/invites/[token]/accept` for accepting invites (no tree context needed, token-based lookup)
- [ ] 4.7 Create member management page at `src/app/(protected)/trees/[treeId]/members/page.tsx` (admin-only) showing member list with role badges, role change dropdowns, remove buttons, and invite form
- [ ] 4.8 Create invite acceptance page at `src/app/(protected)/invite/[token]/page.tsx` showing tree name, inviter, role, and accept/decline buttons

## Task 5: Admin Succession and Ownership Transfer

- [ ] 5.1 Implement ownership transfer functions in `src/lib/services/membership.service.ts`: initiateTransfer (create pending transfer, send notification email), acceptTransfer (promote target to admin, record in audit log)
- [ ] 5.2 Create Route Handler `POST /api/trees/[treeId]/transfer` for initiating ownership transfer
- [ ] 5.3 Add inactivity detection logic: a scheduled function (or API route callable by cron) that checks for single-admin trees where the admin hasn't logged in for 150/170/180 days, sends warning emails, and auto-promotes longest-tenured editor at 180 days

## Task 6: Person Management and Profiles

- [ ] 6.1 Implement `src/lib/services/person.service.ts` with createPerson (create Person + TreeNode, record audit), updatePerson (update fields, record changed fields in audit, propagate to all trees referencing the person), softDeletePersonFromTree (soft-delete TreeNode + associated Relationships, check if last tree reference), restorePerson, and getPersonProfile (apply field visibility filtering based on requester's role and linked person status) functions
- [ ] 6.2 Create Route Handlers for `/api/trees/[treeId]/persons` (GET list, POST create) and `/api/trees/[treeId]/persons/[personId]` (GET profile with field visibility, PATCH update, DELETE soft-delete, POST restore)
- [ ] 6.3 Create person list page at `src/app/(protected)/trees/[treeId]/persons/page.tsx` showing person cards with name, photo, profession, and location
- [ ] 6.4 Create person form component at `src/components/person/PersonForm.tsx` with all profile fields, client-side Zod validation, and photo upload integration
- [ ] 6.5 Create add person page at `src/app/(protected)/trees/[treeId]/persons/new/page.tsx` with search-before-create flow: search existing persons first, option to link existing or create new
- [ ] 6.6 Create person profile page at `src/app/(protected)/trees/[treeId]/persons/[personId]/page.tsx` as Server Component showing full profile, photos, historical records, and context card
- [ ] 6.7 Implement field-level privacy controls: add Field_Visibility settings UI to person profile (visible only to linked person and admins), integrate visibility filtering into getPersonProfile service function

## Task 7: Cross-Tree Person Linking

- [ ] 7.1 Implement person search function in `src/lib/services/search.service.ts` with searchPersons (search by name/email/DOB across accessible trees, respect tree access boundaries, case-insensitive partial matching, return results grouped by tree)
- [ ] 7.2 Create Route Handler `GET /api/search/persons?q=...` with debounce-friendly response and 500ms SLA
- [ ] 7.3 Create SearchBar component at `src/components/search/SearchBar.tsx` with debounced input and SearchResults component showing grouped results
- [ ] 7.4 Integrate search into add-person flow: when creating a person, show search results for potential matches, allow linking to existing person instead of creating duplicate
- [ ] 7.5 Add cross-tree indicator to person profile: show "Referenced in N family trees" badge when person exists in multiple trees

## Task 8: User-to-Person Claim Verification

- [ ] 8.1 Implement `src/lib/services/claim.service.ts` with submitClaim (create ClaimRequest, send notification to admins), approveClaim (set linkedUserId on TreeNode, send notification to claimant), rejectClaim (send notification with reason), listPendingClaims, and sendClaimReminder (for 30-day stale claims) functions
- [ ] 8.2 Create Route Handlers for `/api/trees/[treeId]/claims` (POST submit, GET list for admins, PATCH approve/reject)
- [ ] 8.3 Add "This is me" button to person profile page, visible to editors/admins who haven't already claimed a person in this tree; clicking submits a claim request
- [ ] 8.4 Create claims management page at `src/app/(protected)/trees/[treeId]/claims/page.tsx` (admin-only) showing pending claims with approve/reject actions and optional rejection reason input

## Task 9: Manual Relationship Linking

- [ ] 9.1 Implement `src/lib/services/relationship.service.ts` with createRelationship (validate no duplicate, create forward + inverse links for parent-child, create bidirectional for spouse/sibling, date sanity warning, record audit), softDeleteRelationship (soft-delete both forward and inverse, record audit), updateRelationship (label change), listRelationships, and detectConflicts (check for >2 parents or >1 active spouse) functions
- [ ] 9.2 Create Route Handlers for `/api/trees/[treeId]/relationships` (GET list, POST create, PATCH update label, DELETE soft-delete)
- [ ] 9.3 Create relationship form component at `src/components/relationship/RelationshipForm.tsx` with person selectors (dropdowns or search), relationship type selector, optional label input, and date sanity warning display
- [ ] 9.4 Create relationship management page at `src/app/(protected)/trees/[treeId]/relationships/page.tsx` showing relationship list with type badges, labels, and delete actions
- [ ] 9.5 Implement conflict detection and display: add conflict indicator to person profile when detectConflicts returns true, show conflict summary to admins with resolution actions (choose which relationship to retain)

## Task 10: Relationship Path Discovery

- [ ] 10.1 Implement `src/lib/services/path-finder.service.ts` with findShortestPath function using BFS on the adjacency list of active relationships within a single tree; return ordered sequence of (person, relationship type, direction) steps; handle no-path-found case; detect multiple shortest paths
- [ ] 10.2 Implement path formatting function that converts BFS result into human-readable string (e.g., "You → [parent of] → Rajesh → [spouse of] → Meena → [parent of] → Priya")
- [ ] 10.3 Create Route Handler `GET /api/trees/[treeId]/persons/[personId]/path` that computes path from requester's linked person to target person, returns formatted path and alternative path indicator
- [ ] 10.4 Create PathDisplay component at `src/components/relationship/PathDisplay.tsx` showing the relationship path as a visual chain with person names and relationship labels
- [ ] 10.5 Integrate path display into person profile page and context card

## Task 11: Context Card

- [ ] 11.1 Create Route Handler `GET /api/trees/[treeId]/persons/[personId]/context` that returns context card data: person name, photo, relationship path (if linked), profession, location, age/deceased status, and 3 most recent historical records; respect field visibility
- [ ] 11.2 Create ContextCard component at `src/components/person/ContextCard.tsx` as a slide-over panel showing all context card fields with graceful handling of missing data (no empty sections)
- [ ] 11.3 Integrate context card into person profile page and tree visualization (click node → open context card)

## Task 12: Historical Record Management

- [ ] 12.1 Implement `src/lib/services/historical-record.service.ts` with createRecord (validate title, attach media assets, record audit), updateRecord, softDeleteRecord, restoreRecord, listRecordsByPerson (ordered by date desc, undated last), and getRecord functions
- [ ] 12.2 Create Route Handlers for `/api/trees/[treeId]/records` (GET list, POST create, PATCH update, DELETE soft-delete)
- [ ] 12.3 Create record form component at `src/components/historical/RecordForm.tsx` with type selector, title, description, date/date range picker, and media upload integration (up to 10 files)
- [ ] 12.4 Create record list and card components at `src/components/historical/RecordList.tsx` and `RecordCard.tsx` for displaying records on person profile page
- [ ] 12.5 Integrate historical records into person profile page showing records ordered by date with expand/collapse for descriptions

## Task 13: Media Asset Management

- [ ] 13.1 Implement `src/lib/services/media.service.ts` with uploadAsset (validate MIME type against actual content, check file size, check tree storage limit, generate UUID filename, store via storage interface, update tree totalStorageBytes, record audit), deleteAsset (soft-delete, update storage tracking), serveAsset (verify requester has tree access, stream file), and getAssetsByPerson/getAssetsByRecord functions
- [ ] 13.2 Create Route Handler `POST /api/upload` for multipart file upload with MIME validation, size checking, and storage limit enforcement
- [ ] 13.3 Create Route Handler `GET /api/media/[assetId]` for access-controlled file serving with proper Content-Type headers
- [ ] 13.4 Create PhotoUploader component at `src/components/media/PhotoUploader.tsx` with drag-and-drop, file type/size validation on client side, upload progress indicator, and error display
- [ ] 13.5 Create PhotoGallery component at `src/components/media/PhotoGallery.tsx` for displaying person photos with lightbox view and delete action

## Task 14: Person Merge (Duplicate Resolution)

- [ ] 14.1 Implement `src/lib/services/merge.service.ts` with initiateMerge (create MergeRequest with side-by-side comparison data), confirmMerge (combine relationships/records/media/tree-nodes into surviving person, soft-delete non-surviving person, update cross-tree references, notify affected tree admins, record audit), undoMerge (restore soft-deleted person, reverse reference updates within 30 days), and getMergeRequest functions
- [ ] 14.2 Create Route Handlers for `/api/trees/[treeId]/merges` (POST initiate, PATCH confirm/undo)
- [ ] 14.3 Create merge UI: side-by-side person comparison view with field-by-field selection, confirm/cancel actions; accessible from person profile page (admin-only "Merge with..." action)

## Task 15: Tree Visualization

- [ ] 15.1 Install D3.js (d3-force, d3-zoom, d3-selection) or react-force-graph-2d; create TreeGraph component at `src/components/visualization/TreeGraph.tsx` that renders persons as nodes and relationships as edges with distinct styles (solid for parent-child, dashed for spouse, dotted for sibling)
- [ ] 15.2 Implement node rendering with person name and profile photo (or default avatar), highlighted border for user's linked person node
- [ ] 15.3 Implement pan/zoom with mouse (scroll/drag) and touch (pinch-to-zoom, touch-drag) support
- [ ] 15.4 Implement "Center on me" button that programmatically pans/zooms to the user's linked person node
- [ ] 15.5 Integrate click-on-node to open Context Card as a slide-over panel
- [ ] 15.6 Create tree overview page at `src/app/(protected)/trees/[treeId]/page.tsx` that fetches persons and relationships server-side and passes data to TreeGraph client component

## Task 16: Audit Trail

- [ ] 16.1 Ensure all service functions (tree, person, relationship, historical record, media, membership, claim, merge) call audit.service.createAuditEntry for every create, update, soft-delete, restore, and merge operation
- [ ] 16.2 Create Route Handler `GET /api/trees/[treeId]/audit` (admin-only) with pagination (50 per page), ordered by timestamp descending
- [ ] 16.3 Create audit log page at `src/app/(protected)/trees/[treeId]/audit/page.tsx` (admin-only) with AuditLogTable component showing timestamp, actor, operation, entity type, and summary with pagination controls

## Task 17: Data Export

- [ ] 17.1 Implement `src/lib/services/export.service.ts` with exportTreeAsJSON function that collects all persons (with field visibility applied), relationships, historical records (without media binaries), memberships metadata, and tree metadata into a structured JSON file; enforce 30-second timeout for trees up to 500 persons
- [ ] 17.2 Create Route Handler `POST /api/trees/[treeId]/export` (admin-only) that generates the JSON export and returns it as a downloadable file with Content-Disposition header
- [ ] 17.3 Create export page at `src/app/(protected)/trees/[treeId]/export/page.tsx` (admin-only) with export button and download link

## Task 18: Account Management

- [ ] 18.1 Implement account deletion in `src/lib/services/auth.service.ts` with deleteAccount function: check for sole-admin trees (require transfer or tree deletion first), remove all memberships, unlink all linked persons, anonymize audit log entries (replace name with "Deleted User"), delete sessions, delete user record
- [ ] 18.2 Create Route Handler `DELETE /api/account` with impact summary response and confirmation flow
- [ ] 18.3 Create Route Handler `PATCH /api/account/notifications` for updating notification preferences
- [ ] 18.4 Create account settings page at `src/app/(protected)/account/page.tsx` with notification preference toggles (with mandatory trust notifications grayed out) and account deletion section with impact summary and confirmation dialog

## Task 19: Notification System Integration

- [ ] 19.1 Create all email templates in `src/lib/email/templates/`: invite, invite-accepted, claim-submitted, claim-approved, claim-rejected, membership-removed, ownership-transfer, cross-tree-edit, inactivity-warning
- [ ] 19.2 Integrate notification.service calls into all relevant service functions: invite.service (invite sent/accepted), claim.service (submitted/approved/rejected), membership.service (removed, role changed), merge.service (cross-tree notifications), person.service (cross-tree edit notifications)
- [ ] 19.3 Ensure all notification emails include: event type, actor name, tree name, timestamp, and direct link to relevant page

## Task 20: Rate Limiting Integration

- [ ] 20.1 Configure rate limiters in `src/lib/rate-limit/limiter.ts` for each endpoint category: auth (10/min/IP), invites (20/hr/user/tree), uploads (30/hr/user), search (60/min/user), claims (5/hr/user)
- [ ] 20.2 Integrate rate limiting into Next.js middleware or individual Route Handlers; return HTTP 429 with Retry-After header when limits are exceeded
- [ ] 20.3 Add rate limit error handling to client-side components: display user-friendly message with retry countdown

## Task 21: Responsive Design and Accessibility

- [ ] 21.1 Create base UI component library in `src/components/ui/` (Button, Input, Select, Textarea, Card, Modal, Badge, Avatar, Tooltip, Breadcrumbs) with responsive design and WCAG 2.1 AA compliance (color contrast, focus indicators, ARIA attributes)
- [ ] 21.2 Create responsive layout components in `src/components/layout/` (Sidebar with mobile hamburger menu, Header, MobileNav with bottom navigation) adapting from 320px to 2560px
- [ ] 21.3 Ensure all forms have proper label associations, error announcements for screen readers, and keyboard navigation support
- [ ] 21.4 Ensure tree visualization has touch support for mobile (pan, pinch-to-zoom) and keyboard accessibility for node navigation

## Task 22: Landing Page and Public Routes

- [ ] 22.1 Create landing page at `src/app/(public)/page.tsx` as a static page explaining the platform's value proposition, features, and sign-in CTA
- [ ] 22.2 Create public layout at `src/app/(public)/layout.tsx` with minimal header (logo + sign-in button)

## Task 23: Performance Optimization

- [ ] 23.1 Verify all Mongoose model indexes are created correctly and cover the query patterns defined in the design document
- [ ] 23.2 Implement MongoDB connection caching for serverless-like behavior in Next.js (reuse connection across hot reloads in development)
- [ ] 23.3 Use Next.js Server Components for all data-heavy pages (dashboard, person list, person profile, audit log, member list) to minimize client-side JS bundle
- [ ] 23.4 Add loading.tsx and error.tsx files to key route segments for proper loading states and error boundaries

## Task 24: Deployment and DevOps

- [ ] 24.1 Create optimized Dockerfile with multi-stage build (dependencies → build → production image with standalone output)
- [ ] 24.2 Create docker-compose.yml with app, mongo, and nginx services as specified in the design document
- [ ] 24.3 Create nginx.conf with HTTPS termination, proxy headers (X-Forwarded-Proto, X-Real-IP), and client_max_body_size for uploads
- [ ] 24.4 Create backup script at `scripts/backup.sh` for daily MongoDB dump and media file rsync with 7-day rotation
- [ ] 24.5 Create `.env.example` with all required environment variables documented with descriptions
