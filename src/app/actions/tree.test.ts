import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTreeAction, updateTreeAction, ActionState } from './tree';
import {
  ConflictError,
  ValidationError,
  ForbiddenError,
} from '@/lib/utils/errors';

// --- Mocks ---

const mockVerifySession = vi.fn();
const mockCreateTree = vi.fn();
const mockUpdateTree = vi.fn();
const mockRevalidatePath = vi.fn();
const mockRedirect = vi.fn();

vi.mock('@/lib/auth/session', () => ({
  verifySession: (...args: unknown[]) => mockVerifySession(...args),
}));

vi.mock('@/lib/services/tree.service', () => ({
  createTree: (...args: unknown[]) => mockCreateTree(...args),
  updateTree: (...args: unknown[]) => mockUpdateTree(...args),
}));

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

vi.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => {
    mockRedirect(...args);
    throw new Error('NEXT_REDIRECT');
  },
}));

// --- Helpers ---

function createFormData(data: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(data)) {
    formData.set(key, value);
  }
  return formData;
}

const mockSession = {
  sessionId: 'session-123',
  userId: '507f1f77bcf86cd799439011',
  token: 'token-abc',
  expiresAt: new Date('2025-01-08T00:00:00.000Z'),
  createdAt: new Date('2025-01-01T00:00:00.000Z'),
};

// --- Tests ---

describe('createTreeAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns error when not authenticated', async () => {
    mockVerifySession.mockResolvedValue(null);

    const formData = createFormData({ name: 'Test Tree' });
    const result = await createTreeAction(null, formData);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('NOT_AUTHENTICATED');
    expect(mockCreateTree).not.toHaveBeenCalled();
  });

  it('returns validation error when name is missing', async () => {
    mockVerifySession.mockResolvedValue(mockSession);

    const formData = new FormData();
    const result = await createTreeAction(null, formData);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('INVALID_INPUT');
  });

  it('returns validation error when name is empty', async () => {
    mockVerifySession.mockResolvedValue(mockSession);

    const formData = createFormData({ name: '' });
    const result = await createTreeAction(null, formData);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('INVALID_INPUT');
  });

  it('returns validation error when name exceeds 100 characters', async () => {
    mockVerifySession.mockResolvedValue(mockSession);

    const formData = createFormData({ name: 'a'.repeat(101) });
    const result = await createTreeAction(null, formData);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('INVALID_INPUT');
  });

  it('creates tree and redirects on success', async () => {
    mockVerifySession.mockResolvedValue(mockSession);
    mockCreateTree.mockResolvedValue({
      tree: {
        id: '507f1f77bcf86cd799439022',
        name: 'New Family',
        description: null,
        createdBy: '507f1f77bcf86cd799439011',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        deletedBy: null,
        totalStorageBytes: 0,
        storageLimit: 524288000,
      },
      membership: {
        id: '507f1f77bcf86cd799439033',
        userId: '507f1f77bcf86cd799439011',
        treeId: '507f1f77bcf86cd799439022',
        role: 'admin',
        joinedAt: new Date(),
      },
    });

    const formData = createFormData({ name: 'New Family' });

    // redirect throws, so we expect the action to throw
    await expect(createTreeAction(null, formData)).rejects.toThrow(
      'NEXT_REDIRECT'
    );

    expect(mockCreateTree).toHaveBeenCalledWith('507f1f77bcf86cd799439011', {
      name: 'New Family',
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard');
    expect(mockRedirect).toHaveBeenCalledWith('/trees/507f1f77bcf86cd799439022');
  });

  it('creates tree with description', async () => {
    mockVerifySession.mockResolvedValue(mockSession);
    mockCreateTree.mockResolvedValue({
      tree: {
        id: '507f1f77bcf86cd799439022',
        name: 'Family Tree',
        description: 'A description',
        createdBy: '507f1f77bcf86cd799439011',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        deletedBy: null,
        totalStorageBytes: 0,
        storageLimit: 524288000,
      },
      membership: {
        id: '507f1f77bcf86cd799439033',
        userId: '507f1f77bcf86cd799439011',
        treeId: '507f1f77bcf86cd799439022',
        role: 'admin',
        joinedAt: new Date(),
      },
    });

    const formData = createFormData({
      name: 'Family Tree',
      description: 'A description',
    });

    await expect(createTreeAction(null, formData)).rejects.toThrow(
      'NEXT_REDIRECT'
    );

    expect(mockCreateTree).toHaveBeenCalledWith('507f1f77bcf86cd799439011', {
      name: 'Family Tree',
      description: 'A description',
    });
  });

  it('returns conflict error when tree name already exists', async () => {
    mockVerifySession.mockResolvedValue(mockSession);
    mockCreateTree.mockRejectedValue(
      new ConflictError(
        'A family tree with this name already exists',
        'TREE_NAME_EXISTS',
        { field: 'name' }
      )
    );

    const formData = createFormData({ name: 'Existing Tree' });
    const result = await createTreeAction(null, formData);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('TREE_NAME_EXISTS');
    expect(result.error?.field).toBe('name');
  });

  it('returns error when tree limit is reached', async () => {
    mockVerifySession.mockResolvedValue(mockSession);
    mockCreateTree.mockRejectedValue(
      new ValidationError(
        'You have reached the maximum limit of 20 family trees',
        'TREE_LIMIT_REACHED'
      )
    );

    const formData = createFormData({ name: 'Another Tree' });
    const result = await createTreeAction(null, formData);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('TREE_LIMIT_REACHED');
  });

  it('returns generic error on unexpected failures', async () => {
    mockVerifySession.mockResolvedValue(mockSession);
    mockCreateTree.mockRejectedValue(new Error('DB connection failed'));

    const formData = createFormData({ name: 'Test Tree' });
    const result = await createTreeAction(null, formData);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('INTERNAL_ERROR');
    expect(result.error?.message).toBe(
      'An unexpected error occurred. Please try again.'
    );
  });
});

describe('updateTreeAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns error when not authenticated', async () => {
    mockVerifySession.mockResolvedValue(null);

    const formData = createFormData({
      treeId: '507f1f77bcf86cd799439022',
      name: 'Updated Name',
    });
    const result = await updateTreeAction(null, formData);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('NOT_AUTHENTICATED');
    expect(mockUpdateTree).not.toHaveBeenCalled();
  });

  it('returns error when treeId is missing', async () => {
    mockVerifySession.mockResolvedValue(mockSession);

    const formData = createFormData({ name: 'Updated Name' });
    const result = await updateTreeAction(null, formData);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('INVALID_INPUT');
    expect(result.error?.field).toBe('treeId');
  });

  it('returns validation error when name exceeds 100 characters', async () => {
    mockVerifySession.mockResolvedValue(mockSession);

    const formData = createFormData({
      treeId: '507f1f77bcf86cd799439022',
      name: 'a'.repeat(101),
    });
    const result = await updateTreeAction(null, formData);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('INVALID_INPUT');
  });

  it('updates tree name successfully', async () => {
    mockVerifySession.mockResolvedValue(mockSession);
    mockUpdateTree.mockResolvedValue({
      id: '507f1f77bcf86cd799439022',
      name: 'Updated Family',
      description: null,
      createdBy: '507f1f77bcf86cd799439011',
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      deletedBy: null,
      totalStorageBytes: 0,
      storageLimit: 524288000,
    });

    const formData = createFormData({
      treeId: '507f1f77bcf86cd799439022',
      name: 'Updated Family',
    });
    const result = await updateTreeAction(null, formData);

    expect(result.success).toBe(true);
    expect(result.data?.name).toBe('Updated Family');
    expect(mockUpdateTree).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439022',
      '507f1f77bcf86cd799439011',
      { name: 'Updated Family' }
    );
    expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard');
    expect(mockRevalidatePath).toHaveBeenCalledWith(
      '/trees/507f1f77bcf86cd799439022'
    );
  });

  it('updates tree description successfully', async () => {
    mockVerifySession.mockResolvedValue(mockSession);
    mockUpdateTree.mockResolvedValue({
      id: '507f1f77bcf86cd799439022',
      name: 'Family Tree',
      description: 'New description',
      createdBy: '507f1f77bcf86cd799439011',
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      deletedBy: null,
      totalStorageBytes: 0,
      storageLimit: 524288000,
    });

    const formData = createFormData({
      treeId: '507f1f77bcf86cd799439022',
      name: 'Family Tree',
      description: 'New description',
    });
    const result = await updateTreeAction(null, formData);

    expect(result.success).toBe(true);
    expect(result.data?.description).toBe('New description');
  });

  it('returns forbidden error when user lacks permissions', async () => {
    mockVerifySession.mockResolvedValue(mockSession);
    mockUpdateTree.mockRejectedValue(
      new ForbiddenError(
        'You do not have permission to update this family tree',
        'INSUFFICIENT_PERMISSIONS'
      )
    );

    const formData = createFormData({
      treeId: '507f1f77bcf86cd799439022',
      name: 'Updated Name',
    });
    const result = await updateTreeAction(null, formData);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('INSUFFICIENT_PERMISSIONS');
  });

  it('returns conflict error when name already exists', async () => {
    mockVerifySession.mockResolvedValue(mockSession);
    mockUpdateTree.mockRejectedValue(
      new ConflictError(
        'A family tree with this name already exists',
        'TREE_NAME_EXISTS',
        { field: 'name' }
      )
    );

    const formData = createFormData({
      treeId: '507f1f77bcf86cd799439022',
      name: 'Existing Name',
    });
    const result = await updateTreeAction(null, formData);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('TREE_NAME_EXISTS');
    expect(result.error?.field).toBe('name');
  });

  it('returns generic error on unexpected failures', async () => {
    mockVerifySession.mockResolvedValue(mockSession);
    mockUpdateTree.mockRejectedValue(new Error('DB connection failed'));

    const formData = createFormData({
      treeId: '507f1f77bcf86cd799439022',
      name: 'Test',
    });
    const result = await updateTreeAction(null, formData);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('INTERNAL_ERROR');
  });

  it('accepts previous state parameter', async () => {
    mockVerifySession.mockResolvedValue(mockSession);
    mockUpdateTree.mockResolvedValue({
      id: '507f1f77bcf86cd799439022',
      name: 'Updated',
      description: null,
      createdBy: '507f1f77bcf86cd799439011',
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      deletedBy: null,
      totalStorageBytes: 0,
      storageLimit: 524288000,
    });

    const prevState: ActionState = {
      success: false,
      error: { code: 'PREV_ERROR', message: 'Previous error' },
    };

    const formData = createFormData({
      treeId: '507f1f77bcf86cd799439022',
      name: 'Updated',
    });
    const result = await updateTreeAction(prevState, formData);

    expect(result.success).toBe(true);
  });
});
