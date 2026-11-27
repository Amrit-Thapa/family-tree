'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { formatDisplayName } from '@/lib/graph/format-name';
import { PERSON_NODE_HEIGHT } from '@/lib/graph/layout';
import PersonAvatar from '@/components/graph/PersonAvatar';

/**
 * Data shape for a person node in the family tree graph.
 */
export interface PersonNodeData {
  firstName: string;
  lastName?: string;
  profilePhotoUrl?: string;
  linkedUserId?: string;
  isCurrentUser: boolean;
  gender?: string;
  /** The person the Family view is centred on */
  isFocused?: boolean;
  [key: string]: unknown;
}

/**
 * PersonNode is a custom React Flow node that renders a person in the
 * family tree graph with a card-style design featuring an avatar,
 * name, and visual distinction for the current user.
 */
function PersonNodeComponent({ data }: NodeProps) {
  const { firstName, lastName, profilePhotoUrl, isCurrentUser, gender, isFocused } =
    data as PersonNodeData;

  const displayName = formatDisplayName(firstName, lastName);

  return (
    <>
      {/* Target handle (top) — parent-child edges connect here */}
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        className="w-3! h-3! bg-stone-300! border-2! border-white! -top-1.5!"
      />

      {/* Left handle — for spouse connections (incoming) */}
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="w-3! h-3! bg-stone-300! border-2! border-white! -left-1.5! opacity-0!"
      />

      {/* Card — fixed height so every card matches the layout's assumption */}
      <div
        style={{ height: PERSON_NODE_HEIGHT }}
        className={`
          flex flex-col items-center justify-center gap-1.5 px-4 py-3 rounded-3xl
          bg-white border-2 shadow-[0_4px_0_0_rgb(231_229_228)] transition-all duration-200
          min-w-[140px] max-w-[180px] cursor-pointer
          hover:-translate-y-0.5 hover:shadow-[0_6px_0_0_rgb(231_229_228)]
          ${isCurrentUser
            ? 'border-brand-400 bg-brand-50 shadow-[0_4px_0_0_var(--color-brand-200)]! ring-4 ring-brand-100'
            : isFocused
              ? 'border-brand-300 ring-4 ring-sun-300'
              : 'border-stone-200'
          }
        `}
      >
        <PersonAvatar firstName={firstName} lastName={lastName} gender={gender} photoUrl={profilePhotoUrl} />

        {/* Name */}
        <span className="text-xs font-bold text-stone-800 text-center leading-tight truncate w-full">
          {displayName}
        </span>

        {/* Current user indicator */}
        {isCurrentUser && (
          <span className="text-[10px] font-bold text-brand-700 bg-brand-100 px-2 py-0.5 rounded-full">
            ⭐ That&apos;s you!
          </span>
        )}
      </div>

      {/* Source handle (bottom) — parent-child edges go to children */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="w-3! h-3! bg-stone-300! border-2! border-white! -bottom-1.5!"
      />

      {/* Right handle — for spouse connections (outgoing) */}
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="w-3! h-3! bg-stone-300! border-2! border-white! -right-1.5! opacity-0!"
      />
    </>
  );
}

/**
 * Memoized PersonNode for React Flow performance optimization.
 */
const PersonNode = memo(PersonNodeComponent);
PersonNode.displayName = 'PersonNode';

export default PersonNode;
