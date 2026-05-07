import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createTree,
  getTree,
  updateTree,
  softDeleteTree,
  restoreTree,
  listUserTrees,
  MAX_TREES_PER_USER,
  RESTORE_WINDOW_DAYS,
} from './tree.service';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '@/lib/utils/errors';

// --- Mocks ---

vi.mock('@/lib/db/connection', () => ({
  connectDB: vi.fn(async () => { }),
}));

// Mock FamilyTree model
const mockFamilyTreeFindOne = vi.fn();
const mockFamilyTreeCreate = vi.fn();

vi.mock('@/lib/db/models/FamilyTree', () => ({
  default: {
    findOne: (...args: unknown[]) => mockFamilyTreeFindOne(...args),
    create: (...args: unknown[]) => mockFamilyTreeCreate(...args),
  },
}));

// Mock Membership model
const mockMembershipFindOne = vi.fn();
const mockMembershipFind = vi.fn();
const mockMembershipCountDocuments = vi.fn();
const mockMembershipCreate = vi.fn();
const mockMembershipAggregate = vi.fn();

vi.mock('@/lib/db/models/Membership', () => ({
  default: {
    findOne: (...args: unknown[]) => mockMembershipFindOne(...args),
    find: (...args: unknown[]) => mockMembershipFind(...args),
    countDocuments: (...args: unknown[]) => mockMembershipCountDocuments(...args),
    create: (...args: unknown[]) => mockMembershipCreate(...args),
    aggregate: (...args: unknown[]) => mockMembershipAggregate(...args),
  },
}));

// --- Helpers ---

const FAKE_USER_ID = '507f1f77bcf86cd799439011';
const FAKE_TREE_ID = '507f1f77bcf86cd799439022';

/**
 * Creates a fake Mongoose ObjectId-like object with toString() and equals().
 */
function fakeObjectId(value: string) {
  return {
    toString: () => value,
    equals: (id: unknown) => id?.toString?.() === value,
  };
}

/**
 * Mocks the admin membership query chain used by softDeleteTree.
 * Simulates Membership.find(...).select('userId') returning the given user IDs.
 */
function mockAdminMemberships(userIds: string[]) {
  mockMembershipFind.mockReturnValue({
    select: vi.fn().mockResolvedValue(
      userIds.map((id) => ({ userId: fakeObjectId(id) }))
    ),
  });
}

function makeFakeTree(overrides = {}) {
  return {
    _id: fakeObjectId(FAKE_TREE_ID),
    name: 'My Family Tree',
    description: 'A test tree',
    createdBy: fakeObjectId(FAKE_USER_ID),
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    deletedAt: null,
    deletedBy: null,
    totalStorageBytes: 0,
    storageLimit: 524288000,
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// --- Tests ---

describe('tree.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createTree', () => {
    it('creates a tree and admin membership when valid', async () => {
      mockFamilyTreeFindOne.mockResolvedValue(null); // No duplicate name
      mockMembershipCountDocuments.mockResolvedValue(5); // Under limit

      const fakeTree = makeFakeTree();
      mockFamilyTreeCreate.mockResolvedValue(fakeTree);

      const fakeMembership = {
        _id: fakeObjectId('membership-id-1'),
        userId: fakeObjectId(FAKE_USER_ID),
        treeId: fakeObjectId(FAKE_TREE_ID),
        role: 'admin',
        joinedAt: new Date('2024-01-01'),
      };
      mockMembershipCreate.mockResolvedValue(fakeMembership);

      const result = await createTree(FAKE_USER_ID, {
        name: 'My Family Tree',
        description: 'A test tree',
      });

      expect(result.tree.name).toBe('My Family Tree');
      expect(result.tree.description).toBe('A test tree');
      expect(result.membership.role).toBe('admin');
      expect(result.membership.userId).toBe(FAKE_USER_ID);

      // Verify the shape of data passed to FamilyTree.create
      expect(mockFamilyTreeCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'My Family Tree',
          description: 'A test tree',
          createdBy: expect.anything(),
        })
      );
      expect(mockMembershipCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          treeId: fakeTree._id,
          role: 'admin',
        })
      );
    });

    it('throws ConflictError when tree name already exists for user', async () => {
      mockFamilyTreeFindOne.mockResolvedValue(makeFakeTree()); // Duplicate found

      await expect(
        createTree(FAKE_USER_ID, { name: 'My Family Tree' })
      ).rejects.toThrow(ConflictError);
    });

    it(`throws ValidationError when user has reached ${MAX_TREES_PER_USER}-tree limit`, async () => {
      mockFamilyTreeFindOne.mockResolvedValue(null); // No duplicate
      mockMembershipCountDocuments.mockResolvedValue(MAX_TREES_PER_USER); // At limit

      await expect(
        createTree(FAKE_USER_ID, { name: 'New Tree' })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('getTree', () => {
    it('returns tree data when tree exists and is not deleted', async () => {
      mockFamilyTreeFindOne.mockResolvedValue(makeFakeTree());

      const result = await getTree(FAKE_TREE_ID);

      expect(result.id).toBe(FAKE_TREE_ID);
      expect(result.name).toBe('My Family Tree');
    });

    it('throws NotFoundError when tree does not exist', async () => {
      mockFamilyTreeFindOne.mockResolvedValue(null);

      await expect(getTree(FAKE_TREE_ID)).rejects.toThrow(NotFoundError);
    });
  });

  describe('updateTree', () => {
    it('updates tree name and description', async () => {
      const fakeTree = makeFakeTree();
      mockFamilyTreeFindOne
        .mockResolvedValueOnce(fakeTree) // First call: find tree
        .mockResolvedValueOnce(null); // Second call: no duplicate name

      mockMembershipFindOne.mockResolvedValue({ role: 'admin' }); // User has edit permission

      const result = await updateTree(FAKE_TREE_ID, FAKE_USER_ID, {
        name: 'Updated Name',
        description: 'Updated description',
      });

      expect(fakeTree.save).toHaveBeenCalled();
      expect(result.name).toBe('Updated Name');
    });

    it('throws NotFoundError when tree does not exist', async () => {
      mockFamilyTreeFindOne.mockResolvedValue(null);

      await expect(
        updateTree(FAKE_TREE_ID, FAKE_USER_ID, { name: 'New Name' })
      ).rejects.toThrow(NotFoundError);
    });

    it('throws ForbiddenError when user does not have edit permissions', async () => {
      const fakeTree = makeFakeTree();
      mockFamilyTreeFindOne.mockResolvedValue(fakeTree);
      mockMembershipFindOne.mockResolvedValue(null); // No membership

      await expect(
        updateTree(FAKE_TREE_ID, FAKE_USER_ID, { name: 'New Name' })
      ).rejects.toThrow(ForbiddenError);
    });

    it('throws ConflictError when new name conflicts with existing tree', async () => {
      const fakeTree = makeFakeTree({ name: 'Original Name' });
      const conflictingTree = makeFakeTree({ name: 'Taken Name' });

      mockFamilyTreeFindOne
        .mockResolvedValueOnce(fakeTree) // Find tree
        .mockResolvedValueOnce(conflictingTree); // Duplicate found

      mockMembershipFindOne.mockResolvedValue({ role: 'admin' }); // User has edit permission

      await expect(
        updateTree(FAKE_TREE_ID, FAKE_USER_ID, { name: 'Taken Name' })
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('softDeleteTree', () => {
    it('soft-deletes tree when user is sole admin', async () => {
      const fakeTree = makeFakeTree();
      mockFamilyTreeFindOne.mockResolvedValue(fakeTree);
      mockAdminMemberships([FAKE_USER_ID]);

      const result = await softDeleteTree(FAKE_TREE_ID, FAKE_USER_ID);

      expect(fakeTree.save).toHaveBeenCalled();
      expect(result.id).toBe(FAKE_TREE_ID);
    });

    it('throws NotFoundError when tree does not exist', async () => {
      mockFamilyTreeFindOne.mockResolvedValue(null);

      await expect(
        softDeleteTree(FAKE_TREE_ID, FAKE_USER_ID)
      ).rejects.toThrow(NotFoundError);
    });

    it('throws ForbiddenError when user is not an admin', async () => {
      mockFamilyTreeFindOne.mockResolvedValue(makeFakeTree());
      const otherUserId = '507f1f77bcf86cd799439099';
      mockAdminMemberships([otherUserId]);

      await expect(
        softDeleteTree(FAKE_TREE_ID, FAKE_USER_ID)
      ).rejects.toThrow(ForbiddenError);
    });

    it('throws ForbiddenError when there are multiple admins', async () => {
      const otherUserId = '507f1f77bcf86cd799439099';
      mockFamilyTreeFindOne.mockResolvedValue(makeFakeTree());
      mockAdminMemberships([FAKE_USER_ID, otherUserId]);

      await expect(
        softDeleteTree(FAKE_TREE_ID, FAKE_USER_ID)
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe('restoreTree', () => {
    it(`restores a soft-deleted tree within ${RESTORE_WINDOW_DAYS} days`, async () => {
      const fakeTree = makeFakeTree({
        deletedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
        deletedBy: fakeObjectId(FAKE_USER_ID),
      });
      mockFamilyTreeFindOne.mockResolvedValue(fakeTree);

      const result = await restoreTree(FAKE_TREE_ID, FAKE_USER_ID);

      expect(fakeTree.save).toHaveBeenCalled();
      expect(result.id).toBe(FAKE_TREE_ID);
    });

    it('throws NotFoundError when tree is not found or not deleted', async () => {
      mockFamilyTreeFindOne.mockResolvedValue(null);

      await expect(
        restoreTree(FAKE_TREE_ID, FAKE_USER_ID)
      ).rejects.toThrow(NotFoundError);
    });

    it('throws ForbiddenError when user is not the one who deleted the tree', async () => {
      const otherUserId = '507f1f77bcf86cd799439099';
      const fakeTree = makeFakeTree({
        deletedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        deletedBy: fakeObjectId(otherUserId),
      });
      mockFamilyTreeFindOne.mockResolvedValue(fakeTree);

      await expect(
        restoreTree(FAKE_TREE_ID, FAKE_USER_ID)
      ).rejects.toThrow(ForbiddenError);
    });

    it(`throws ValidationError when ${RESTORE_WINDOW_DAYS}-day restore window has expired`, async () => {
      const fakeTree = makeFakeTree({
        deletedAt: new Date(Date.now() - (RESTORE_WINDOW_DAYS + 1) * 24 * 60 * 60 * 1000),
        deletedBy: fakeObjectId(FAKE_USER_ID),
      });
      mockFamilyTreeFindOne.mockResolvedValue(fakeTree);

      await expect(
        restoreTree(FAKE_TREE_ID, FAKE_USER_ID)
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('listUserTrees', () => {
    it('returns all active trees where user has membership', async () => {
      const tree1 = makeFakeTree({ _id: fakeObjectId('tree-1'), name: 'Tree 1' });
      const tree2 = makeFakeTree({ _id: fakeObjectId('tree-2'), name: 'Tree 2' });

      mockMembershipAggregate.mockResolvedValue([tree1, tree2]);

      const result = await listUserTrees(FAKE_USER_ID);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Tree 1');
      expect(result[1].name).toBe('Tree 2');
    });

    it('returns empty array when user has no memberships', async () => {
      mockMembershipAggregate.mockResolvedValue([]);

      const result = await listUserTrees(FAKE_USER_ID);

      expect(result).toEqual([]);
    });
  });
});
