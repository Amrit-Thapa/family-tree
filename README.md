# Family Relationship Intelligence Platform

A full-stack web application for building, managing, and exploring family trees with collaborative features, relationship path discovery, and rich person profiles.

Built with **Next.js 16** (App Router), **MongoDB** (Mongoose), **Firebase Auth** (Google OAuth), and **Tailwind CSS**.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Server Components, Server Actions) |
| Language | TypeScript 5 |
| Database | MongoDB 7+ with Mongoose 9 ODM |
| Authentication | Firebase Auth (Google OAuth) + server-side sessions |
| Validation | Zod 4 |
| Styling | Tailwind CSS 4 |
| Testing | Vitest 4 |
| Sanitization | isomorphic-dompurify |

## Getting Started

### Prerequisites

- Node.js 20+
- MongoDB 7+ (local or Atlas)
- Firebase project with Google sign-in enabled

### Environment Variables

Create a `.env` file at the project root with the following variables:

```env
# MongoDB
MONGODB_URI=mongodb://localhost:27017/family-tree

# Firebase Admin SDK
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-client-email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Firebase Client SDK (public)
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Testing

```bash
# Single run
npm test

# Watch mode
npm run test:watch

# Specific file
npx vitest run path/to/file.test.ts

# Verbose output
npx vitest run --reporter=verbose
```

### Build

```bash
npm run build
npm start
```

## Architecture

### Project Structure

```
src/
├── app/                          # Next.js App Router
│   ├── (public)/                 # Public routes (no auth required)
│   │   ├── auth/signin/          # Sign-in page
│   │   └── page.tsx              # Landing page
│   ├── (protected)/              # Protected routes (auth required)
│   │   ├── layout.tsx            # Session verification + sidebar
│   │   ├── dashboard/            # User's tree list
│   │   ├── invite/[token]/       # Invite acceptance page
│   │   └── trees/
│   │       ├── new/              # Create tree form
│   │       └── [treeId]/         # Tree-scoped pages
│   │           ├── layout.tsx    # Membership verification
│   │           ├── members/      # Member management (admin)
│   │           └── settings/     # Tree settings (admin)
│   ├── actions/                  # Server Actions
│   └── api/                      # Route Handlers (REST API)
├── components/                   # React components
│   ├── auth/                     # Auth-related components
│   ├── layout/                   # Layout components (sidebar, nav)
│   └── tree/                     # Tree context provider
└── lib/
    ├── auth/                     # Session management, Firebase Admin
    ├── constants/                # App constants
    ├── db/
    │   ├── connection.ts         # MongoDB singleton connection
    │   └── models/               # Mongoose models
    ├── services/                 # Business logic layer
    ├── types/                    # TypeScript type definitions
    ├── utils/                    # Utilities (errors, sanitize, etc.)
    └── validations/              # Shared Zod schemas
```

### Service Layer Pattern

Business logic lives in `src/lib/services/`, not in Route Handlers or Server Actions. This keeps logic testable and portable:

- `auth.service.ts` — Sign-in, sign-out, current user
- `tree.service.ts` — CRUD, soft-delete, restore
- `membership.service.ts` — Role changes, member removal, last-admin protection
- `invite.service.ts` — Link generation, acceptance, revocation
- `graph.service.ts` — Graph data fetching (nodes + relationships)
- `person.service.ts` — Create, update, delete profile-only person nodes
- `relationship.service.ts` — Create and soft-delete relationships

## Authentication Flow

The platform uses Firebase Auth for client-side Google OAuth, combined with server-side session management via HttpOnly cookies.

### Sign-In Flow

```
1. User clicks "Sign in with Google"
2. Firebase signInWithPopup(GoogleAuthProvider) opens Google OAuth
3. Client receives Firebase ID token
4. Client POSTs ID token to /api/auth/signin
5. Server verifies token with Firebase Admin SDK
6. Server finds or creates User in MongoDB
7. Server creates Session record with crypto.randomUUID() token
8. Server sets HttpOnly cookie: session_token=<token>; Secure; SameSite=Strict
9. Client redirects to /dashboard (or callbackUrl)
```

### Session Management

| Aspect | Detail |
|--------|--------|
| Storage | MongoDB `sessions` collection with TTL index |
| Transport | HttpOnly, Secure, SameSite=Strict cookie |
| Duration | 7 days |
| Refresh | Auto-extended when within 24 hours of expiry |
| Invalidation | Deleted from DB + cookie cleared on sign-out |

### Callback URL (Post-Login Redirect)

When an unauthenticated user visits a protected route, they are redirected to `/auth/signin?callbackUrl=<encoded-path>`. After successful authentication, they are returned to their original destination. The `callbackUrl` is validated to only accept relative paths (preventing open redirect attacks).

### Route Protection

- **Middleware** (`src/middleware.ts`): Sets `x-pathname` header on all requests for server components to read the current path.
- **Protected Layout** (`src/app/(protected)/layout.tsx`): Verifies the session server-side. Redirects to sign-in with `callbackUrl` if invalid.
- **Tree Layout** (`src/app/(protected)/trees/[treeId]/layout.tsx`): Verifies tree membership. Returns 404 (not 403) to avoid leaking tree existence.

## Authorization Model

### Roles

| Role | Permissions |
|------|------------|
| **Admin** | Full control: manage members, invites, settings, delete tree |
| **Editor** | Add/edit persons, relationships, historical records |
| **Viewer** | Read-only access to tree data |

### Key Protections

- **Last-admin protection**: Cannot demote or remove the last remaining admin of a tree.
- **Self-removal prevention**: Admins cannot remove themselves via the member management UI.
- **Tree existence hiding**: Unauthorized users receive 404 (not 403) to prevent tree enumeration.

## Invite System

Admins can generate shareable invite links for their trees:

- Links contain a cryptographically random token
- Configurable: role, expiry (1–30 days), max uses (1–100), optional label
- Atomic acceptance prevents race conditions on usage limits
- Links can be revoked at any time by admins

**Invite URL format**: `{APP_URL}/invite/{token}`

## API Endpoints

### Authentication

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/signin` | Verify Firebase token, create session |
| POST | `/api/auth/signout` | Invalidate session, clear cookie |
| GET | `/api/auth/me` | Get current user profile |

### Trees

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/trees` | List user's trees |
| POST | `/api/trees` | Create tree |
| GET | `/api/trees/[treeId]` | Get tree details |
| PATCH | `/api/trees/[treeId]` | Update tree (admin) |
| DELETE | `/api/trees/[treeId]` | Soft-delete tree (sole admin) |
| POST | `/api/trees/[treeId]/restore` | Restore deleted tree |

### Members & Invites

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/trees/[treeId]/members` | List members |
| PATCH | `/api/trees/[treeId]/members` | Change member role (admin) |
| DELETE | `/api/trees/[treeId]/members` | Remove member (admin) |
| POST | `/api/trees/[treeId]/invites` | Generate invite link (admin) |
| GET | `/api/trees/[treeId]/invites` | List active invites (admin) |
| DELETE | `/api/trees/[treeId]/invites` | Revoke invite (admin) |
| POST | `/api/invites/[token]/accept` | Accept invite link |

### Persons & Graph

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/trees/[treeId]/graph` | Get all nodes and relationships for graph visualization |
| POST | `/api/trees/[treeId]/persons` | Create profile-only person node (admin) |
| PUT | `/api/trees/[treeId]/persons/[nodeId]` | Update person details (admin or own node) |
| DELETE | `/api/trees/[treeId]/persons/[nodeId]` | Delete person node and relationships (admin) |
| POST | `/api/trees/[treeId]/relationships` | Create relationship between persons (admin) |
| DELETE | `/api/trees/[treeId]/relationships/[relationshipId]` | Soft-delete relationship (admin) |

## Error Handling

All API errors follow a standardized format:

```json
{
  "error": {
    "code": "TREE_LIMIT_REACHED",
    "message": "You can create a maximum of 20 family trees",
    "field": "name"
  }
}
```

HTTP status codes: 400 (validation), 401 (unauthenticated), 403 (forbidden), 404 (not found), 409 (conflict), 429 (rate limited), 500 (server error).

## Relationship Model

Relationships between persons in a tree use the following types:

| Type | Meaning |
|------|---------|
| `father` | `fromPerson` is the father of `toPerson` |
| `mother` | `fromPerson` is the mother of `toPerson` |
| `spouse` | `fromPerson` and `toPerson` are married/partnered |

Spouse relationships include a `spouseStatus` field (`active`, `divorced`, or `separated`) to track the current state of the union.

## Soft Delete

All major entities use soft delete (`deletedAt` field). Deleted records:
- Are excluded from all active queries
- Can be restored within 30 days
- Are permanently purged after the retention period

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm test` | Run tests (single run) |
| `npm run test:watch` | Run tests in watch mode |

## Database Migrations

### Relationship Type Migration

If you have existing data with the old `parent_child` relationship type, run the migration script to convert them to the new `father`/`mother` types:

```bash
# Using tsx (TypeScript)
npx tsx scripts/migrate-relationships.ts

# Or using plain Node.js (no tsx required)
node scripts/migrate-relationships.mjs
```

This script:
- Converts `parent_child` relationships to `father` or `mother` based on the parent person's gender (defaults to `father` if gender is unknown)
- Adds `spouseStatus: 'active'` to all spouse relationships
- Removes deprecated `direction` and `label` fields
- Removes any `sibling` type relationships (no longer supported as a stored type — siblings are now derived from shared parents)

## License

Private project.
