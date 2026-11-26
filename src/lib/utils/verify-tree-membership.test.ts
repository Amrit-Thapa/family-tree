import { describe, it, expect, vi, beforeEach } from 'vitest';
import { verifyTreeMembership } from './verify-tree-membership';
import { NotFoundError } from '@/lib/utils/errors';

// --- Mocks ---

vi.mock('@/lib/db/connection', () => ({
  connectDB: vi.fn(async () => { }),
}));

const mockMembershipFindOne = vi.fn();

vi.mock('@/lib/db/models/Membership', () => ({
  default: {
    findOne: (...args: unknown[]) => mockMembershipFindOne(...args),
  },
}));

// --- Helpers ---

const VALID_USER_ID = '507f1f77bcf86cd799439011';
const VALID_TREE_ID = '507f1f77bcf86cd799439022';
const MEMBERSHIP_ID = '507f1f77bcf86cd799439033';

function fakeObjectId(value: string) {
  return { toString: () => value };
}

function mockLeanResult(role: string) {
  return {
    lean: vi.fn().mockResolvedValue({
      _id: fakeObjectId(MEMBERSHIP_ID),
      role,
    }),
  };
}

// --- Tests ---

describe('verifyTreeMembership', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns role and membershipId for a valid membership', async () => {
    mockMembershipFindOne.mockReturnValue(mockLeanResult('editor'));

    const result = await verifyTreeMembership(VALID_USER_ID, VALID_TREE_ID);

    expect(result.role).toBe('editor');
    expect(result.membershipId).toBe(MEMBERSHIP_ID);
  });

  it('filters by a single required role', async () => {
    mockMembershipFindOne.mockReturnValue(mockLeanResult('admin'));

    const result = await verifyTreeMembership(VALID_USER_ID, VALID_TREE_ID, 'admin');

    expect(result.role).toBe('admin');
    // Verify the query included the role filter
    const query = mockMembershipFindOne.mock.calls[0][0];
    expect(query.role).toBe('admin');
  });

  it('filters by an array of required roles using $in', async () => {
    mockMembershipFindOne.mockReturnValue(mockLeanResult('editor'));

    const result = await verifyTreeMembership(
      VALID_USER_ID,
      VALID_TREE_ID,
      ['admin', 'editor']
    );

    expect(result.role).toBe('editor');
    const query = mockMembershipFindOne.mock.calls[0][0];
    expect(query.role).toEqual({ $in: ['admin', 'editor'] });
  });

  it('throws NotFoundError for an invalid treeId format', async () => {
    await expect(
      verifyTreeMembership(VALID_USER_ID, 'not-a-valid-id')
    ).rejects.toThrow(NotFoundError);

    // Should not even hit the DB
    expect(mockMembershipFindOne).not.toHaveBeenCalled();
  });

  it('throws NotFoundError when no membership exists', async () => {
    mockMembershipFindOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
    });

    await expect(
      verifyTreeMembership(VALID_USER_ID, VALID_TREE_ID)
    ).rejects.toThrow(NotFoundError);
  });

  it('throws NotFoundError when user lacks the required role', async () => {
    mockMembershipFindOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
    });

    await expect(
      verifyTreeMembership(VALID_USER_ID, VALID_TREE_ID, 'admin')
    ).rejects.toThrow(NotFoundError);
  });
});
