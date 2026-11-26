import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import PersonNode from './PersonNode';
import type { PersonNodeData } from './PersonNode';

describe('PersonNode', () => {
  it('exports PersonNode as default', () => {
    expect(PersonNode).toBeDefined();
    expect(typeof PersonNode).toBe('object'); // memo wraps it as an object
  });

  it('has displayName set for debugging', () => {
    expect(PersonNode.displayName).toBe('PersonNode');
  });

  it('PersonNodeData interface supports required fields', () => {
    const data: PersonNodeData = {
      firstName: 'John',
      isCurrentUser: false,
    };

    expect(data.firstName).toBe('John');
    expect(data.isCurrentUser).toBe(false);
    expect(data.lastName).toBeUndefined();
    expect(data.profilePhotoUrl).toBeUndefined();
    expect(data.linkedUserId).toBeUndefined();
  });

  it('PersonNodeData interface supports all optional fields', () => {
    const data: PersonNodeData = {
      firstName: 'Jane',
      lastName: 'Doe',
      profilePhotoUrl: 'https://example.com/photo.jpg',
      linkedUserId: 'user-123',
      isCurrentUser: true,
    };

    expect(data.firstName).toBe('Jane');
    expect(data.lastName).toBe('Doe');
    expect(data.profilePhotoUrl).toBe('https://example.com/photo.jpg');
    expect(data.linkedUserId).toBe('user-123');
    expect(data.isCurrentUser).toBe(true);
  });

  it('PersonNodeData allows isCurrentUser to be false', () => {
    const data: PersonNodeData = {
      firstName: 'Bob',
      lastName: 'Smith',
      isCurrentUser: false,
    };

    expect(data.isCurrentUser).toBe(false);
  });
});
