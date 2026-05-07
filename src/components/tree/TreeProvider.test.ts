import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import TreeProvider, { useTree } from './TreeProvider';
import type { TreeData, TreeContextValue } from './TreeProvider';

const mockTree: TreeData = {
  id: '507f1f77bcf86cd799439011',
  name: 'Test Family Tree',
  description: 'A test tree',
  createdBy: '507f1f77bcf86cd799439022',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-02T00:00:00.000Z',
};

describe('TreeProvider', () => {
  it('exports TreeProvider as default', () => {
    expect(TreeProvider).toBeDefined();
    expect(typeof TreeProvider).toBe('function');
  });

  it('exports useTree hook', () => {
    expect(useTree).toBeDefined();
    expect(typeof useTree).toBe('function');
  });

  it('creates a valid React element with correct props', () => {
    const element = createElement(TreeProvider, {
      tree: mockTree,
      role: 'admin',
      membershipId: 'membership-1',
      children: createElement('div', null, 'child content'),
    });

    expect(element).toBeDefined();
    expect(element.props.tree).toEqual(mockTree);
    expect(element.props.role).toBe('admin');
    expect(element.props.membershipId).toBe('membership-1');
  });

  it('TreeContextValue type includes expected fields', () => {
    // Type-level test: ensure the interface shape is correct
    const mockContext: TreeContextValue = {
      tree: mockTree,
      role: 'editor',
      membershipId: 'membership-2',
    };

    expect(mockContext.tree.id).toBe('507f1f77bcf86cd799439011');
    expect(mockContext.role).toBe('editor');
    expect(mockContext.membershipId).toBe('membership-2');
  });
});
