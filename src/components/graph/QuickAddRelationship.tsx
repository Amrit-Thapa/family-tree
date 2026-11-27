'use client';

import { useMemo, useState, type FormEvent } from 'react';
import type { GraphNodeData, GraphRelationshipData } from '@/lib/services/graph.service';
import { formatDisplayName } from '@/lib/graph/format-name';
import {
  getCoParentForNewChild,
  getLinkCandidates,
  parentTypeFor,
  type QuickAddKind,
} from '@/lib/graph/link-suggestions';
import AddPersonForm from '@/components/graph/AddPersonForm';

export interface QuickAddRelationshipProps {
  treeId: string;
  person: GraphNodeData;
  kind: QuickAddKind;
  relationships: GraphRelationshipData[];
  allNodes: GraphNodeData[];
  onDone: () => void;
  onCancel: () => void;
}

const KIND_LABEL: Record<QuickAddKind, string> = {
  father: 'Father',
  mother: 'Mother',
  child: 'Child',
  spouse: 'Spouse',
};

const SELECT_CLASSES =
  'mt-1 block w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';

/**
 * Inline form behind the side panel's "+ Father / + Mother / + Child / + Spouse"
 * buttons. Lets the admin either link someone already in the tree (with likely
 * matches suggested first) or create a new person — so existing relatives are
 * never re-typed as duplicates.
 */
export default function QuickAddRelationship({
  treeId,
  person,
  kind,
  relationships,
  allNodes,
  onDone,
  onCancel,
}: QuickAddRelationshipProps) {
  const personName = formatDisplayName(person.firstName, person.lastName);

  // For "+ Child", the person's role comes from their gender; ask if unknown
  const inferredParentType = parentTypeFor(person.gender);
  const [parentType, setParentType] = useState<'father' | 'mother'>(inferredParentType ?? 'father');

  const candidates = useMemo(
    () =>
      getLinkCandidates(
        person.id,
        kind,
        relationships,
        allNodes,
        kind === 'child' ? parentType : undefined
      ),
    [person.id, kind, relationships, allNodes, parentType]
  );
  const suggested = candidates.filter((c) => c.suggested);
  const others = candidates.filter((c) => !c.suggested);

  const [mode, setMode] = useState<'existing' | 'new'>(candidates.length > 0 ? 'existing' : 'new');
  const [selectedId, setSelectedId] = useState(suggested.length === 1 ? suggested[0].node.id : '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedReason = candidates.find((c) => c.node.id === selectedId)?.reason;

  const coParent =
    kind === 'child' ? getCoParentForNewChild(person.id, parentType, relationships, allNodes) : null;

  async function handleLinkExisting(e: FormEvent) {
    e.preventDefault();
    if (!selectedId) {
      setError('Please choose a person');
      return;
    }
    setError(null);

    let body: { fromNodeId: string; toNodeId: string; type: 'father' | 'mother' | 'spouse' };
    if (kind === 'father' || kind === 'mother') {
      body = { fromNodeId: selectedId, toNodeId: person.id, type: kind };
    } else if (kind === 'child') {
      body = { fromNodeId: person.id, toNodeId: selectedId, type: parentType };
    } else {
      body = { fromNodeId: person.id, toNodeId: selectedId, type: 'spouse' };
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/trees/${treeId}/relationships`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error?.message || 'Could not link this person. Please try again.');
        return;
      }
      onDone();
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const parentTypeSelector =
    kind === 'child' && !inferredParentType ? (
      <div>
        <label htmlFor="quick-add-parent-type" className="block text-sm font-medium text-stone-700">
          {personName} is the child&apos;s
        </label>
        <select
          id="quick-add-parent-type"
          value={parentType}
          onChange={(e) => {
            setParentType(e.target.value as 'father' | 'mother');
            setSelectedId('');
          }}
          className={SELECT_CLASSES}
          disabled={isSubmitting}
        >
          <option value="father">Father</option>
          <option value="mother">Mother</option>
        </select>
      </div>
    ) : null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-stone-900">
        Add {KIND_LABEL[kind].toLowerCase()} of {personName}
      </h3>

      {/* Mode switch */}
      <div role="tablist" className="grid grid-cols-2 gap-1 rounded-xl bg-stone-100 p-1 text-xs font-medium">
        {(['existing', 'new'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            className={`rounded px-2 py-1.5 transition-colors ${
              mode === m ? 'bg-white text-brand-700 shadow-sm' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            {m === 'existing' ? 'Someone in the tree' : 'New person'}
          </button>
        ))}
      </div>

      {mode === 'existing' ? (
        <form onSubmit={handleLinkExisting} className="space-y-3">
          {parentTypeSelector}

          {error && (
            <div role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {candidates.length === 0 ? (
            <p className="text-sm text-stone-500">
              No one in the tree can be added as {personName}&apos;s {KIND_LABEL[kind].toLowerCase()}.
              Use &ldquo;New person&rdquo; instead.
            </p>
          ) : (
            <div>
              <label htmlFor="quick-add-existing" className="block text-sm font-medium text-stone-700">
                Person
              </label>
              <select
                id="quick-add-existing"
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className={SELECT_CLASSES}
                disabled={isSubmitting}
              >
                <option value="">Choose a person…</option>
                {suggested.length > 0 && (
                  <optgroup label="Suggested">
                    {suggested.map((c) => (
                      <option key={c.node.id} value={c.node.id}>
                        {formatDisplayName(c.node.firstName, c.node.lastName)}
                      </option>
                    ))}
                  </optgroup>
                )}
                {others.length > 0 && (
                  <optgroup label={suggested.length > 0 ? 'Everyone else' : 'People in this tree'}>
                    {others.map((c) => (
                      <option key={c.node.id} value={c.node.id}>
                        {formatDisplayName(c.node.firstName, c.node.lastName)}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
              {selectedReason && <p className="mt-1 text-xs text-brand-600">{selectedReason}</p>}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={isSubmitting || !selectedId}
              className="flex-1 rounded-full bg-brand-500 px-3 py-2 text-sm font-bold text-white hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 shadow-[0_3px_0_0_var(--color-brand-700)] disabled:shadow-none"
            >
              {isSubmitting ? 'Linking…' : `Link as ${KIND_LABEL[kind].toLowerCase()}`}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="flex-1 rounded-full border border-stone-300 bg-white px-3 py-2 text-sm font-bold text-stone-700 shadow-sm hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-3">
          {parentTypeSelector}
          <AddPersonForm
            // Remount when the parent type changes so the prefill is picked up
            key={`${kind}-${parentType}`}
            treeId={treeId}
            role="admin"
            allNodes={allNodes}
            prefillRelationship={{
              type: kind === 'child' ? parentType : kind,
              targetNodeId: person.id,
              direction:
                kind === 'spouse' ? undefined : kind === 'child' ? 'new_is_child' : 'new_is_parent',
            }}
            coParent={
              coParent
                ? {
                    nodeId: coParent.node.id,
                    type: coParent.type,
                    label: formatDisplayName(coParent.node.firstName, coParent.node.lastName),
                  }
                : undefined
            }
            onPersonCreated={onDone}
            onCancel={onCancel}
          />
        </div>
      )}
    </div>
  );
}
