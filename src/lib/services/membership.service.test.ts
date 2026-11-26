import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getMembers,
  changeMemberRole,
  removeMember,
  getMembership,
} from './membership.service';
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '@/lib/utils/errors';

// --- Mocks ---

vi.mock('@/lib/db/connection', () => ({
  connectDB: vi.fn(async () => { }),
}));

// Mock the transaction utility to run callbacks directly without a real DB session
vi.mock('@/lib/utils/transaction', () => ({
  withOptionalTransaction: vi.fn((fn: (session: null) => Promise<unknown>) => fn(null)),
}));

// Mock Membership model
const mockMembershipFindOne = vi.fn();
const mockMembershipFind = vi.fn();
const mockMembershipCountDocuments = vi.fn();

vi.mock('@/lib/db/models/Membership', () => ({
  default: {
    findOne: (...args: unknown[]) => mockMembershipFindOne(...args),
    find: (...args: unknown[]) => mockMembershipFind(...args),
    countDocuments: (...args: unknown[]) => mockMembershipCountDocuments(...args),
  },
}));

// --- Helpers ---

const FAKE_USER_ID = '507f1f77bcf86cd799439011';
const FAKE_TARGET_USER_ID = '507f1f77bcf86cd799439022';
const FAKE_TREE_ID = '507f1f77bcf86cd799439033';

function fakeObjectId(value: string) {
  return {
    toString: () => value,
    equals: (id: unknown) => id?.toString?.() === value,
  };
}

function makeFakeMembership(overrides = {}) {
  return {
    _id: fakeObjectId('membership-id-1'),
    userId: fakeObjectId(FAKE_USER_ID),
    treeId: fakeObjectId(FAKE_TREE_ID),
    role: 'admin',
    joinedAt: new Date('2024-01-01'),
    invitedBy: null,
    deletedAt: null,
    deletedBy: null,
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// --- Tests ---

describe('membership.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getMembers', () => {
    it('returns all active members of a tree', async () => {
      const member1 = makeFakeMembership({
        _id: fakeObjectId('m1'),
        userId: fakeObjectId(FAKE_USER_ID),
        role: 'admin',
      });
      const member2 = makeFakeMembership({
        _id: fakeObjectId('m2'),
        userId: fakeObjectId(FAKE_TARGET_USER_ID),
        role: 'editor',
      });

      mockMembershipFind.mockReturnValue({
        sort: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([member1, member2]),
        }),
      });

      const result = await getMembers(FAKE_TREE_ID);

      expect(result).toHaveLength(2);
      expect(result[0].userId).toBe(FAKE_USER_ID);
      expect(result[0].role).toBe('admin');
      expect(result[1].userId).toBe(FAKE_TARGET_USER_ID);
      expect(result[1].role).toBe('editor');
    });

    it('returns empty array when tree has no members', async () => {
      mockMembershipFind.mockReturnValue({
        sort: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([]),
        }),
      });

      const result = await getMembers(FAKE_TREE_ID);

      expect(result).toEqual([]);
    });

    it('throws ValidationError for invalid treeId format', async () => {
      await expect(getMembers('invalid-id')).rejects.toThrow(ValidationError);
    });
  });

  describe('changeMemberRole', () => {
    it('changes a member role when actor is admin', async () => {
      const actorMembership = makeFakeMembership({
        userId: fakeObjectId(FAKE_USER_ID),
        role: 'admin',
      });
      const targetMembership = makeFakeMembership({
        _id: fakeObjectId('target-m'),
        userId: fakeObjectId(FAKE_TARGET_USER_ID),
        role: 'editor',
      });

      mockMembershipFindOne
        .mockResolvedValueOnce(actorMembership) // Actor is admin
        .mockResolvedValueOnce(targetMembership); // Target found

      const result = await changeMemberRole(
        FAKE_TREE_ID,
        FAKE_TARGET_USER_ID,
        'viewer',
        FAKE_USER_ID
      );

      expect(targetMembership.save).toHaveBeenCalled();
      expect(result.role).toBe('viewer');
    });

    it('returns early without saving when role is already the same', async () => {
      const actorMembership = makeFakeMembership({
        userId: fakeObjectId(FAKE_USER_ID),
        role: 'admin',
      });
      const targetMembership = makeFakeMembership({
        _id: fakeObjectId('target-m'),
        userId: fakeObjectId(FAKE_TARGET_USER_ID),
        role: 'editor',
      });

      mockMembershipFindOne
        .mockResolvedValueOnce(actorMembership)
        .mockResolvedValueOnce(targetMembership);

      const result = await changeMemberRole(
        FAKE_TREE_ID,
        FAKE_TARGET_USER_ID,
        'editor',
        FAKE_USER_ID
      );

      expect(targetMembership.save).not.toHaveBeenCalled();
      expect(result.role).toBe('editor');
    });

    it('throws ForbiddenError when actor is not an admin', async () => {
      mockMembershipFindOne.mockResolvedValueOnce(null); // Actor not admin

      await expect(
        changeMemberRole(FAKE_TREE_ID, FAKE_TARGET_USER_ID, 'viewer', FAKE_USER_ID)
      ).rejects.toThrow(ForbiddenError);
    });

    it('throws NotFoundError when target member does not exist', async () => {
      const actorMembership = makeFakeMembership({
        userId: fakeObjectId(FAKE_USER_ID),
        role: 'admin',
      });

      mockMembershipFindOne
        .mockResolvedValueOnce(actorMembership) // Actor is admin
        .mockResolvedValueOnce(null); // Target not found

      await expect(
        changeMemberRole(FAKE_TREE_ID, FAKE_TARGET_USER_ID, 'viewer', FAKE_USER_ID)
      ).rejects.toThrow(NotFoundError);
    });

    it('throws ForbiddenError when demoting the last admin', async () => {
      const actorMembership = makeFakeMembership({
        userId: fakeObjectId(FAKE_USER_ID),
        role: 'admin',
      });
      const targetMembership = makeFakeMembership({
        _id: fakeObjectId('target-m'),
        userId: fakeObjectId(FAKE_TARGET_USER_ID),
        role: 'admin',
      });

      mockMembershipFindOne
        .mockResolvedValueOnce(actorMembership) // Actor is admin
        .mockResolvedValueOnce(targetMembership); // Target is admin

      mockMembershipCountDocuments.mockResolvedValue(1); // Only 1 admin

      await expect(
        changeMemberRole(FAKE_TREE_ID, FAKE_TARGET_USER_ID, 'editor', FAKE_USER_ID)
      ).rejects.toThrow(ForbiddenError);
    });

    it('allows demoting an admin when there are multiple admins', async () => {
      const actorMembership = makeFakeMembership({
        userId: fakeObjectId(FAKE_USER_ID),
        role: 'admin',
      });
      const targetMembership = makeFakeMembership({
        _id: fakeObjectId('target-m'),
        userId: fakeObjectId(FAKE_TARGET_USER_ID),
        role: 'admin',
      });

      mockMembershipFindOne
        .mockResolvedValueOnce(actorMembership) // Actor is admin
        .mockResolvedValueOnce(targetMembership); // Target is admin

      mockMembershipCountDocuments.mockResolvedValue(2); // 2 admins

      const result = await changeMemberRole(
        FAKE_TREE_ID,
        FAKE_TARGET_USER_ID,
        'editor',
        FAKE_USER_ID
      );

      expect(targetMembership.save).toHaveBeenCalled();
      expect(result.role).toBe('editor');
    });

    it('throws ValidationError for invalid ID format', async () => {
      await expect(
        changeMemberRole('invalid', FAKE_TARGET_USER_ID, 'viewer', FAKE_USER_ID)
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('removeMember', () => {
    it('soft-deletes a member when actor is admin', async () => {
      const actorMembership = makeFakeMembership({
        userId: fakeObjectId(FAKE_USER_ID),
        role: 'admin',
      });
      const targetMembership = makeFakeMembership({
        _id: fakeObjectId('target-m'),
        userId: fakeObjectId(FAKE_TARGET_USER_ID),
        role: 'editor',
      });

      mockMembershipFindOne
        .mockResolvedValueOnce(actorMembership) // Actor is admin
        .mockResolvedValueOnce(targetMembership); // Target found

      const result = await removeMember(
        FAKE_TREE_ID,
        FAKE_TARGET_USER_ID,
        FAKE_USER_ID
      );

      expect(targetMembership.save).toHaveBeenCalled();
      expect(targetMembership.deletedAt).toBeInstanceOf(Date);
      expect(result.userId).toBe(FAKE_TARGET_USER_ID);
    });

    it('throws ForbiddenError when actor is not an admin', async () => {
      mockMembershipFindOne.mockResolvedValueOnce(null); // Actor not admin

      await expect(
        removeMember(FAKE_TREE_ID, FAKE_TARGET_USER_ID, FAKE_USER_ID)
      ).rejects.toThrow(ForbiddenError);
    });

    it('throws NotFoundError when target member does not exist', async () => {
      const actorMembership = makeFakeMembership({
        userId: fakeObjectId(FAKE_USER_ID),
        role: 'admin',
      });

      mockMembershipFindOne
        .mockResolvedValueOnce(actorMembership) // Actor is admin
        .mockResolvedValueOnce(null); // Target not found

      await expect(
        removeMember(FAKE_TREE_ID, FAKE_TARGET_USER_ID, FAKE_USER_ID)
      ).rejects.toThrow(NotFoundError);
    });

    it('throws ForbiddenError when removing the last admin', async () => {
      const actorMembership = makeFakeMembership({
        userId: fakeObjectId(FAKE_USER_ID),
        role: 'admin',
      });
      const targetMembership = makeFakeMembership({
        _id: fakeObjectId('target-m'),
        userId: fakeObjectId(FAKE_TARGET_USER_ID),
        role: 'admin',
      });

      mockMembershipFindOne
        .mockResolvedValueOnce(actorMembership) // Actor is admin
        .mockResolvedValueOnce(targetMembership); // Target is admin

      mockMembershipCountDocuments.mockResolvedValue(1); // Only 1 admin

      await expect(
        removeMember(FAKE_TREE_ID, FAKE_TARGET_USER_ID, FAKE_USER_ID)
      ).rejects.toThrow(ForbiddenError);
    });

    it('allows removing an admin when there are multiple admins', async () => {
      const actorMembership = makeFakeMembership({
        userId: fakeObjectId(FAKE_USER_ID),
        role: 'admin',
      });
      const targetMembership = makeFakeMembership({
        _id: fakeObjectId('target-m'),
        userId: fakeObjectId(FAKE_TARGET_USER_ID),
        role: 'admin',
      });

      mockMembershipFindOne
        .mockResolvedValueOnce(actorMembership) // Actor is admin
        .mockResolvedValueOnce(targetMembership); // Target is admin

      mockMembershipCountDocuments.mockResolvedValue(2); // 2 admins

      const result = await removeMember(
        FAKE_TREE_ID,
        FAKE_TARGET_USER_ID,
        FAKE_USER_ID
      );

      expect(targetMembership.save).toHaveBeenCalled();
      expect(targetMembership.deletedAt).toBeInstanceOf(Date);
      expect(result.userId).toBe(FAKE_TARGET_USER_ID);
    });

    it('throws ValidationError for invalid ID format', async () => {
      await expect(
        removeMember('invalid', FAKE_TARGET_USER_ID, FAKE_USER_ID)
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('getMembership', () => {
    it('returns membership when user is an active member', async () => {
      const membership = makeFakeMembership({
        userId: fakeObjectId(FAKE_USER_ID),
        role: 'editor',
      });

      mockMembershipFindOne.mockReturnValue({
        lean: vi.fn().mockResolvedValue(membership),
      });

      const result = await getMembership(FAKE_USER_ID, FAKE_TREE_ID);

      expect(result).not.toBeNull();
      expect(result!.userId).toBe(FAKE_USER_ID);
      expect(result!.role).toBe('editor');
    });

    it('returns null when user is not a member', async () => {
      mockMembershipFindOne.mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      });

      const result = await getMembership(FAKE_USER_ID, FAKE_TREE_ID);

      expect(result).toBeNull();
    });

    it('throws ValidationError for invalid userId format', async () => {
      await expect(getMembership('invalid', FAKE_TREE_ID)).rejects.toThrow(
        ValidationError
      );
    });

    it('throws ValidationError for invalid treeId format', async () => {
      await expect(getMembership(FAKE_USER_ID, 'invalid')).rejects.toThrow(
        ValidationError
      );
    });
  });
});
