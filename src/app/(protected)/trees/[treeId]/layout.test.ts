import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks ---

const mockVerifySession = vi.fn();
const mockConnectDB = vi.fn();
const mockFamilyTreeFindOne = vi.fn();
const mockMembershipFindOne = vi.fn();
const mockNotFound = vi.fn();

vi.mock('@/lib/auth/session', () => ({
  verifySession: (...args: unknown[]) => mockVerifySession(...args),
}));

vi.mock('@/lib/db/connection', () => ({
  connectDB: (...args: unknown[]) => mockConnectDB(...args),
}));

vi.mock('@/lib/db/models/FamilyTree', () => ({
  default: {
    findOne: (...args: unknown[]) => mockFamilyTreeFindOne(...args),
  },
}));

vi.mock('@/lib/db/models/Membership', () => ({
  default: {
    findOne: (...args: unknown[]) => mockMembershipFindOne(...args),
  },
}));

vi.mock('@/components/tree/TreeProvider', () => ({
  default: ({ children, tree, role, membershipId }: {
    children: unknown;
    tree: unknown;
    role: string;
    membershipId: string;
  }) => ({ type: 'TreeProvider', props: { children, tree, role, membershipId } }),
}));

vi.mock('next/navigation', () => ({
  notFound: (...args: unknown[]) => {
    mockNotFound(...args);
    throw new Error('NEXT_NOT_FOUND');
  },
}));

// Import the layout after mocks are set up
import TreeLayout from './layout';

// --- Helpers ---

const VALID_TREE_ID = '507f1f77bcf86cd799439011';
const VALID_USER_ID = '507f1f77bcf86cd799439022';

function createParams(treeId: string): Promise<{ treeId: string }> {
  return Promise.resolve({ treeId });
}

function createSession(userId: string = VALID_USER_ID) {
  return {
    sessionId: 'session-1',
    userId,
    token: 'token-1',
    expiresAt: new Date(),
    createdAt: new Date(),
  };
}

function createTree(overrides = {}) {
  return {
    _id: { toString: () => VALID_TREE_ID },
    name: 'Test Family Tree',
    description: 'A test tree',
    createdBy: { toString: () => VALID_USER_ID },
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-02'),
    deletedAt: null,
    ...overrides,
  };
}

function createMembership(role: string = 'admin', overrides = {}) {
  return {
    _id: { toString: () => 'membership-1' },
    userId: { toString: () => VALID_USER_ID },
    treeId: { toString: () => VALID_TREE_ID },
    role,
    joinedAt: new Date('2024-01-01'),
    deletedAt: null,
    ...overrides,
  };
}

// --- Tests ---

describe('TreeLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConnectDB.mockResolvedValue(undefined);
  });

  it('calls notFound when session is null', async () => {
    mockVerifySession.mockResolvedValue(null);

    await expect(
      TreeLayout({ children: null, params: createParams(VALID_TREE_ID) })
    ).rejects.toThrow('NEXT_NOT_FOUND');

    expect(mockNotFound).toHaveBeenCalled();
  });

  it('calls notFound when treeId is not a valid ObjectId', async () => {
    mockVerifySession.mockResolvedValue(createSession());

    await expect(
      TreeLayout({ children: null, params: createParams('invalid-id') })
    ).rejects.toThrow('NEXT_NOT_FOUND');

    expect(mockNotFound).toHaveBeenCalled();
  });

  it('calls notFound when tree does not exist', async () => {
    mockVerifySession.mockResolvedValue(createSession());
    mockFamilyTreeFindOne.mockReturnValue({
      lean: () => Promise.resolve(null),
    });

    await expect(
      TreeLayout({ children: null, params: createParams(VALID_TREE_ID) })
    ).rejects.toThrow('NEXT_NOT_FOUND');

    expect(mockNotFound).toHaveBeenCalled();
  });

  it('calls notFound when user has no membership in the tree', async () => {
    mockVerifySession.mockResolvedValue(createSession());
    mockFamilyTreeFindOne.mockReturnValue({
      lean: () => Promise.resolve(createTree()),
    });
    mockMembershipFindOne.mockReturnValue({
      lean: () => Promise.resolve(null),
    });

    await expect(
      TreeLayout({ children: null, params: createParams(VALID_TREE_ID) })
    ).rejects.toThrow('NEXT_NOT_FOUND');

    expect(mockNotFound).toHaveBeenCalled();
  });

  it('renders TreeProvider with correct props when user has membership', async () => {
    mockVerifySession.mockResolvedValue(createSession());
    mockFamilyTreeFindOne.mockReturnValue({
      lean: () => Promise.resolve(createTree()),
    });
    mockMembershipFindOne.mockReturnValue({
      lean: () => Promise.resolve(createMembership('editor')),
    });

    const result = await TreeLayout({
      children: 'child content',
      params: createParams(VALID_TREE_ID),
    }) as { props: { children: unknown; tree: unknown; role: string; membershipId: string } };

    expect(mockNotFound).not.toHaveBeenCalled();
    expect(result).toBeDefined();
    expect(result.props.children).toBe('child content');
    expect(result.props.role).toBe('editor');
    expect(result.props.membershipId).toBe('membership-1');
    expect(result.props.tree).toMatchObject({
      id: VALID_TREE_ID,
      name: 'Test Family Tree',
      description: 'A test tree',
      createdBy: VALID_USER_ID,
    });
  });

  it('renders TreeProvider with admin role', async () => {
    mockVerifySession.mockResolvedValue(createSession());
    mockFamilyTreeFindOne.mockReturnValue({
      lean: () => Promise.resolve(createTree()),
    });
    mockMembershipFindOne.mockReturnValue({
      lean: () => Promise.resolve(createMembership('admin')),
    });

    const result = await TreeLayout({
      children: 'child content',
      params: createParams(VALID_TREE_ID),
    }) as { props: { role: string } };

    expect(result.props.role).toBe('admin');
  });

  it('renders TreeProvider with viewer role', async () => {
    mockVerifySession.mockResolvedValue(createSession());
    mockFamilyTreeFindOne.mockReturnValue({
      lean: () => Promise.resolve(createTree()),
    });
    mockMembershipFindOne.mockReturnValue({
      lean: () => Promise.resolve(createMembership('viewer')),
    });

    const result = await TreeLayout({
      children: 'child content',
      params: createParams(VALID_TREE_ID),
    }) as { props: { role: string } };

    expect(result.props.role).toBe('viewer');
  });

  it('handles tree with null description', async () => {
    mockVerifySession.mockResolvedValue(createSession());
    mockFamilyTreeFindOne.mockReturnValue({
      lean: () => Promise.resolve(createTree({ description: undefined })),
    });
    mockMembershipFindOne.mockReturnValue({
      lean: () => Promise.resolve(createMembership('admin')),
    });

    const result = await TreeLayout({
      children: 'child content',
      params: createParams(VALID_TREE_ID),
    }) as { props: { tree: { description: string | null } } };

    expect(result.props.tree.description).toBeNull();
  });
});
