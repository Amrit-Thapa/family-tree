'use client';

import { useId, useMemo, useState } from 'react';
import type { GraphNodeData } from '@/lib/services/graph.service';
import { searchPeople } from '@/lib/graph/family-focus';
import { formatDisplayName } from '@/lib/graph/format-name';
import PersonAvatar from '@/components/graph/PersonAvatar';

/**
 * Search box that finds a person in the tree by name and jumps to them.
 */
export default function PersonSearch({
  nodes,
  onPick,
  className = '',
}: {
  nodes: GraphNodeData[];
  onPick: (nodeId: string) => void;
  className?: string;
}) {
  const listId = useId();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const results = useMemo(() => searchPeople(nodes, query), [nodes, query]);
  const showList = open && query.trim().length > 0;

  function pick(node: GraphNodeData) {
    onPick(node.id);
    setQuery('');
    setOpen(false);
    (document.activeElement as HTMLElement | null)?.blur();
  }

  return (
    <div className={`relative ${className}`}>
      <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm">
        🔍
      </span>
      <input
        type="search"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-label="Find a person"
        placeholder="Find someone…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (!showList || results.length === 0) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((i) => (i + 1) % results.length);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((i) => (i - 1 + results.length) % results.length);
          } else if (e.key === 'Enter') {
            e.preventDefault();
            pick(results[active]);
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
        className="h-10 w-full rounded-full border-2 border-stone-200 bg-white pl-9 pr-3 text-base text-stone-800 placeholder-stone-400 focus:border-brand-400 focus:outline-none sm:text-sm"
      />
      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-12 z-40 max-h-72 overflow-y-auto rounded-3xl border-2 border-stone-100 bg-white p-1.5 shadow-xl"
        >
          {results.length === 0 ? (
            <li className="px-3 py-2 text-sm text-stone-500">No one called that yet 🤔</li>
          ) : (
            results.map((node, i) => (
              <li key={node.id} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  // mousedown so the pick lands before the input's blur closes the list
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(node);
                  }}
                  className={`flex w-full items-center gap-2.5 rounded-2xl px-2 py-1.5 text-left text-sm font-bold text-stone-800 ${
                    i === active ? 'bg-brand-50' : 'hover:bg-stone-50'
                  }`}
                >
                  <PersonAvatar firstName={node.firstName} lastName={node.lastName} gender={node.gender} photoUrl={node.profilePhotoUrl} size="sm" />
                  {formatDisplayName(node.firstName, node.lastName)}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
