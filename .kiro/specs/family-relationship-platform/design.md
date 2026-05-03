# Technical Design Document — Family Relationship Intelligence Platform

## Overview

This document defines the technical architecture, domain model, database schema, API design, frontend architecture, and deployment strategy for the Family Relationship Intelligence Platform V1. It translates the 27 requirements into a production-grade implementation plan.

### Architecture Summary

- **Frontend + Backend**: Next.js 14+ (App Router) — Server Components for data-heavy pages, Route Handlers for API endpoints, Server Actions for mutations
- **Database**: MongoDB 7+ with Mongoose ODM
- **Authentication**: Firebase Auth (client-side Google OAuth) → server-side ID token verification → HttpOnly cookie sessions
- **File Storage**: Local filesystem (VPS) with configurable path, abstracted behind a storage interface for future S3 migration
- **Email**: Nodemailer with configurable SMTP transport (SendGrid, Mailgun, or self-hosted)
- **Visualization**: D3.js or react-force-graph for interactive tree rendering
- **Deployment**: Docker + docker-compose on VPS behind Nginx reverse proxy

---

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      Client (Browser)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐ │
│  │ Firebase Auth │  │ React Client │  │ D3.js / Graph │ │
│  │  (Google SSO) │  │  Components  │  │ Visualization │ │
│  └──────┬───────┘  └──────┬───────┘  └───────┬───────┘ │
└─────────┼─────────────────┼──────────────────┼──────────┘
          │ ID Token        │ RSC / Actions    │ Data
          ▼                 ▼                  ▼
┌─────────────────────────────────────────────────────────┐
│                   Nginx Reverse Proxy                    │
│              (HTTPS termination, static files)           │
└─────────────────────────┬───────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────┐
│                  Next.js Application                     │
│  ┌─────────────────────────────────────────────────┐    │
│  │              Middleware Layer                     │    │
│  │  - Session verification                          │    │
│  │  - Rate limiting (in-memory / Redis-ready)       │    │
│  │  - Request logging                               │    │
│  └─────────────────────┬───────────────────────────┘    │
│  ┌─────────────────────▼───────────────────────────┐    │
│  │           Application Layer                      │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │    │
│  │  │  Server   │ │  Route   │ │    Server        │ │    │
│  │  │Components │ │ Handlers │ │    Actions        │ │    │
│  │  └────┬─────┘ └────┬─────┘ └────────┬─────────┘ │    │
│  └───────┼─────────────┼───────────────┼────────────┘    │
│  ┌───────▼─────────────▼───────────────▼────────────┐    │
│  │            Service Layer                          │    │
│  │  ┌─────────┐ ┌──────────┐ ┌─────────┐ ┌───────┐ │    │
│  │  │  Auth   │ │  Tree    │ │ Person  │ │ Path  │ │    │
│  │  │ Service │ │ Service  │ │ Service │ │Finder │ │    │
│  │  └────┬────┘ └────┬─────┘ └────┬────┘ └───┬───┘ │    │
│  │  ┌────┴────┐ ┌────┴─────┐ ┌────┴────┐     │     │    │
│  │  │ Invite  │ │Membership│ │ Merge   │     │     │    │
│  │  │ Service │ │ Service  │ │ Service │     │     │    │
│  │  └─────────┘ └──────────┘ └─────────┘     │     │    │
│  └───────────────────┬───────────────────────┼──────┘    │
│  ┌───────────────────▼───────────────────────▼──────┐    │
│  │            Data Access Layer (Mongoose)           │    │
│  │  Models: User, Person, FamilyTree, TreeNode,     │    │
│  │  Relationship, Membership, Invite, ClaimRequest, │    │
│  │  MergeRequest, HistoricalRecord, MediaAsset,     │    │
│  │  AuditLog, Session                               │    │
│  └───────────────────┬──────────────────────────────┘    │
└──────────────────────┼───────────────────────────────────┘
                       │
┌──────────────────────▼───────────────────────────────────┐
│                    MongoDB 7+                             │
│  Collections: users, persons, familyTrees, treeNodes,    │
│  relationships, memberships, invites, claimRequests,     │
│  mergeRequests, historicalRecords, mediaAssets,           │
│  auditLogs, sessions                                     │
└──────────────────────────────────────────────────────────┘
```

### Key Architectural Decisions

1. **No separate Express backend in V1**: Next.js Route Handlers and Server Actions handle all API needs. The service layer is structured so extraction to Express is straightforward if needed later.
2. **Service layer pattern**: Business logic lives in `/src/services/`, not in Route Handlers or Server Actions. This keeps logic testable and portable.
3. **Mongoose over raw MongoDB driver**: Provides schema validation, middleware hooks (for soft-delete filtering), and a familiar API. The schema-per-collection approach maps well to the domain model.
4. **In-memory rate limiting with upgrade path**: V1 uses an in-memory store (e.g., `rate-limiter-flexible` with memory store). The interface supports swapping to Redis when scaling beyond a single process.
5. **BFS for path discovery**: Relationship_Path computation uses breadth-first search on the adjacency list within a single Family_Tree. For 500 persons, this completes in milliseconds.

---

## 2. Domain Model

```
┌──────────┐         ┌─────────────┐         ┌──────────┐
│   User   │────────▶│  Membership │◀────────│FamilyTree│
│          │ 1    *  │ (role,      │  *    1  │          │
│ email    │         │  userId,    │         │ name     │
│ name     │         │  treeId)    │         │ desc     │
│ photoURL │         └─────────────┘         │ createdBy│
└────┬─────┘                                  └────┬─────┘
     │                                             │
     │ 0..* Linked_Person                          │ 1..*
     ▼                                             ▼
┌──────────┐         ┌─────────────┐         ┌──────────┐
│  Person  │◀────────│  Tree_Node  │────────▶│FamilyTree│
│ (global) │ 1    *  │ (personId,  │  *    1  │          │
│          │         │  treeId,    │         │          │
│ firstName│         │  position)  │         │          │
│ lastName │         └──────┬──────┘         └──────────┘
│ dob/dod  │                │
│ privacy  │                │ participates in
└────┬─────┘                ▼
     │              ┌──────────────┐
     │ 1..*         │ Relationship │
     ▼              │ (type, label,│
┌──────────────┐    │  fromPerson, │
│Historical    │    │  toPerson,   │
│Record        │    │  treeId)     │
│ (personId,   │    └──────────────┘
│  type, title,│
│  date)       │
└──────┬───────┘
       │ 0..*
       ▼
┌──────────────┐
│ Media_Asset  │
│ (filename,   │
│  mimeType,   │
│  size, path) │
└──────────────┘
```

### Entity Relationships Summary

| From | To | Cardinality | Notes |
|------|-----|-------------|-------|
| User | Membership | 1:N | A user can be member of many trees |
| FamilyTree | Membership | 1:N | A tree has many members |
| Person | TreeNode | 1:N | Same person in multiple trees |
| FamilyTree | TreeNode | 1:N | A tree has many person nodes |
| Person | Relationship | N:M | Via fromPersonId/toPersonId within a tree |
| Person | HistoricalRecord | 1:N | Records attached to a person |
| HistoricalRecord | MediaAsset | 1:N | Files attached to records |
| Person | MediaAsset | 1:N | Photos attached to person profile |
| User | Person | 0..N:0..1 | Linked_Person (one per tree, stored on TreeNode) |

---

## 3. Database Schema (MongoDB + Mongoose)

### 3.1 User Collection

```javascript
const UserSchema = new Schema({
  firebaseUid: { type: String, required: true, unique: true, index: true },
  email: { type: String, required: true, unique: true, index: true },
  displayName: { type: String, required: true },
  photoURL: { type: String },
  lastLoginAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  // Soft delete
  deletedAt: { type: Date, default: null },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  // Notification preferences
  notificationPreferences: {
    invites: { type: Boolean, default: true },
    claims: { type: Boolean, default: true },       // Cannot be disabled
    membershipChanges: { type: Boolean, default: true }, // Cannot be disabled
    treeUpdates: { type: Boolean, default: true },
    crossTreeEdits: { type: Boolean, default: true },
  }
});
// Indexes: { firebaseUid: 1 }, { email: 1 }
```

### 3.2 Session Collection

```javascript
const SessionSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  token: { type: String, required: true, unique: true, index: true },
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
  createdAt: { type: Date, default: Date.now },
  userAgent: { type: String },
  ipAddress: { type: String },
});
// TTL index on expiresAt for automatic cleanup
// Indexes: { token: 1 }, { userId: 1 }
```

### 3.3 FamilyTree Collection

```javascript
const FamilyTreeSchema = new Schema({
  name: { type: String, required: true, maxlength: 100 },
  description: { type: String, maxlength: 500 },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  // Soft delete
  deletedAt: { type: Date, default: null },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  // Storage tracking
  totalStorageBytes: { type: Number, default: 0 },
  storageLimit: { type: Number, default: 524288000 }, // 500 MB
});
// Compound index: { createdBy: 1, name: 1 } for unique name per creator
// Index: { deletedAt: 1 } for filtering active trees
```

### 3.4 Membership Collection

```javascript
const MembershipSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  treeId: { type: Schema.Types.ObjectId, ref: 'FamilyTree', required: true },
  role: { type: String, enum: ['admin', 'editor', 'viewer'], required: true },
  joinedAt: { type: Date, default: Date.now },
  invitedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  // Soft delete
  deletedAt: { type: Date, default: null },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
});
// Compound unique index: { userId: 1, treeId: 1, deletedAt: 1 }
// Index: { treeId: 1, role: 1 } for finding admins of a tree
// Index: { userId: 1, deletedAt: 1 } for finding user's active memberships
```

### 3.5 Person Collection

```javascript
const PersonSchema = new Schema({
  firstName: { type: String, required: true, maxlength: 100 },
  lastName: { type: String, maxlength: 100 },
  maidenName: { type: String, maxlength: 100 },
  dateOfBirth: { type: Date },
  dateOfDeath: { type: Date },
  gender: { type: String, enum: ['male', 'female', 'other', 'prefer_not_to_say'] },
  profession: { type: String, maxlength: 200 },
  location: {
    city: { type: String, maxlength: 100 },
    country: { type: String, maxlength: 100 },
  },
  phoneNumber: { type: String, maxlength: 30 },
  email: { type: String, maxlength: 200 },
  biography: { type: String, maxlength: 2000 },
  profilePhotoId: { type: Schema.Types.ObjectId, ref: 'MediaAsset' },
  // Field-level privacy
  fieldVisibility: {
    dateOfBirth: { type: String, enum: ['all_members', 'admins_only', 'owner_and_admins'], default: 'all_members' },
    phoneNumber: { type: String, enum: ['all_members', 'admins_only', 'owner_and_admins'], default: 'all_members' },
    email: { type: String, enum: ['all_members', 'admins_only', 'owner_and_admins'], default: 'all_members' },
    biography: { type: String, enum: ['all_members', 'admins_only', 'owner_and_admins'], default: 'all_members' },
  },
  // Metadata
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  // Soft delete
  deletedAt: { type: Date, default: null },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
});
// Text index: { firstName: 'text', lastName: 'text', maidenName: 'text' }
// Index: { email: 1 }, { deletedAt: 1 }
// Index: { 'location.city': 1, 'location.country': 1 }
```

### 3.6 TreeNode Collection

```javascript
const TreeNodeSchema = new Schema({
  personId: { type: Schema.Types.ObjectId, ref: 'Person', required: true },
  treeId: { type: Schema.Types.ObjectId, ref: 'FamilyTree', required: true },
  // Linked user (claim verified)
  linkedUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  // Display metadata (for visualization positioning)
  displayPosition: {
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 },
  },
  // Metadata
  addedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  addedAt: { type: Date, default: Date.now },
  // Soft delete
  deletedAt: { type: Date, default: null },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
});
// Compound unique index: { personId: 1, treeId: 1, deletedAt: 1 }
// Index: { treeId: 1, deletedAt: 1 } for listing persons in a tree
// Index: { personId: 1, deletedAt: 1 } for finding which trees reference a person
// Index: { linkedUserId: 1, treeId: 1 } for finding user's linked person in a tree
```

### 3.7 Relationship Collection

```javascript
const RelationshipSchema = new Schema({
  treeId: { type: Schema.Types.ObjectId, ref: 'FamilyTree', required: true },
  fromPersonId: { type: Schema.Types.ObjectId, ref: 'Person', required: true },
  toPersonId: { type: Schema.Types.ObjectId, ref: 'Person', required: true },
  type: { type: String, enum: ['parent_child', 'spouse', 'sibling'], required: true },
  direction: { type: String, enum: ['forward', 'inverse'], required: true },
  // forward: fromPerson is the parent/initiator
  // inverse: auto-created reverse link
  label: { type: String, maxlength: 50 }, // e.g., "biological", "adoptive", "step"
  // Metadata
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  // Soft delete
  deletedAt: { type: Date, default: null },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
});
// Compound index: { treeId: 1, fromPersonId: 1, deletedAt: 1 } for adjacency list queries
// Compound index: { treeId: 1, toPersonId: 1, deletedAt: 1 } for reverse lookups
// Compound unique: { treeId: 1, fromPersonId: 1, toPersonId: 1, type: 1, deletedAt: 1 }
```

### 3.8 Invite Collection

```javascript
const InviteSchema = new Schema({
  treeId: { type: Schema.Types.ObjectId, ref: 'FamilyTree', required: true },
  email: { type: String, required: true },
  role: { type: String, enum: ['admin', 'editor', 'viewer'], required: true },
  token: { type: String, required: true, unique: true, index: true },
  invitedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['pending', 'accepted', 'expired', 'revoked'], default: 'pending' },
  expiresAt: { type: Date, required: true },
  acceptedAt: { type: Date },
  acceptedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
});
// Indexes: { token: 1 }, { treeId: 1, email: 1 }, { expiresAt: 1 }
```

### 3.9 ClaimRequest Collection

```javascript
const ClaimRequestSchema = new Schema({
  treeId: { type: Schema.Types.ObjectId, ref: 'FamilyTree', required: true },
  personId: { type: Schema.Types.ObjectId, ref: 'Person', required: true },
  claimantUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: { type: Date },
  rejectionReason: { type: String, maxlength: 500 },
  createdAt: { type: Date, default: Date.now },
});
// Indexes: { treeId: 1, status: 1 }, { claimantUserId: 1 }
// Compound: { treeId: 1, personId: 1, claimantUserId: 1 }
```

### 3.10 MergeRequest Collection

```javascript
const MergeRequestSchema = new Schema({
  treeId: { type: Schema.Types.ObjectId, ref: 'FamilyTree', required: true },
  sourcePersonId: { type: Schema.Types.ObjectId, ref: 'Person', required: true },
  targetPersonId: { type: Schema.Types.ObjectId, ref: 'Person', required: true },
  fieldResolutions: { type: Schema.Types.Mixed }, // { fieldName: 'source' | 'target' }
  status: { type: String, enum: ['pending', 'confirmed', 'undone'], default: 'pending' },
  initiatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  confirmedAt: { type: Date },
  undoneAt: { type: Date },
  undoneBy: { type: Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
});
// Indexes: { treeId: 1, status: 1 }
```

### 3.11 HistoricalRecord Collection

```javascript
const HistoricalRecordSchema = new Schema({
  personId: { type: Schema.Types.ObjectId, ref: 'Person', required: true },
  treeId: { type: Schema.Types.ObjectId, ref: 'FamilyTree', required: true },
  type: { type: String, enum: ['life_event', 'story', 'migration', 'document', 'note', 'custom'], required: true },
  title: { type: String, required: true, maxlength: 200 },
  description: { type: String, maxlength: 5000 },
  date: { type: Date },
  endDate: { type: Date }, // For date ranges
  mediaAssetIds: [{ type: Schema.Types.ObjectId, ref: 'MediaAsset' }],
  // Metadata
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  // Soft delete
  deletedAt: { type: Date, default: null },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
});
// Indexes: { personId: 1, deletedAt: 1, date: -1 }
// Index: { treeId: 1, deletedAt: 1 }
```

### 3.12 MediaAsset Collection

```javascript
const MediaAssetSchema = new Schema({
  filename: { type: String, required: true }, // Original filename
  storagePath: { type: String, required: true }, // Path on disk / object storage key
  storageFilename: { type: String, required: true }, // UUID-based non-guessable name
  mimeType: { type: String, required: true },
  sizeBytes: { type: Number, required: true },
  // Association (one of these will be set)
  personId: { type: Schema.Types.ObjectId, ref: 'Person' },
  historicalRecordId: { type: Schema.Types.ObjectId, ref: 'HistoricalRecord' },
  treeId: { type: Schema.Types.ObjectId, ref: 'FamilyTree', required: true }, // Always set for storage tracking
  // Metadata
  uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  uploadedAt: { type: Date, default: Date.now },
  // Soft delete
  deletedAt: { type: Date, default: null },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
});
// Indexes: { personId: 1, deletedAt: 1 }, { historicalRecordId: 1, deletedAt: 1 }
// Index: { treeId: 1, deletedAt: 1 } for storage calculation
// Index: { storageFilename: 1 } for serving files
```

### 3.13 AuditLog Collection

```javascript
const AuditLogSchema = new Schema({
  treeId: { type: Schema.Types.ObjectId, ref: 'FamilyTree', required: true },
  actorUserId: { type: Schema.Types.ObjectId, ref: 'User' }, // null for system actions
  actorDisplayName: { type: String }, // Denormalized for when user is deleted
  operation: { type: String, enum: ['create', 'update', 'soft_delete', 'restore', 'merge', 'permanent_delete'], required: true },
  entityType: { type: String, enum: ['person', 'relationship', 'historical_record', 'media_asset', 'membership', 'claim_request', 'merge_request', 'family_tree'], required: true },
  entityId: { type: Schema.Types.ObjectId, required: true },
  summary: { type: String, required: true, maxlength: 500 },
  changes: { type: Schema.Types.Mixed }, // { field: { old: value, new: value } }
  timestamp: { type: Date, default: Date.now },
});
// Index: { treeId: 1, timestamp: -1 } for paginated audit log viewing
// Index: { entityType: 1, entityId: 1 } for entity history
// TTL index: { timestamp: 1 }, expireAfterSeconds: 31536000 (1 year)
```

### Database Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Person is a separate collection from TreeNode** | Core architectural requirement. A Person is a global entity; TreeNode is the join table between Person and FamilyTree. This enables cross-tree identity without duplication. |
| **Relationships are scoped to a tree** | Two trees can have different relationship structures for the same persons. Relationships are tree-specific, not global. |
| **Soft delete via `deletedAt` field** | All major entities use soft delete. Mongoose middleware filters `deletedAt: null` by default. 30-day retention before permanent purge. |
| **Denormalized `actorDisplayName` in AuditLog** | When a user deletes their account, audit logs must survive. The display name is captured at write time. |
| **TTL index on sessions** | MongoDB automatically cleans up expired sessions. No cron job needed. |
| **Storage tracking on FamilyTree** | `totalStorageBytes` is updated atomically on upload/delete to enforce the 500MB limit without scanning all media assets. |
| **Compound indexes on (treeId, deletedAt)** | Most queries are scoped to a tree and filter out soft-deleted records. This compound index serves both needs efficiently. |

---

## 4. API Design

### 4.1 Route Structure

All API routes live under `/api/` as Next.js Route Handlers. Server Actions are used for form mutations in Server Components.

```
/api/auth/
  POST /api/auth/signin          — Verify Firebase ID token, create session
  POST /api/auth/signout         — Invalidate session, clear cookie
  GET  /api/auth/me              — Get current user profile

/api/trees/
  GET    /api/trees              — List user's family trees
  POST   /api/trees              — Create family tree
  GET    /api/trees/[treeId]     — Get tree details
  PATCH  /api/trees/[treeId]     — Update tree settings
  DELETE /api/trees/[treeId]     — Soft-delete tree
  POST   /api/trees/[treeId]/restore — Restore soft-deleted tree
  POST   /api/trees/[treeId]/export  — Generate JSON export

/api/trees/[treeId]/members/
  GET    /api/trees/[treeId]/members           — List members
  PATCH  /api/trees/[treeId]/members/[userId]  — Change role
  DELETE /api/trees/[treeId]/members/[userId]  — Remove member
  POST   /api/trees/[treeId]/transfer          — Initiate ownership transfer

/api/trees/[treeId]/invites/
  POST   /api/trees/[treeId]/invites           — Create invite
  GET    /api/trees/[treeId]/invites           — List pending invites
  DELETE /api/trees/[treeId]/invites/[inviteId] — Revoke invite

/api/invites/[token]/accept
  POST   /api/invites/[token]/accept           — Accept invite (no tree context needed)

/api/trees/[treeId]/persons/
  GET    /api/trees/[treeId]/persons           — List persons in tree
  POST   /api/trees/[treeId]/persons           — Add person (create new or link existing)
  GET    /api/trees/[treeId]/persons/[personId] — Get person profile (with field visibility)
  PATCH  /api/trees/[treeId]/persons/[personId] — Update person profile
  DELETE /api/trees/[treeId]/persons/[personId] — Soft-delete person from tree
  POST   /api/trees/[treeId]/persons/[personId]/restore — Restore person
  GET    /api/trees/[treeId]/persons/[personId]/context — Get context card data
  GET    /api/trees/[treeId]/persons/[personId]/path    — Get relationship path from user's linked person

/api/trees/[treeId]/relationships/
  GET    /api/trees/[treeId]/relationships              — List relationships
  POST   /api/trees/[treeId]/relationships              — Create relationship
  PATCH  /api/trees/[treeId]/relationships/[relId]      — Update relationship (label)
  DELETE /api/trees/[treeId]/relationships/[relId]      — Soft-delete relationship

/api/trees/[treeId]/claims/
  POST   /api/trees/[treeId]/claims                     — Submit claim request
  GET    /api/trees/[treeId]/claims                     — List claim requests (admin)
  PATCH  /api/trees/[treeId]/claims/[claimId]           — Approve/reject claim

/api/trees/[treeId]/merges/
  POST   /api/trees/[treeId]/merges                     — Initiate merge request
  PATCH  /api/trees/[treeId]/merges/[mergeId]           — Confirm/undo merge

/api/trees/[treeId]/records/
  GET    /api/trees/[treeId]/records                    — List historical records
  POST   /api/trees/[treeId]/records                    — Create historical record
  PATCH  /api/trees/[treeId]/records/[recordId]         — Update record
  DELETE /api/trees/[treeId]/records/[recordId]         — Soft-delete record

/api/trees/[treeId]/audit/
  GET    /api/trees/[treeId]/audit                      — Get audit log (admin, paginated)

/api/upload/
  POST   /api/upload                                    — Upload media asset (multipart)

/api/media/[assetId]
  GET    /api/media/[assetId]                           — Serve media file (access-controlled)

/api/search/
  GET    /api/search/persons?q=...                      — Search persons across accessible trees

/api/account/
  DELETE /api/account                                   — Delete user account
  PATCH  /api/account/notifications                     — Update notification preferences
```

### 4.2 Server Actions vs Route Handlers

| Use Case | Approach | Rationale |
|----------|----------|-----------|
| Form submissions (create tree, add person, create relationship) | Server Actions | Progressive enhancement, works without JS, integrated with React form state |
| Data fetching for Server Components | Direct service calls | No HTTP overhead, runs on server |
| File uploads | Route Handler (POST /api/upload) | Multipart form data handling, streaming |
| Media serving | Route Handler (GET /api/media/[assetId]) | Streaming response, access control headers |
| Search | Route Handler (GET /api/search/persons) | Client-side debounced requests |
| Export | Route Handler (POST /api/trees/[treeId]/export) | Long-running, returns file download |
| External integrations (future) | Route Handlers | Standard REST API surface |

### 4.3 Authentication Flow

```
1. Client: Firebase signInWithPopup(GoogleAuthProvider)
2. Client: Gets Firebase ID token
3. Client: POST /api/auth/signin { idToken }
4. Server: Verify ID token with Firebase Admin SDK
5. Server: Find or create User in MongoDB
6. Server: Create Session record with crypto.randomUUID() token
7. Server: Set HttpOnly cookie: session_token=<token>; Secure; SameSite=Strict; Path=/; Max-Age=604800
8. Client: Redirect to /dashboard
```

### 4.4 Authorization Middleware Pattern

```typescript
// Every tree-scoped route handler follows this pattern:
async function handler(req, { params }) {
  const session = await getSession(req);        // Verify cookie, get user
  if (!session) return redirect('/auth/signin');

  const membership = await getMembership(session.userId, params.treeId);
  if (!membership) return notFound();           // 404, not 403 (don't leak tree existence)

  // Role check
  if (requiredRole === 'admin' && membership.role !== 'admin') {
    return forbidden();
  }

  // Proceed with business logic via service layer
}
```

### 4.5 Validation Strategy

- **Client-side**: Zod schemas shared between client and server for immediate feedback
- **Server-side**: Same Zod schemas validated in Route Handlers / Server Actions before service calls
- **Mongoose-level**: Schema validation as a safety net (maxlength, enum, required)
- **Shared schemas**: `/src/lib/validations/` contains Zod schemas imported by both client and server

### 4.6 Error Handling Strategy

```typescript
// Standardized error response format
interface ApiError {
  error: {
    code: string;        // Machine-readable: 'TREE_LIMIT_REACHED', 'INVALID_INPUT'
    message: string;     // Human-readable
    field?: string;      // For validation errors
    details?: unknown;   // Additional context
  };
}

// HTTP status mapping:
// 400 - Validation errors, business rule violations
// 401 - Not authenticated
// 403 - Not authorized (insufficient role)
// 404 - Entity not found (or no access — don't leak existence)
// 409 - Conflict (duplicate relationship, already claimed)
// 429 - Rate limited
// 500 - Unexpected server error (generic message to client, detailed log on server)
```

---

## 5. Frontend Architecture

### 5.1 Folder Structure

```
src/
├── app/                          # Next.js App Router
│   ├── (public)/                 # Public route group (no auth required)
│   │   ├── page.tsx              # Landing page
│   │   └── auth/
│   │       └── signin/
│   │           └── page.tsx      # Sign-in page
│   ├── (protected)/              # Protected route group (auth required)
│   │   ├── layout.tsx            # Auth-checking layout, sidebar, navigation
│   │   ├── dashboard/
│   │   │   └── page.tsx          # User's tree list, recent activity
│   │   ├── trees/
│   │   │   ├── new/
│   │   │   │   └── page.tsx      # Create tree form
│   │   │   └── [treeId]/
│   │   │       ├── layout.tsx    # Tree-scoped layout, membership check
│   │   │       ├── page.tsx      # Tree overview / visualization
│   │   │       ├── persons/
│   │   │       │   ├── page.tsx  # Person list
│   │   │       │   ├── new/
│   │   │       │   │   └── page.tsx
│   │   │       │   └── [personId]/
│   │   │       │       └── page.tsx  # Person profile + context card
│   │   │       ├── relationships/
│   │   │       │   └── page.tsx  # Relationship management
│   │   │       ├── members/
│   │   │       │   └── page.tsx  # Member management (admin)
│   │   │       ├── claims/
│   │   │       │   └── page.tsx  # Claim requests (admin)
│   │   │       ├── audit/
│   │   │       │   └── page.tsx  # Audit log (admin)
│   │   │       ├── settings/
│   │   │       │   └── page.tsx  # Tree settings (admin)
│   │   │       └── export/
│   │   │           └── page.tsx  # Data export (admin)
│   │   ├── account/
│   │   │   └── page.tsx          # Account settings, notification prefs, delete
│   │   └── invite/
│   │       └── [token]/
│   │           └── page.tsx      # Accept invite flow
│   └── api/                      # Route Handlers (see API Design)
│       ├── auth/
│       ├── trees/
│       ├── upload/
│       ├── media/
│       ├── search/
│       └── account/
├── components/
│   ├── ui/                       # Primitive UI components (Button, Input, Card, Modal, etc.)
│   ├── auth/                     # GoogleSignInButton, AuthProvider
│   ├── tree/                     # TreeCard, TreeList, TreeSettings
│   ├── person/                   # PersonCard, PersonForm, PersonProfile, ContextCard
│   ├── relationship/             # RelationshipForm, RelationshipList, PathDisplay
│   ├── visualization/            # TreeGraph, GraphNode, GraphEdge
│   ├── member/                   # MemberList, InviteForm, RoleSelector
│   ├── historical/               # RecordForm, RecordList, RecordCard
│   ├── media/                    # PhotoUploader, PhotoGallery, MediaViewer
│   ├── search/                   # SearchBar, SearchResults
│   ├── audit/                    # AuditLogTable, AuditEntry
│   └── layout/                   # Sidebar, Header, MobileNav, Breadcrumbs
├── lib/
│   ├── db/                       # Mongoose connection, models
│   │   ├── connection.ts         # Singleton connection with caching
│   │   └── models/               # All Mongoose model definitions
│   ├── auth/
│   │   ├── firebase-admin.ts     # Firebase Admin SDK initialization
│   │   ├── firebase-client.ts    # Firebase client SDK initialization
│   │   ├── session.ts            # Session creation, verification, refresh
│   │   └── middleware.ts         # Auth middleware for route protection
│   ├── services/                 # Business logic layer
│   │   ├── auth.service.ts
│   │   ├── tree.service.ts
│   │   ├── person.service.ts
│   │   ├── relationship.service.ts
│   │   ├── membership.service.ts
│   │   ├── invite.service.ts
│   │   ├── claim.service.ts
│   │   ├── merge.service.ts
│   │   ├── historical-record.service.ts
│   │   ├── media.service.ts
│   │   ├── search.service.ts
│   │   ├── audit.service.ts
│   │   ├── notification.service.ts
│   │   ├── path-finder.service.ts
│   │   └── export.service.ts
│   ├── validations/              # Shared Zod schemas
│   │   ├── tree.schema.ts
│   │   ├── person.schema.ts
│   │   ├── relationship.schema.ts
│   │   └── ...
│   ├── email/                    # Email templates and sending
│   │   ├── transporter.ts        # Nodemailer setup
│   │   └── templates/
│   ├── storage/                  # File storage abstraction
│   │   ├── storage.interface.ts
│   │   └── local-storage.ts
│   ├── rate-limit/               # Rate limiting
│   │   └── limiter.ts
│   └── utils/                    # Shared utilities
│       ├── errors.ts             # Custom error classes
│       ├── sanitize.ts           # XSS sanitization
│       └── constants.ts
├── hooks/                        # Client-side React hooks
│   ├── useAuth.ts
│   ├── useSearch.ts
│   └── useTreeGraph.ts
├── types/                        # TypeScript type definitions
│   └── index.ts
└── middleware.ts                  # Next.js middleware (session check, rate limiting)
```

### 5.2 Rendering Strategy

| Page | Rendering | Rationale |
|------|-----------|-----------|
| Landing page | Static (SSG) | No dynamic data, maximum performance |
| Sign-in page | Static (SSG) | Firebase client-side auth, no server data |
| Dashboard | Server Component (SSR) | Fetches user's trees, needs fresh data |
| Tree overview / visualization | Server Component + Client Component | Server fetches data, client renders D3 graph |
| Person profile | Server Component | Data-heavy, benefits from server rendering |
| Context card | Server Component | Quick render with pre-fetched data |
| Person form (add/edit) | Client Component | Interactive form with validation |
| Relationship form | Client Component | Interactive dropdowns and validation |
| Search | Client Component | Debounced input, dynamic results |
| Member management | Server Component | Admin-only, data listing |
| Audit log | Server Component | Paginated data listing |

### 5.3 State Management

- **Server state**: Handled by Server Components fetching directly from services. No client-side data fetching library needed for most pages.
- **Client state**: React `useState` / `useReducer` for form state, modals, and UI interactions.
- **Search state**: Custom `useSearch` hook with debouncing, calling `/api/search/persons`.
- **Graph state**: Custom `useTreeGraph` hook managing D3 force simulation state.
- **No global state library**: The App Router's Server Component model eliminates the need for Redux/Zustand for data fetching. If complex client state emerges, Zustand can be added later.

### 5.4 Graph Visualization Strategy

- **Library**: `d3-force` for layout computation + React SVG rendering (or `react-force-graph-2d` for faster setup)
- **Data flow**: Server Component fetches persons + relationships → serializes as adjacency list → passes to client `TreeGraph` component
- **Interaction**: Click node → open Context Card (slide-over panel). Hover → show name tooltip.
- **Performance**: For trees up to 500 nodes, D3 force simulation runs in <1 second. Nodes are rendered as SVG circles with embedded images.
- **Mobile**: Touch events for pan/zoom via D3's zoom behavior. Pinch-to-zoom supported natively.
- **"Center on me"**: Programmatic zoom/pan to the user's Linked_Person node coordinates.

---

## 6. Deployment Architecture

### 6.1 Docker Setup

```yaml
# docker-compose.yml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - MONGODB_URI=mongodb://mongo:27017/family-platform
      - SESSION_SECRET=${SESSION_SECRET}
      - FIREBASE_PROJECT_ID=${FIREBASE_PROJECT_ID}
      - FIREBASE_CLIENT_EMAIL=${FIREBASE_CLIENT_EMAIL}
      - FIREBASE_PRIVATE_KEY=${FIREBASE_PRIVATE_KEY}
      - NEXT_PUBLIC_FIREBASE_API_KEY=${NEXT_PUBLIC_FIREBASE_API_KEY}
      - NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=${NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN}
      - NEXT_PUBLIC_FIREBASE_PROJECT_ID=${NEXT_PUBLIC_FIREBASE_PROJECT_ID}
      - SMTP_HOST=${SMTP_HOST}
      - SMTP_PORT=${SMTP_PORT}
      - SMTP_USER=${SMTP_USER}
      - SMTP_PASS=${SMTP_PASS}
      - STORAGE_PATH=/data/uploads
      - BASE_URL=${BASE_URL}
    volumes:
      - uploads:/data/uploads
    depends_on:
      - mongo
    restart: unless-stopped

  mongo:
    image: mongo:7
    volumes:
      - mongodb_data:/data/db
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./certs:/etc/nginx/certs
    depends_on:
      - app
    restart: unless-stopped

volumes:
  mongodb_data:
  uploads:
```

### 6.2 Nginx Configuration (Key Parts)

```nginx
server {
    listen 443 ssl;
    server_name yourdomain.com;

    ssl_certificate /etc/nginx/certs/fullchain.pem;
    ssl_certificate_key /etc/nginx/certs/privkey.pem;

    client_max_body_size 10M;

    location / {
        proxy_pass http://app:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 6.3 Backup Strategy

- **MongoDB**: Daily `mongodump` via cron to a backup volume, with 7-day rotation
- **Media files**: Daily rsync of the uploads volume to a backup location
- **Automated**: A backup script in `/scripts/backup.sh` included in the repo

---

## 7. Correctness Properties and Testing Strategy

### 7.1 Property-Based Testing Candidates

| Property | Type | Requirement |
|----------|------|-------------|
| Relationship inverse consistency | Invariant | Req 11: Creating a parent-child relationship always creates the inverse. Soft-deleting one always soft-deletes the other. |
| Soft-delete filtering | Invariant | All queries: Soft-deleted entities never appear in normal query results. |
| Session round-trip | Round-trip | Req 1-2: Create session → verify session → get same user identity |
| Field visibility filtering | Metamorphic | Req 8: A Viewer sees fewer or equal fields compared to an Admin for the same Person |
| BFS path discovery | Model-based | Req 14: BFS result matches a naive DFS path finder for correctness (both find shortest path) |
| Relationship conflict detection | Invariant | Req 12: A person with >2 parent-child (as child) or >1 active spouse always has conflict flag |
| Merge preserves all relationships | Invariant | Req 13: After merge, surviving person has union of both persons' relationships |
| Rate limit enforcement | Idempotence | Req 3: N+1th request within window returns 429 regardless of request content |
| Tree always has at least one admin | Invariant | Req 5, 8: No operation can result in a tree with zero admins |
| Storage limit enforcement | Metamorphic | Req 18: Total storage after upload ≤ 500MB limit. Upload that would exceed limit is rejected. |

### 7.2 Integration Testing Focus

- Authentication flow end-to-end (Firebase mock → session → protected route)
- Invite flow (create → email → accept → membership created)
- Claim flow (request → admin notification → approve → linked person set)
- Cross-tree person edit propagation
- Account deletion cascade behavior
- Export file completeness

---

## 8. V1 → V2 → V3 Roadmap

### V1 (Current Scope)
- Core authentication and session management
- Family tree CRUD with soft delete
- Collaboration with RBAC (Admin/Editor/Viewer)
- Person management with rich profiles and field-level privacy
- Manual relationship linking (parent-child, spouse, sibling)
- Relationship path discovery (BFS)
- Context cards for gatherings
- Tree visualization (D3 force graph)
- Claim verification workflow
- Person merge (manual, admin-only)
- Relationship conflict resolution
- Admin succession and ownership transfer
- Notification system (email)
- Audit trail
- Data export (JSON)
- Search across accessible trees
- Account deletion
- Rate limiting
- VPS deployment with Docker

### V2 (Planned)
- Automatic relationship inference engine ("uncle", "cousin", "mother-in-law")
- Cultural naming conventions ("What should I call them?")
- GEDCOM import/export
- In-app notification center
- Real-time collaboration (WebSocket/SSE)
- Advanced search with filters
- Timeline view for historical records
- PDF family summary export
- Media gallery with tagging
- Mobile-optimized gathering mode

### V3 (Future)
- AI-powered duplicate detection suggestions
- Family event planning integration
- Multi-language support (i18n)
- Public/discoverable family trees (opt-in)
- Family DNA integration
- Advanced analytics (family statistics, migration maps)
- API for third-party integrations
- Progressive Web App (PWA) with offline support
