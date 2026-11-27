'use client';

import type { ReactNode } from 'react';
import type { GraphNodeData } from '@/lib/services/graph.service';
import type { FocusFamily, FocusPerson } from '@/lib/graph/family-focus';
import { formatDisplayName } from '@/lib/graph/format-name';
import PersonAvatar from '@/components/graph/PersonAvatar';

export interface FocusViewProps {
  person: GraphNodeData;
  family: FocusFamily;
  currentUserId: string;
  isAdmin: boolean;
  /** Re-centre the view on someone else */
  onFocus: (nodeId: string) => void;
  /** Open the details / edit sheet for someone */
  onOpenDetails: (nodeId: string) => void;
}

function lifeSpan(node: GraphNodeData): string | null {
  const born = node.dateOfBirth ? new Date(node.dateOfBirth).getFullYear() : null;
  const died = node.dateOfDeath ? new Date(node.dateOfDeath).getFullYear() : null;
  if (born && died) return `${born} – ${died}`;
  if (born) return `Born ${born}`;
  if (died) return `Died ${died}`;
  return null;
}

/** A relative's card. Tapping it moves the view to them. */
function RelativeCard({ person, onFocus, isMe }: { person: FocusPerson; onFocus: (id: string) => void; isMe: boolean }) {
  const { node, label, note } = person;
  const name = formatDisplayName(node.firstName, node.lastName);
  return (
    <button
      type="button"
      onClick={() => onFocus(node.id)}
      aria-label={`${label}: ${name}. Show their family`}
      className={`group flex w-36 flex-col items-center gap-1.5 rounded-3xl border-2 bg-white px-3 pb-3 pt-4 text-center shadow-[0_4px_0_0_rgb(231_229_228)] transition-all hover:-translate-y-0.5 hover:border-brand-300 focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 sm:w-40 ${
        isMe ? 'border-brand-300' : 'border-stone-200'
      }`}
    >
      <PersonAvatar firstName={node.firstName} lastName={node.lastName} gender={node.gender} photoUrl={node.profilePhotoUrl} />
      <span className="line-clamp-2 text-sm font-bold leading-tight text-stone-800">{name}</span>
      <span className="rounded-full bg-sun-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
        {isMe ? '⭐ You' : label}
      </span>
      {note && <span className="text-[11px] text-stone-500">{note}</span>}
    </button>
  );
}

/** Dashed placeholder for a missing parent. Admins can tap it to add one. */
function EmptySlot({ label, onClick }: { label: string; onClick?: () => void }) {
  const classes =
    'flex w-36 flex-col items-center justify-center gap-1 rounded-3xl border-2 border-dashed px-3 py-6 text-center text-sm font-bold sm:w-40';
  if (!onClick) {
    return <div className={`${classes} border-stone-200 text-stone-400`}>{label} not added</div>;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${classes} border-brand-200 text-brand-600 transition-colors hover:border-brand-400 hover:bg-brand-50`}
    >
      <span className="text-xl" aria-hidden="true">＋</span>
      Add {label.toLowerCase()}
    </button>
  );
}

/** Compact chip used in the horizontally scrolling rows. */
function RelativeChip({ person, onFocus }: { person: FocusPerson; onFocus: (id: string) => void }) {
  const { node, label, note } = person;
  return (
    <button
      type="button"
      onClick={() => onFocus(node.id)}
      className="flex shrink-0 snap-start items-center gap-2.5 rounded-full border-2 border-stone-200 bg-white py-1.5 pl-1.5 pr-4 text-left transition-colors hover:border-brand-300 focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-200"
    >
      <PersonAvatar firstName={node.firstName} lastName={node.lastName} gender={node.gender} photoUrl={node.profilePhotoUrl} size="sm" />
      <span className="flex flex-col">
        <span className="max-w-[9rem] truncate text-sm font-bold text-stone-800">
          {formatDisplayName(node.firstName, node.lastName)}
        </span>
        <span className="text-[11px] font-semibold text-stone-500">
          {label}
          {note ? ` · ${note}` : ''}
        </span>
      </span>
    </button>
  );
}

function Branch() {
  return <div aria-hidden="true" className="mx-auto h-7 w-[3px] rounded-full bg-[#c4a484]" />;
}

function RowLabel({ children }: { children: ReactNode }) {
  return <p className="mb-2 text-center text-xs font-bold uppercase tracking-wide text-stone-400">{children}</p>;
}

function ChipRow({ title, people, onFocus }: { title: string; people: FocusPerson[]; onFocus: (id: string) => void }) {
  if (people.length === 0) return null;
  return (
    <section className="rounded-[2rem] bg-white/70 p-4">
      <h3 className="mb-3 text-base font-semibold text-stone-800">{title}</h3>
      <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1">
        {people.map((p) => (
          <RelativeChip key={p.node.id} person={p} onFocus={onFocus} />
        ))}
      </div>
    </section>
  );
}

/**
 * Person-centred family view: one person in the middle with parents above,
 * partners beside and children below, then siblings and extended family.
 * Every relative is a big tap target that re-centres the view on them, so
 * it works with a thumb on a phone.
 */
export default function FocusView({ person, family, currentUserId, isAdmin, onFocus, onOpenDetails }: FocusViewProps) {
  const name = formatDisplayName(person.firstName, person.lastName);
  const isMe = person.linkedUserId === currentUserId;
  const years = lifeSpan(person);
  const hasParents = family.father || family.mother;
  const showParentsRow = hasParents || isAdmin;
  const addViaDetails = isAdmin ? () => onOpenDetails(person.id) : undefined;
  const isMeNode = (n: GraphNodeData) => n.linkedUserId === currentUserId;

  return (
    // Keyed on the person so moving to someone new starts at the top
    <div key={person.id} className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl animate-pop-in space-y-4 px-4 py-6">
        <div>
          {/* Parents */}
          {showParentsRow && (
            <>
              <RowLabel>Parents</RowLabel>
              <div className="flex justify-center gap-3">
                {family.father ? (
                  <RelativeCard person={family.father} onFocus={onFocus} isMe={isMeNode(family.father.node)} />
                ) : (
                  <EmptySlot label="Dad" onClick={addViaDetails} />
                )}
                {family.mother ? (
                  <RelativeCard person={family.mother} onFocus={onFocus} isMe={isMeNode(family.mother.node)} />
                ) : (
                  <EmptySlot label="Mum" onClick={addViaDetails} />
                )}
              </div>
              <Branch />
            </>
          )}

          {/* The focused person, with partners beside them */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <div
              className={`flex w-full max-w-xs flex-col items-center gap-2 rounded-[2rem] border-2 px-5 pb-5 pt-6 text-center shadow-[0_5px_0_0_var(--color-brand-200)] ${
                isMe ? 'border-brand-400 bg-brand-50' : 'border-brand-300 bg-white'
              }`}
            >
              <PersonAvatar
                firstName={person.firstName}
                lastName={person.lastName}
                gender={person.gender}
                photoUrl={person.profilePhotoUrl}
                size="lg"
              />
              <h2 className="text-xl font-semibold leading-tight text-stone-900">{name}</h2>
              {isMe && (
                <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-bold text-brand-700">
                  ⭐ That&apos;s you!
                </span>
              )}
              {years && <p className="text-xs font-semibold text-stone-500">{years}</p>}
              <button
                type="button"
                onClick={() => onOpenDetails(person.id)}
                className="mt-1 rounded-full bg-brand-500 px-4 py-2 text-sm font-bold text-white shadow-[0_3px_0_0_var(--color-brand-700)] hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
              >
                {isAdmin ? '✏️ Details & edit' : '📋 Details'}
              </button>
            </div>

            {family.partners.map((p) => (
              <div key={p.node.id} className="flex flex-col items-center gap-1 sm:flex-row sm:gap-3">
                <span aria-hidden="true" className="text-2xl">💞</span>
                <RelativeCard person={p} onFocus={onFocus} isMe={isMeNode(p.node)} />
              </div>
            ))}
          </div>

          {/* Children */}
          {family.children.length > 0 && (
            <>
              <Branch />
              <RowLabel>Children</RowLabel>
              <div className="flex flex-wrap justify-center gap-3">
                {family.children.map((c) => (
                  <RelativeCard key={c.node.id} person={c} onFocus={onFocus} isMe={isMeNode(c.node)} />
                ))}
              </div>
            </>
          )}
        </div>

        <ChipRow title="👫 Brothers & sisters" people={family.siblings} onFocus={onFocus} />
        <ChipRow title="🌳 More family" people={family.extended} onFocus={onFocus} />

        {!hasParents && family.partners.length === 0 && family.children.length === 0 && family.siblings.length === 0 && (
          <p className="text-center text-sm text-stone-500">
            {isAdmin
              ? `${person.firstName} isn't linked to anyone yet. Open their details to add family 🌱`
              : `${person.firstName} isn't linked to anyone yet 🌱`}
          </p>
        )}
      </div>
    </div>
  );
}
