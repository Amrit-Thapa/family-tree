'use client';

import { useState, type FormEvent } from 'react';
import type { GraphNodeData, GraphRelationshipData } from '@/lib/services/graph.service';

export interface AddRelationshipFormProps {
  treeId: string;
  currentNodeId: string;
  allNodes: GraphNodeData[];
  onRelationshipCreated: (relationship: GraphRelationshipData) => void;
  onClose: () => void;
}

type RelationshipType = 'father' | 'mother' | 'spouse';
type Direction = 'current_is_parent' | 'current_is_child';

/**
 * Form component for linking an existing person to the current person.
 * Admin-only.
 *
 * Supports:
 * - Father (current or target is father of the other)
 * - Mother (current or target is mother of the other)
 * - Spouse
 */
export default function AddRelationshipForm({
  treeId,
  currentNodeId,
  allNodes,
  onRelationshipCreated,
  onClose,
}: AddRelationshipFormProps) {
  const [targetNodeId, setTargetNodeId] = useState('');
  const [type, setType] = useState<RelationshipType>('father');
  const [direction, setDirection] = useState<Direction>('current_is_parent');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter out the current person from the dropdown options
  const availableNodes = allNodes.filter((node) => node.id !== currentNodeId);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!targetNodeId) {
      setError('Please select a person');
      return;
    }

    if (targetNodeId === currentNodeId) {
      setError('Cannot create relationship with self');
      return;
    }

    // Determine fromNodeId and toNodeId based on type and direction
    let fromNodeId: string;
    let toNodeId: string;

    if (type === 'father' || type === 'mother') {
      if (direction === 'current_is_parent') {
        // Current person is the father/mother of target
        fromNodeId = currentNodeId;
        toNodeId = targetNodeId;
      } else {
        // Target is the father/mother of current person
        fromNodeId = targetNodeId;
        toNodeId = currentNodeId;
      }
    } else {
      // Spouse: server normalizes direction
      fromNodeId = currentNodeId;
      toNodeId = targetNodeId;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/trees/${treeId}/relationships`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromNodeId, toNodeId, type }),
      });

      if (!res.ok) {
        const data = await res.json();
        const code = data.error?.code;
        const message = data.error?.message;

        if (res.status === 409) {
          setError(message || 'This relationship already exists');
        } else if (code === 'SELF_RELATIONSHIP') {
          setError('Cannot create relationship with self');
        } else {
          setError(message || 'Failed to create relationship');
        }
        return;
      }

      const data = await res.json();
      onRelationshipCreated(data.relationship);
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-900">Link Existing Person</h3>

      {error && (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {/* Target person dropdown */}
      <div>
        <label
          htmlFor="target-person"
          className="block text-sm font-medium text-gray-700"
        >
          Person
        </label>
        <select
          id="target-person"
          value={targetNodeId}
          onChange={(e) => setTargetNodeId(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          disabled={isSubmitting}
        >
          <option value="">Select a person</option>
          {availableNodes.map((node) => (
            <option key={node.id} value={node.id}>
              {node.firstName}
              {node.lastName ? ` ${node.lastName}` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Relationship type */}
      <div>
        <label
          htmlFor="relationship-type"
          className="block text-sm font-medium text-gray-700"
        >
          Relationship Type
        </label>
        <select
          id="relationship-type"
          value={type}
          onChange={(e) => setType(e.target.value as RelationshipType)}
          className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          disabled={isSubmitting}
        >
          <option value="father">Father</option>
          <option value="mother">Mother</option>
          <option value="spouse">Spouse</option>
        </select>
      </div>

      {/* Direction selector (only for father/mother) */}
      {(type === 'father' || type === 'mother') && (
        <fieldset>
          <legend className="block text-sm font-medium text-gray-700">
            Direction
          </legend>
          <div className="mt-2 space-y-2">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="radio"
                name="direction"
                value="current_is_parent"
                checked={direction === 'current_is_parent'}
                onChange={() => setDirection('current_is_parent')}
                disabled={isSubmitting}
                className="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              Current person is the {type}
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="radio"
                name="direction"
                value="current_is_child"
                checked={direction === 'current_is_child'}
                onChange={() => setDirection('current_is_child')}
                disabled={isSubmitting}
                className="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              Selected person is the {type}
            </label>
          </div>
        </fieldset>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={isSubmitting || !targetNodeId}
          className="flex-1 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? 'Adding...' : 'Add Relationship'}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
