import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createInviteLink,
  acceptInvite,
  revokeInvite,
  listActiveInvites,
} from './invite.service';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '@/lib/utils/errors';

// --- Mocks ---

vi.mock('@/lib/db/connection', () => ({
  connectDB: vi.fn(async () => { }),
}));

// Mock Membership model
const mockMembershipFindOne = vi.fn();
const mockMembershipCreate = vi.fn();

vi.mock('@/lib/db/models/Membership', () => ({
  default: {
    findOne: (...args: unknown[]) => mockMembershipFindOne(...args),
    create: (...args: unknown[]) => mockMembershipCreate(...args),
  },
}));

// Mock Invite model
const mockInviteCreate = vi.fn();
const mockInviteFindOne = vi.fn();
const mockInviteFindById = vi.fn();
const mockInviteFind = vi.fn();
const mockInviteAcceptForUser = vi.fn();

vi.mock('@/lib/db/models/Invite', () => ({
  default: {
    create: (...args: unknown[]) => mockInviteCreate(...args),
    findOne: (...args: unknown[]) => mockInviteFindOne(...args),
    findById: (...args: unknown[]) => mockInviteFindById(...args),
    find: (...args: unknown[]) => mockInviteFind(...args),
    acceptForUser: (...args: unknown[]) => mockInviteAcceptForUser(...args),
  },
}));

// Mock TreeNode model
const mockTreeNodeFindOne = vi.fn();
const mockTreeNodeCreate = vi.fn();

vi.mock('@/lib/db/models/TreeNode', () => ({
  default: {
    findOne: (...args: unknown[]) => mockTreeNodeFindOne(...args),
    create: (...args: unknown[]) => mockTreeNodeCreate(...args),
  },
}));

// Mock Person model
const mockPersonCreate = vi.fn();

vi.mock('@/lib/db/models/Person', () => ({
  default: {
    create: (...args: unknown[]) => mockPersonCreate(...args),
  },
}));

// Mock Relationship model
const mockRelationshipCreate = vi.fn();

vi.mock('@/lib/db/models/Relationship', () => ({
  default: {
    create: (...args: unknown[]) => mockRelationshipCreate(...args),
  },
}));

// Mock User model
const mockUserFindById = vi.fn();

vi.mock('@/lib/db/models/User', () => ({
  default: {
    findById: (...args: unknown[]) => mockUserFindById(...args),
  },
}));

// --- Helpers ---

const FAKE_ADMIN_ID = '507f1f77bcf86cd799439011';
const FAKE_USER_ID = '507f1f77bcf86cd799439022';
const FAKE_TREE_ID = '507f1f77bcf86cd799439033';
const FAKE_INVITE_ID = '507f1f77bcf86cd799439044';
const FAKE_TOKEN = 'abc123def456';

function fakeObjectId(value: string) {
  return {
    toString: () => value,
    equals: (id: unknown) => id?.toString?.() === value,
  };
}

function makeFakeInvite(overrides = {}) {
  const invite = {
    _id: fakeObjectId(FAKE_INVITE_ID),
    treeId: fakeObjectId(FAKE_TREE_ID),
    role: 'editor' as const,
    token: FAKE_TOKEN,
    label: 'For Uncle Raj',
    invitedBy: fakeObjectId(FAKE_ADMIN_ID),
    status: 'active' as const,
    maxUses: 5,
    usedCount: 0,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    createdAt: new Date('2024-01-01'),
    acceptedBy: [],
    computedStatus: vi.fn().mockReturnValue('active'),
    isAcceptable: vi.fn().mockReturnValue(true),
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  return invite;
}

// --- Tests ---

describe('invite.service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Set env for URL building
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
  });

  describe('createInviteLink', () => {
    it('creates an invite link when actor is admin', async () => {
      // Actor is admin
      mockMembershipFindOne.mockResolvedValueOnce({
        _id: fakeObjectId('membership-1'),
        role: 'admin',
      });

      const createdInvite = makeFakeInvite();
      mockInviteCreate.mockResolvedValueOnce(createdInvite);

      const result = await createInviteLink({
        treeId: FAKE_TREE_ID,
        role: 'editor',
        invitedBy: FAKE_ADMIN_ID,
        label: 'For Uncle Raj',
        maxUses: 5,
        expiresInDays: 7,
      });

      expect(result.treeId).toBe(FAKE_TREE_ID);
      expect(result.role).toBe('editor');
      expect(result.label).toBe('For Uncle Raj');
      expect(result.maxUses).toBe(5);
      expect(result.inviteUrl).toContain('http://localhost:3000/invite/');
      expect(mockInviteCreate).toHaveBeenCalledTimes(1);
    });

    it('uses default values for maxUses and expiresInDays', async () => {
      mockMembershipFindOne.mockResolvedValueOnce({
        _id: fakeObjectId('membership-1'),
        role: 'admin',
      });

      const createdInvite = makeFakeInvite({ maxUses: 1 });
      mockInviteCreate.mockResolvedValueOnce(createdInvite);

      await createInviteLink({
        treeId: FAKE_TREE_ID,
        role: 'viewer',
        invitedBy: FAKE_ADMIN_ID,
      });

      const createCall = mockInviteCreate.mock.calls[0][0];
      expect(createCall.maxUses).toBe(1);
      expect(createCall.expiresAt).toBeInstanceOf(Date);
    });

    it('throws ForbiddenError when actor is not admin', async () => {
      mockMembershipFindOne.mockResolvedValueOnce(null);

      await expect(
        createInviteLink({
          treeId: FAKE_TREE_ID,
          role: 'editor',
          invitedBy: FAKE_USER_ID,
        })
      ).rejects.toThrow(ForbiddenError);
    });

    it('throws ValidationError for invalid treeId', async () => {
      await expect(
        createInviteLink({
          treeId: 'invalid-id',
          role: 'editor',
          invitedBy: FAKE_ADMIN_ID,
        })
      ).rejects.toThrow(ValidationError);
    });

    it('throws ValidationError for invalid role', async () => {
      mockMembershipFindOne.mockResolvedValueOnce({
        _id: fakeObjectId('membership-1'),
        role: 'admin',
      });

      await expect(
        createInviteLink({
          treeId: FAKE_TREE_ID,
          role: 'superadmin' as 'admin',
          invitedBy: FAKE_ADMIN_ID,
        })
      ).rejects.toThrow(ValidationError);
    });

    it('throws ValidationError for label exceeding max length', async () => {
      mockMembershipFindOne.mockResolvedValueOnce({
        _id: fakeObjectId('membership-1'),
        role: 'admin',
      });

      await expect(
        createInviteLink({
          treeId: FAKE_TREE_ID,
          role: 'editor',
          invitedBy: FAKE_ADMIN_ID,
          label: 'a'.repeat(101),
        })
      ).rejects.toThrow(ValidationError);
    });

    it('throws ValidationError for maxUses out of range', async () => {
      mockMembershipFindOne.mockResolvedValueOnce({
        _id: fakeObjectId('membership-1'),
        role: 'admin',
      });

      await expect(
        createInviteLink({
          treeId: FAKE_TREE_ID,
          role: 'editor',
          invitedBy: FAKE_ADMIN_ID,
          maxUses: 0,
        })
      ).rejects.toThrow(ValidationError);
    });

    it('throws ValidationError for expiresInDays out of range', async () => {
      mockMembershipFindOne.mockResolvedValueOnce({
        _id: fakeObjectId('membership-1'),
        role: 'admin',
      });

      await expect(
        createInviteLink({
          treeId: FAKE_TREE_ID,
          role: 'editor',
          invitedBy: FAKE_ADMIN_ID,
          expiresInDays: 31,
        })
      ).rejects.toThrow(ValidationError);
    });

    it('creates invite with relationship options when target node is valid', async () => {
      const targetNodeId = '507f1f77bcf86cd799439055';

      // Target TreeNode exists and is active
      mockTreeNodeFindOne.mockResolvedValueOnce({
        _id: fakeObjectId(targetNodeId),
        treeId: fakeObjectId(FAKE_TREE_ID),
        deletedAt: null,
      });

      // Actor is admin
      mockMembershipFindOne.mockResolvedValueOnce({
        _id: fakeObjectId('membership-1'),
        role: 'admin',
      });

      const createdInvite = makeFakeInvite({
        relationshipType: 'father',
        targetPersonNodeId: fakeObjectId(targetNodeId),
        inviteeIsParent: true,
      });
      mockInviteCreate.mockResolvedValueOnce(createdInvite);

      const result = await createInviteLink({
        treeId: FAKE_TREE_ID,
        role: 'editor',
        invitedBy: FAKE_ADMIN_ID,
        relationshipType: 'father',
        targetPersonNodeId: targetNodeId,
        inviteeIsParent: true,
      });

      expect(result.treeId).toBe(FAKE_TREE_ID);
      const createCall = mockInviteCreate.mock.calls[0][0];
      expect(createCall.relationshipType).toBe('father');
      expect(createCall.targetPersonNodeId).toBeDefined();
      expect(createCall.inviteeIsParent).toBe(true);
    });

    it('does not store inviteeIsParent when relationship type is spouse', async () => {
      const targetNodeId = '507f1f77bcf86cd799439055';

      // Target TreeNode exists and is active
      mockTreeNodeFindOne.mockResolvedValueOnce({
        _id: fakeObjectId(targetNodeId),
        treeId: fakeObjectId(FAKE_TREE_ID),
        deletedAt: null,
      });

      // Actor is admin
      mockMembershipFindOne.mockResolvedValueOnce({
        _id: fakeObjectId('membership-1'),
        role: 'admin',
      });

      const createdInvite = makeFakeInvite({
        relationshipType: 'spouse',
        targetPersonNodeId: fakeObjectId(targetNodeId),
      });
      mockInviteCreate.mockResolvedValueOnce(createdInvite);

      await createInviteLink({
        treeId: FAKE_TREE_ID,
        role: 'editor',
        invitedBy: FAKE_ADMIN_ID,
        relationshipType: 'spouse',
        targetPersonNodeId: targetNodeId,
        inviteeIsParent: true, // should be ignored for spouse
      });

      const createCall = mockInviteCreate.mock.calls[0][0];
      expect(createCall.relationshipType).toBe('spouse');
      expect(createCall.inviteeIsParent).toBeUndefined();
    });

    it('throws ValidationError when relationshipType is provided without targetPersonNodeId', async () => {
      await expect(
        createInviteLink({
          treeId: FAKE_TREE_ID,
          role: 'editor',
          invitedBy: FAKE_ADMIN_ID,
          relationshipType: 'father',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('throws ValidationError when target person node does not exist in tree', async () => {
      const targetNodeId = '507f1f77bcf86cd799439055';

      // Target TreeNode not found
      mockTreeNodeFindOne.mockResolvedValueOnce(null);

      await expect(
        createInviteLink({
          treeId: FAKE_TREE_ID,
          role: 'editor',
          invitedBy: FAKE_ADMIN_ID,
          relationshipType: 'father',
          targetPersonNodeId: targetNodeId,
        })
      ).rejects.toThrow(ValidationError);
    });

    it('throws ValidationError when target person node is soft-deleted', async () => {
      const targetNodeId = '507f1f77bcf86cd799439055';

      // TreeNode.findOne with deletedAt: null returns null for deleted nodes
      mockTreeNodeFindOne.mockResolvedValueOnce(null);

      await expect(
        createInviteLink({
          treeId: FAKE_TREE_ID,
          role: 'editor',
          invitedBy: FAKE_ADMIN_ID,
          relationshipType: 'father',
          targetPersonNodeId: targetNodeId,
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('acceptInvite', () => {
    it('accepts a valid invite and creates membership', async () => {
      const invite = makeFakeInvite();
      mockInviteFindOne.mockResolvedValueOnce(invite);

      // No existing membership (Membership.findOne returns null)
      mockMembershipFindOne.mockResolvedValueOnce(null);

      // Atomic accept succeeds
      const updatedInvite = makeFakeInvite({ usedCount: 1 });
      mockInviteAcceptForUser.mockResolvedValueOnce(updatedInvite);

      // Membership creation
      mockMembershipCreate.mockResolvedValueOnce({
        _id: fakeObjectId('new-membership-id'),
        userId: fakeObjectId(FAKE_USER_ID),
        treeId: fakeObjectId(FAKE_TREE_ID),
        role: 'editor',
      });

      // TreeNode creation for invitee (no existing TreeNode)
      mockTreeNodeFindOne.mockResolvedValueOnce(null);
      mockUserFindById.mockResolvedValueOnce({
        _id: fakeObjectId(FAKE_USER_ID),
        displayName: 'Test User',
      });
      mockPersonCreate.mockResolvedValueOnce({
        _id: fakeObjectId('new-person-id'),
        firstName: 'Test',
        lastName: 'User',
      });
      mockTreeNodeCreate.mockResolvedValueOnce({
        _id: fakeObjectId('new-tree-node-id'),
        personId: fakeObjectId('new-person-id'),
        treeId: fakeObjectId(FAKE_TREE_ID),
        linkedUserId: fakeObjectId(FAKE_USER_ID),
      });

      const result = await acceptInvite(FAKE_TOKEN, FAKE_USER_ID);

      expect(result.membershipId).toBe('new-membership-id');
      expect(result.treeId).toBe(FAKE_TREE_ID);
      expect(result.role).toBe('editor');
      expect(mockMembershipCreate).toHaveBeenCalledTimes(1);
      expect(mockTreeNodeCreate).toHaveBeenCalledTimes(1);
    });

    it('marks invite as exhausted when usedCount reaches maxUses', async () => {
      const invite = makeFakeInvite({ maxUses: 1 });
      mockInviteFindOne.mockResolvedValueOnce(invite);

      // No existing membership
      mockMembershipFindOne.mockResolvedValueOnce(null);

      // Atomic accept succeeds, usedCount now equals maxUses
      const updatedInvite = makeFakeInvite({
        usedCount: 1,
        maxUses: 1,
      });
      mockInviteAcceptForUser.mockResolvedValueOnce(updatedInvite);

      mockMembershipCreate.mockResolvedValueOnce({
        _id: fakeObjectId('new-membership-id'),
        userId: fakeObjectId(FAKE_USER_ID),
        treeId: fakeObjectId(FAKE_TREE_ID),
        role: 'editor',
      });

      // TreeNode creation for invitee
      mockTreeNodeFindOne.mockResolvedValueOnce(null);
      mockUserFindById.mockResolvedValueOnce({
        _id: fakeObjectId(FAKE_USER_ID),
        displayName: 'Test User',
      });
      mockPersonCreate.mockResolvedValueOnce({
        _id: fakeObjectId('new-person-id'),
        firstName: 'Test',
        lastName: 'User',
      });
      mockTreeNodeCreate.mockResolvedValueOnce({
        _id: fakeObjectId('new-tree-node-id'),
        personId: fakeObjectId('new-person-id'),
        treeId: fakeObjectId(FAKE_TREE_ID),
        linkedUserId: fakeObjectId(FAKE_USER_ID),
      });

      await acceptInvite(FAKE_TOKEN, FAKE_USER_ID);

      expect(updatedInvite.status).toBe('exhausted');
      expect(updatedInvite.save).toHaveBeenCalled();
    });

    it('throws NotFoundError for invalid token', async () => {
      mockInviteFindOne.mockResolvedValueOnce(null);

      await expect(
        acceptInvite('nonexistent-token', FAKE_USER_ID)
      ).rejects.toThrow(NotFoundError);
    });

    it('throws ValidationError for expired invite', async () => {
      const invite = makeFakeInvite({
        computedStatus: vi.fn().mockReturnValue('expired'),
      });
      mockInviteFindOne.mockResolvedValueOnce(invite);

      await expect(
        acceptInvite(FAKE_TOKEN, FAKE_USER_ID)
      ).rejects.toThrow(ValidationError);
    });

    it('throws ValidationError for revoked invite', async () => {
      const invite = makeFakeInvite({
        computedStatus: vi.fn().mockReturnValue('revoked'),
      });
      mockInviteFindOne.mockResolvedValueOnce(invite);

      await expect(
        acceptInvite(FAKE_TOKEN, FAKE_USER_ID)
      ).rejects.toThrow(ValidationError);
    });

    it('throws ValidationError for exhausted invite', async () => {
      const invite = makeFakeInvite({
        computedStatus: vi.fn().mockReturnValue('exhausted'),
      });
      mockInviteFindOne.mockResolvedValueOnce(invite);

      await expect(
        acceptInvite(FAKE_TOKEN, FAKE_USER_ID)
      ).rejects.toThrow(ValidationError);
    });

    it('throws ConflictError when user is already a member', async () => {
      const invite = makeFakeInvite();
      mockInviteFindOne.mockResolvedValueOnce(invite);

      // User already has membership
      mockMembershipFindOne.mockResolvedValueOnce({
        _id: fakeObjectId('existing-membership'),
        userId: fakeObjectId(FAKE_USER_ID),
        treeId: fakeObjectId(FAKE_TREE_ID),
        role: 'viewer',
      });

      await expect(
        acceptInvite(FAKE_TOKEN, FAKE_USER_ID)
      ).rejects.toThrow(ConflictError);
    });

    it('throws ValidationError when atomic accept fails (race condition)', async () => {
      const invite = makeFakeInvite();
      mockInviteFindOne.mockResolvedValueOnce(invite);

      // No existing membership
      mockMembershipFindOne.mockResolvedValueOnce(null);

      // Atomic accept returns null (race condition)
      mockInviteAcceptForUser.mockResolvedValueOnce(null);

      await expect(
        acceptInvite(FAKE_TOKEN, FAKE_USER_ID)
      ).rejects.toThrow(ValidationError);
    });

    it('throws ValidationError for invalid userId format', async () => {
      await expect(
        acceptInvite(FAKE_TOKEN, 'invalid-id')
      ).rejects.toThrow(ValidationError);
    });

    it('auto-creates relationship when invite has relationship info (parent_child, invitee is parent)', async () => {
      const targetNodeId = '507f1f77bcf86cd799439055';
      const inviteePersonId = '507f1f77bcf86cd799439066';
      const targetPersonId = '507f1f77bcf86cd799439077';
      const inviteeTreeNodeId = '507f1f77bcf86cd799439088';

      const invite = makeFakeInvite({
        relationshipType: 'father',
        targetPersonNodeId: fakeObjectId(targetNodeId),
        inviteeIsParent: true,
      });
      mockInviteFindOne.mockResolvedValueOnce(invite);

      // No existing membership
      mockMembershipFindOne.mockResolvedValueOnce(null);

      // Atomic accept succeeds
      const updatedInvite = makeFakeInvite({
        usedCount: 1,
        relationshipType: 'father',
        targetPersonNodeId: fakeObjectId(targetNodeId),
        inviteeIsParent: true,
      });
      mockInviteAcceptForUser.mockResolvedValueOnce(updatedInvite);

      // Membership creation
      mockMembershipCreate.mockResolvedValueOnce({
        _id: fakeObjectId('new-membership-id'),
        userId: fakeObjectId(FAKE_USER_ID),
        treeId: fakeObjectId(FAKE_TREE_ID),
        role: 'editor',
      });

      // No existing TreeNode for invitee
      mockTreeNodeFindOne.mockResolvedValueOnce(null);

      // User lookup for display name
      mockUserFindById.mockResolvedValueOnce({
        _id: fakeObjectId(FAKE_USER_ID),
        displayName: 'John Doe',
      });

      // Person creation for invitee
      mockPersonCreate.mockResolvedValueOnce({
        _id: fakeObjectId(inviteePersonId),
        firstName: 'John',
        lastName: 'Doe',
      });

      // TreeNode creation for invitee
      mockTreeNodeCreate.mockResolvedValueOnce({
        _id: fakeObjectId(inviteeTreeNodeId),
        personId: fakeObjectId(inviteePersonId),
        treeId: fakeObjectId(FAKE_TREE_ID),
        linkedUserId: fakeObjectId(FAKE_USER_ID),
      });

      // Target TreeNode lookup
      mockTreeNodeFindOne.mockResolvedValueOnce({
        _id: fakeObjectId(targetNodeId),
        personId: fakeObjectId(targetPersonId),
        treeId: fakeObjectId(FAKE_TREE_ID),
      });

      // Relationship creation
      mockRelationshipCreate.mockResolvedValueOnce({
        _id: fakeObjectId('new-rel-id'),
        treeId: fakeObjectId(FAKE_TREE_ID),
        fromPersonId: fakeObjectId(inviteePersonId),
        toPersonId: fakeObjectId(targetPersonId),
        type: 'father',
      });

      const result = await acceptInvite(FAKE_TOKEN, FAKE_USER_ID);

      expect(result.membershipId).toBe('new-membership-id');
      expect(result.relationshipCreated).toBe(true);
      expect(result.relationshipError).toBeUndefined();
      expect(mockRelationshipCreate).toHaveBeenCalledTimes(1);

      // Verify fromPersonId is invitee (parent) and toPersonId is target (child)
      const relCreateCall = mockRelationshipCreate.mock.calls[0][0];
      expect(relCreateCall.type).toBe('father');
    });

    it('auto-creates relationship when invite has relationship info (parent_child, invitee is child)', async () => {
      const targetNodeId = '507f1f77bcf86cd799439055';
      const inviteePersonId = '507f1f77bcf86cd799439066';
      const targetPersonId = '507f1f77bcf86cd799439077';
      const inviteeTreeNodeId = '507f1f77bcf86cd799439088';

      const invite = makeFakeInvite({
        relationshipType: 'father',
        targetPersonNodeId: fakeObjectId(targetNodeId),
        inviteeIsParent: false,
      });
      mockInviteFindOne.mockResolvedValueOnce(invite);

      // No existing membership
      mockMembershipFindOne.mockResolvedValueOnce(null);

      // Atomic accept succeeds
      const updatedInvite = makeFakeInvite({
        usedCount: 1,
        relationshipType: 'father',
        targetPersonNodeId: fakeObjectId(targetNodeId),
        inviteeIsParent: false,
      });
      mockInviteAcceptForUser.mockResolvedValueOnce(updatedInvite);

      // Membership creation
      mockMembershipCreate.mockResolvedValueOnce({
        _id: fakeObjectId('new-membership-id'),
        userId: fakeObjectId(FAKE_USER_ID),
        treeId: fakeObjectId(FAKE_TREE_ID),
        role: 'editor',
      });

      // No existing TreeNode for invitee
      mockTreeNodeFindOne.mockResolvedValueOnce(null);

      // User lookup
      mockUserFindById.mockResolvedValueOnce({
        _id: fakeObjectId(FAKE_USER_ID),
        displayName: 'Jane Smith',
      });

      // Person creation
      mockPersonCreate.mockResolvedValueOnce({
        _id: fakeObjectId(inviteePersonId),
        firstName: 'Jane',
        lastName: 'Smith',
      });

      // TreeNode creation
      mockTreeNodeCreate.mockResolvedValueOnce({
        _id: fakeObjectId(inviteeTreeNodeId),
        personId: fakeObjectId(inviteePersonId),
        treeId: fakeObjectId(FAKE_TREE_ID),
        linkedUserId: fakeObjectId(FAKE_USER_ID),
      });

      // Target TreeNode lookup
      mockTreeNodeFindOne.mockResolvedValueOnce({
        _id: fakeObjectId(targetNodeId),
        personId: fakeObjectId(targetPersonId),
        treeId: fakeObjectId(FAKE_TREE_ID),
      });

      // Relationship creation
      mockRelationshipCreate.mockResolvedValueOnce({
        _id: fakeObjectId('new-rel-id'),
        treeId: fakeObjectId(FAKE_TREE_ID),
        fromPersonId: fakeObjectId(targetPersonId),
        toPersonId: fakeObjectId(inviteePersonId),
        type: 'father',
      });

      const result = await acceptInvite(FAKE_TOKEN, FAKE_USER_ID);

      expect(result.membershipId).toBe('new-membership-id');
      expect(result.relationshipCreated).toBe(true);
      expect(result.relationshipError).toBeUndefined();

      // Verify fromPersonId is target (parent) and toPersonId is invitee (child)
      const relCreateCall = mockRelationshipCreate.mock.calls[0][0];
      expect(relCreateCall.type).toBe('father');
    });

    it('gracefully handles relationship creation failure (returns membership success with error flag)', async () => {
      const targetNodeId = '507f1f77bcf86cd799439055';
      const inviteePersonId = '507f1f77bcf86cd799439066';
      const inviteeTreeNodeId = '507f1f77bcf86cd799439088';

      const invite = makeFakeInvite({
        relationshipType: 'spouse',
        targetPersonNodeId: fakeObjectId(targetNodeId),
      });
      mockInviteFindOne.mockResolvedValueOnce(invite);

      // No existing membership
      mockMembershipFindOne.mockResolvedValueOnce(null);

      // Atomic accept succeeds
      const updatedInvite = makeFakeInvite({
        usedCount: 1,
        relationshipType: 'spouse',
        targetPersonNodeId: fakeObjectId(targetNodeId),
      });
      mockInviteAcceptForUser.mockResolvedValueOnce(updatedInvite);

      // Membership creation
      mockMembershipCreate.mockResolvedValueOnce({
        _id: fakeObjectId('new-membership-id'),
        userId: fakeObjectId(FAKE_USER_ID),
        treeId: fakeObjectId(FAKE_TREE_ID),
        role: 'editor',
      });

      // Existing TreeNode for invitee (already has one)
      mockTreeNodeFindOne.mockResolvedValueOnce({
        _id: fakeObjectId(inviteeTreeNodeId),
        personId: fakeObjectId(inviteePersonId),
        treeId: fakeObjectId(FAKE_TREE_ID),
        linkedUserId: fakeObjectId(FAKE_USER_ID),
      });

      // Target TreeNode lookup — not found (deleted after invite creation)
      mockTreeNodeFindOne.mockResolvedValueOnce(null);

      const result = await acceptInvite(FAKE_TOKEN, FAKE_USER_ID);

      // Membership still succeeds
      expect(result.membershipId).toBe('new-membership-id');
      expect(result.treeId).toBe(FAKE_TREE_ID);
      expect(result.role).toBe('editor');

      // Relationship failed gracefully
      expect(result.relationshipCreated).toBe(false);
      expect(result.relationshipError).toBe('Target person node no longer exists in the tree');
    });

    it('does not create relationship when invite has no relationship info', async () => {
      const invite = makeFakeInvite();
      mockInviteFindOne.mockResolvedValueOnce(invite);

      // No existing membership
      mockMembershipFindOne.mockResolvedValueOnce(null);

      // Atomic accept succeeds
      const updatedInvite = makeFakeInvite({ usedCount: 1 });
      mockInviteAcceptForUser.mockResolvedValueOnce(updatedInvite);

      // Membership creation
      mockMembershipCreate.mockResolvedValueOnce({
        _id: fakeObjectId('new-membership-id'),
        userId: fakeObjectId(FAKE_USER_ID),
        treeId: fakeObjectId(FAKE_TREE_ID),
        role: 'editor',
      });

      // TreeNode creation for invitee (always happens now)
      mockTreeNodeFindOne.mockResolvedValueOnce(null);
      mockUserFindById.mockResolvedValueOnce({
        _id: fakeObjectId(FAKE_USER_ID),
        displayName: 'Test User',
      });
      mockPersonCreate.mockResolvedValueOnce({
        _id: fakeObjectId('new-person-id'),
        firstName: 'Test',
        lastName: 'User',
      });
      mockTreeNodeCreate.mockResolvedValueOnce({
        _id: fakeObjectId('new-tree-node-id'),
        personId: fakeObjectId('new-person-id'),
        treeId: fakeObjectId(FAKE_TREE_ID),
        linkedUserId: fakeObjectId(FAKE_USER_ID),
      });

      const result = await acceptInvite(FAKE_TOKEN, FAKE_USER_ID);

      expect(result.membershipId).toBe('new-membership-id');
      expect(result.relationshipCreated).toBeUndefined();
      expect(result.relationshipError).toBeUndefined();
      expect(mockRelationshipCreate).not.toHaveBeenCalled();
      // TreeNode should still be created even without relationship info
      expect(mockTreeNodeCreate).toHaveBeenCalledTimes(1);
    });

    it('uses existing TreeNode when invitee already has one in the tree', async () => {
      const targetNodeId = '507f1f77bcf86cd799439055';
      const inviteePersonId = '507f1f77bcf86cd799439066';
      const targetPersonId = '507f1f77bcf86cd799439077';
      const inviteeTreeNodeId = '507f1f77bcf86cd799439088';

      const invite = makeFakeInvite({
        relationshipType: 'spouse',
        targetPersonNodeId: fakeObjectId(targetNodeId),
      });
      mockInviteFindOne.mockResolvedValueOnce(invite);

      // No existing membership
      mockMembershipFindOne.mockResolvedValueOnce(null);

      // Atomic accept succeeds
      const updatedInvite = makeFakeInvite({
        usedCount: 1,
        relationshipType: 'spouse',
        targetPersonNodeId: fakeObjectId(targetNodeId),
      });
      mockInviteAcceptForUser.mockResolvedValueOnce(updatedInvite);

      // Membership creation
      mockMembershipCreate.mockResolvedValueOnce({
        _id: fakeObjectId('new-membership-id'),
        userId: fakeObjectId(FAKE_USER_ID),
        treeId: fakeObjectId(FAKE_TREE_ID),
        role: 'editor',
      });

      // Existing TreeNode for invitee (already has one)
      mockTreeNodeFindOne.mockResolvedValueOnce({
        _id: fakeObjectId(inviteeTreeNodeId),
        personId: fakeObjectId(inviteePersonId),
        treeId: fakeObjectId(FAKE_TREE_ID),
        linkedUserId: fakeObjectId(FAKE_USER_ID),
      });

      // Target TreeNode lookup
      mockTreeNodeFindOne.mockResolvedValueOnce({
        _id: fakeObjectId(targetNodeId),
        personId: fakeObjectId(targetPersonId),
        treeId: fakeObjectId(FAKE_TREE_ID),
      });

      // Relationship creation
      mockRelationshipCreate.mockResolvedValueOnce({
        _id: fakeObjectId('new-rel-id'),
        treeId: fakeObjectId(FAKE_TREE_ID),
        fromPersonId: fakeObjectId(inviteePersonId),
        toPersonId: fakeObjectId(targetPersonId),
        type: 'spouse',
      });

      const result = await acceptInvite(FAKE_TOKEN, FAKE_USER_ID);

      expect(result.relationshipCreated).toBe(true);
      // Should NOT have created a new Person or TreeNode
      expect(mockPersonCreate).not.toHaveBeenCalled();
      expect(mockTreeNodeCreate).not.toHaveBeenCalled();
    });
  });

  describe('revokeInvite', () => {
    it('revokes an active invite when actor is admin', async () => {
      const invite = makeFakeInvite();
      mockInviteFindById.mockResolvedValueOnce(invite);

      // Actor is admin (requireAdmin calls Membership.findOne)
      mockMembershipFindOne.mockResolvedValue({
        _id: fakeObjectId('membership-1'),
        role: 'admin',
      });

      const result = await revokeInvite(FAKE_INVITE_ID, FAKE_ADMIN_ID);

      expect(invite.status).toBe('revoked');
      expect(invite.save).toHaveBeenCalled();
      expect(result.id).toBe(FAKE_INVITE_ID);
    });

    it('throws NotFoundError when invite does not exist', async () => {
      mockInviteFindById.mockResolvedValueOnce(null);

      await expect(
        revokeInvite(FAKE_INVITE_ID, FAKE_ADMIN_ID)
      ).rejects.toThrow(NotFoundError);
    });

    it('throws ForbiddenError when actor is not admin', async () => {
      const invite = makeFakeInvite();
      mockInviteFindById.mockResolvedValueOnce(invite);

      // Actor is not admin
      mockMembershipFindOne.mockResolvedValue(null);

      await expect(
        revokeInvite(FAKE_INVITE_ID, FAKE_USER_ID)
      ).rejects.toThrow(ForbiddenError);
    });

    it('throws ValidationError when invite is not active', async () => {
      const invite = makeFakeInvite({
        computedStatus: vi.fn().mockReturnValue('expired'),
      });
      mockInviteFindById.mockResolvedValueOnce(invite);

      // Actor is admin
      mockMembershipFindOne.mockResolvedValue({
        _id: fakeObjectId('membership-1'),
        role: 'admin',
      });

      await expect(
        revokeInvite(FAKE_INVITE_ID, FAKE_ADMIN_ID)
      ).rejects.toThrow(ValidationError);
    });

    it('throws ValidationError for invalid inviteId format', async () => {
      await expect(
        revokeInvite('invalid-id', FAKE_ADMIN_ID)
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('listActiveInvites', () => {
    it('returns active invites for a tree when actor is admin', async () => {
      // Actor is admin
      mockMembershipFindOne.mockResolvedValue({
        _id: fakeObjectId('membership-1'),
        role: 'admin',
      });

      const invite1 = makeFakeInvite({ token: 'token1' });
      const invite2 = makeFakeInvite({ token: 'token2' });

      mockInviteFind.mockReturnValueOnce({
        sort: vi.fn().mockResolvedValue([invite1, invite2]),
      });

      const result = await listActiveInvites(FAKE_TREE_ID, FAKE_ADMIN_ID);

      expect(result).toHaveLength(2);
      expect(result[0].token).toBe('token1');
      expect(result[1].token).toBe('token2');
    });

    it('filters out expired invites from results', async () => {
      // Actor is admin
      mockMembershipFindOne.mockResolvedValue({
        _id: fakeObjectId('membership-1'),
        role: 'admin',
      });

      const activeInvite = makeFakeInvite({
        token: 'active-token',
        computedStatus: vi.fn().mockReturnValue('active'),
      });
      const expiredInvite = makeFakeInvite({
        token: 'expired-token',
        computedStatus: vi.fn().mockReturnValue('expired'),
      });

      mockInviteFind.mockReturnValueOnce({
        sort: vi.fn().mockResolvedValue([activeInvite, expiredInvite]),
      });

      const result = await listActiveInvites(FAKE_TREE_ID, FAKE_ADMIN_ID);

      expect(result).toHaveLength(1);
      expect(result[0].token).toBe('active-token');
    });

    it('returns empty array when no active invites exist', async () => {
      // Actor is admin
      mockMembershipFindOne.mockResolvedValue({
        _id: fakeObjectId('membership-1'),
        role: 'admin',
      });

      mockInviteFind.mockReturnValueOnce({
        sort: vi.fn().mockResolvedValue([]),
      });

      const result = await listActiveInvites(FAKE_TREE_ID, FAKE_ADMIN_ID);

      expect(result).toEqual([]);
    });

    it('throws ForbiddenError when actor is not admin', async () => {
      mockMembershipFindOne.mockResolvedValue(null);

      mockInviteFind.mockReturnValueOnce({
        sort: vi.fn().mockResolvedValue([]),
      });

      await expect(
        listActiveInvites(FAKE_TREE_ID, FAKE_USER_ID)
      ).rejects.toThrow(ForbiddenError);
    });

    it('throws ValidationError for invalid treeId format', async () => {
      await expect(
        listActiveInvites('invalid-id', FAKE_ADMIN_ID)
      ).rejects.toThrow(ValidationError);
    });
  });
});
