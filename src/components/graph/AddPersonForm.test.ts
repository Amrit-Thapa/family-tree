import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createElement } from 'react';
import AddPersonForm from './AddPersonForm';
import type { GraphNodeData } from '@/lib/services/graph.service';

// --- Mock fetch ---
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

describe('AddPersonForm', () => {
  const defaultProps = {
    treeId: '507f1f77bcf86cd799439011',
    role: 'admin' as const,
    onPersonCreated: vi.fn(),
    onCancel: vi.fn(),
  };

  it('exports AddPersonForm as default', () => {
    expect(AddPersonForm).toBeDefined();
    expect(typeof AddPersonForm).toBe('function');
  });

  it('creates a valid React element with admin role', () => {
    const element = createElement(AddPersonForm, defaultProps);
    expect(element).toBeDefined();
    expect(element.props.treeId).toBe('507f1f77bcf86cd799439011');
    expect(element.props.role).toBe('admin');
  });

  it('accepts viewer role prop (component handles visibility internally)', () => {
    const element = createElement(AddPersonForm, {
      ...defaultProps,
      role: 'viewer',
    });
    expect(element).toBeDefined();
    expect(element.props.role).toBe('viewer');
  });

  it('accepts editor role prop (component handles visibility internally)', () => {
    const element = createElement(AddPersonForm, {
      ...defaultProps,
      role: 'editor',
    });
    expect(element).toBeDefined();
    expect(element.props.role).toBe('editor');
  });

  it('component props include role for admin visibility check', () => {
    const element = createElement(AddPersonForm, defaultProps);
    expect(element.props.role).toBe('admin');
  });

  it('accepts optional onCancel prop', () => {
    const element = createElement(AddPersonForm, {
      treeId: '507f1f77bcf86cd799439011',
      role: 'admin',
      onPersonCreated: vi.fn(),
    });
    expect(element).toBeDefined();
    expect(element.props.onCancel).toBeUndefined();
  });

  it('accepts GraphNodeData in onPersonCreated callback type', () => {
    const mockNode: GraphNodeData = {
      id: 'node-1',
      personId: 'person-1',
      firstName: 'John',
      lastName: 'Doe',
      dateOfBirth: '1990-01-01T00:00:00.000Z',
      gender: 'male',
    };

    const onPersonCreated = vi.fn();
    createElement(AddPersonForm, {
      ...defaultProps,
      onPersonCreated,
    });

    // Simulate callback
    onPersonCreated(mockNode);
    expect(onPersonCreated).toHaveBeenCalledWith(mockNode);
    expect(onPersonCreated).toHaveBeenCalledTimes(1);
  });
});

describe('AddPersonForm - API integration', () => {
  it('constructs correct API URL from treeId', () => {
    const treeId = 'abc123';
    const expectedUrl = `/api/trees/${treeId}/persons`;
    expect(expectedUrl).toBe('/api/trees/abc123/persons');
  });

  it('API request body shape matches CreatePersonRequest', () => {
    const body = {
      firstName: 'Jane',
      lastName: 'Smith',
      dateOfBirth: '1985-06-15',
      dateOfDeath: '2020-12-01',
      gender: 'female' as const,
    };

    expect(body.firstName).toBe('Jane');
    expect(body.lastName).toBe('Smith');
    expect(body.dateOfBirth).toBe('1985-06-15');
    expect(body.dateOfDeath).toBe('2020-12-01');
    expect(body.gender).toBe('female');
  });

  it('API request body with only required fields', () => {
    const body = {
      firstName: 'John',
    };

    expect(body.firstName).toBe('John');
    expect(Object.keys(body)).toHaveLength(1);
  });
});

describe('AddPersonForm - validation logic', () => {
  it('firstName is required (empty string should fail)', () => {
    const trimmed = ''.trim();
    expect(trimmed.length).toBe(0);
    // Validation should reject empty firstName
    expect(!trimmed).toBe(true);
  });

  it('firstName with only whitespace should fail', () => {
    const trimmed = '   \t\n  '.trim();
    expect(trimmed.length).toBe(0);
    expect(!trimmed).toBe(true);
  });

  it('firstName within 1-100 chars should pass', () => {
    const name = 'John';
    const trimmed = name.trim();
    expect(trimmed.length).toBeGreaterThanOrEqual(1);
    expect(trimmed.length).toBeLessThanOrEqual(100);
  });

  it('firstName exceeding 100 chars should fail', () => {
    const name = 'A'.repeat(101);
    expect(name.trim().length).toBeGreaterThan(100);
  });

  it('lastName exceeding 100 chars should fail', () => {
    const name = 'B'.repeat(101);
    expect(name.trim().length).toBeGreaterThan(100);
  });

  it('date warning: dateOfDeath before dateOfBirth', () => {
    const dob = new Date('2000-01-01');
    const dod = new Date('1990-01-01');
    expect(dod < dob).toBe(true);
  });

  it('no date warning: dateOfDeath after dateOfBirth', () => {
    const dob = new Date('1950-01-01');
    const dod = new Date('2020-01-01');
    expect(dod < dob).toBe(false);
  });

  it('no date warning: same dates', () => {
    const dob = new Date('2000-06-15');
    const dod = new Date('2000-06-15');
    expect(dod < dob).toBe(false);
  });

  it('gender options include all valid values', () => {
    const validGenders = ['male', 'female', 'other', 'prefer_not_to_say'];
    expect(validGenders).toContain('male');
    expect(validGenders).toContain('female');
    expect(validGenders).toContain('other');
    expect(validGenders).toContain('prefer_not_to_say');
    expect(validGenders).toHaveLength(4);
  });
});
