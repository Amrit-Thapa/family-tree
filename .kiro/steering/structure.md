# Project Structure

```
src/
├── app/                              # Next.js App Router
│   ├── (public)/                     # Public routes (no auth required)
│   │   └── auth/signin/              # Sign-in page
│   ├── (protected)/                  # Protected routes (auth required)
│   │   ├── layout.tsx                # Session verification + redirect
│   │   ├── dashboard/                # User's tree list
│   │   ├── invite/[token]/           # Invite acceptance
│   │   └── trees/
│   │       ├── new/                  # Create tree form
│   │       └── [treeId]/             # Tree-scoped pages
│   │           ├── layout.tsx        # Membership verification
│   │           ├── members/          # Member management (admin only)
│   │           └── settings/         # Tree settings (admin only)
│   ├── actions/                      # Server Actions
│   └── api/                          # REST Route Handlers
│       ├── auth/                     # signin, signout, me
│       ├── invites/[token]/          # Invite acceptance endpoint
│       └── trees/[treeId]/           # Tree CRUD, members, invites
├── components/                       # React components
│   ├── auth/                         # Auth-related UI
│   ├── icons/                        # Icon components
│   ├── layout/                       # Sidebar, navigation
│   └── tree/                         # Tree context provider
└── lib/                              # Shared logic
    ├── auth/                         # Firebase Admin/Client, session management
    ├── constants/                    # App-wide constants
    ├── db/
    │   ├── connection.ts             # MongoDB singleton connection
    │   └── models/                   # Mongoose models (14 models)
    ├── services/                     # Business logic layer
    ├── types/                        # TypeScript type definitions
    ├── utils/                        # Utilities (errors, sanitize, mongo helpers)
    └── validations/                  # Zod schemas for input validation
```

## Architecture Patterns

- **Service layer**: Business logic lives in `src/lib/services/*.service.ts`, not in route handlers or server actions. Services are pure functions that accept IDs/inputs and return typed results.
- **Route handlers** (`src/app/api/`): Thin HTTP layer — parse request, call service, return response.
- **Server actions** (`src/app/actions/`): Thin wrappers calling services for form submissions.
- **Validation schemas**: Defined in `src/lib/validations/` using Zod, shared between client and server.
- **Error handling**: Custom error classes in `src/lib/utils/errors.ts` (AppError hierarchy). All API errors use a standardized `{ error: { code, message, field? } }` format.
- **Test co-location**: Test files (`.test.ts`) live next to the source files they test.
- **Mongoose models**: Each model in its own file under `src/lib/db/models/`, exported via `index.ts`.

## Mongoose Models

AuditLog, ClaimRequest, FamilyTree, HistoricalRecord, Invite, MediaAsset, Membership, MergeRequest, Person, Relationship, Session, TreeNode, User

## Route Protection

- `(protected)/layout.tsx` verifies session; redirects to sign-in if invalid.
- `trees/[treeId]/layout.tsx` verifies tree membership; returns 404 (not 403) to hide tree existence.
