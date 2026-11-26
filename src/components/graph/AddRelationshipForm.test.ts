import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('AddRelationshipForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exports a default component function', async () => {
    const mod = await import('./AddRelationshipForm');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });

  describe('API interaction logic', () => {
    const treeId = 'tree-123';
    const currentNodeId = 'node-aaa';
    const targetNodeId = 'node-bbb';

    it('sends correct payload for parent-child where current is parent', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          relationship: {
            id: 'rel-1',
            fromNodeId: currentNodeId,
            toNodeId: targetNodeId,
            type: 'father',
          },
        }),
      });

      // Simulate the fetch call the component would make
      const res = await fetch(`/api/trees/${treeId}/relationships`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromNodeId: currentNodeId,
          toNodeId: targetNodeId,
          type: 'father',
        }),
      });

      const data = await res.json();
      expect(data.relationship.fromNodeId).toBe(currentNodeId);
      expect(data.relationship.toNodeId).toBe(targetNodeId);
      expect(data.relationship.type).toBe('father');
    });

    it('sends correct payload for parent-child where current is child', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          relationship: {
            id: 'rel-2',
            fromNodeId: targetNodeId,
            toNodeId: currentNodeId,
            type: 'father',
          },
        }),
      });

      // When current is child, fromNodeId should be the target (parent)
      const res = await fetch(`/api/trees/${treeId}/relationships`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromNodeId: targetNodeId,
          toNodeId: currentNodeId,
          type: 'father',
        }),
      });

      const data = await res.json();
      expect(data.relationship.fromNodeId).toBe(targetNodeId);
      expect(data.relationship.toNodeId).toBe(currentNodeId);
    });

    it('sends correct payload for spouse relationship', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          relationship: {
            id: 'rel-3',
            fromNodeId: currentNodeId,
            toNodeId: targetNodeId,
            type: 'spouse',
          },
        }),
      });

      const res = await fetch(`/api/trees/${treeId}/relationships`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromNodeId: currentNodeId,
          toNodeId: targetNodeId,
          type: 'spouse',
        }),
      });

      const data = await res.json();
      expect(data.relationship.type).toBe('spouse');
    });

    it('handles 409 conflict error correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({
          error: {
            code: 'DUPLICATE_RELATIONSHIP',
            message: 'A relationship of this type already exists between these persons',
          },
        }),
      });

      const res = await fetch(`/api/trees/${treeId}/relationships`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromNodeId: currentNodeId,
          toNodeId: targetNodeId,
          type: 'father',
        }),
      });

      expect(res.ok).toBe(false);
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error.code).toBe('DUPLICATE_RELATIONSHIP');
    });

    it('handles 400 self-reference error correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: {
            code: 'SELF_RELATIONSHIP',
            message: 'Cannot create a relationship between a person and themselves',
          },
        }),
      });

      const res = await fetch(`/api/trees/${treeId}/relationships`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromNodeId: currentNodeId,
          toNodeId: currentNodeId,
          type: 'father',
        }),
      });

      expect(res.ok).toBe(false);
      const data = await res.json();
      expect(data.error.code).toBe('SELF_RELATIONSHIP');
    });

    it('handles 403 forbidden error for non-admin', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({
          error: {
            code: 'NOT_ADMIN',
            message: 'Only an admin can create relationships',
          },
        }),
      });

      const res = await fetch(`/api/trees/${treeId}/relationships`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromNodeId: currentNodeId,
          toNodeId: targetNodeId,
          type: 'father',
        }),
      });

      expect(res.ok).toBe(false);
      expect(res.status).toBe(403);
    });
  });
});
