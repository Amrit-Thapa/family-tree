'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { formatDisplayName } from '@/lib/graph/format-name';

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
  [key: string]: unknown;
}

/**
 * Generates initials from a person's name for the placeholder avatar.
 */
function getInitials(firstName: string, lastName?: string): string {
  const first = firstName.trim().charAt(0).toUpperCase();
  const last = lastName?.trim().charAt(0).toUpperCase() ?? '';
  return first + last || '?';
}

/**
 * Returns a gradient background class based on gender for the avatar.
 */
function getAvatarColors(gender?: string): string {
  switch (gender) {
    case 'male':
      return 'bg-gradient-to-br from-blue-400 to-blue-600 text-white';
    case 'female':
      return 'bg-gradient-to-br from-pink-400 to-pink-600 text-white';
    default:
      return 'bg-gradient-to-br from-indigo-400 to-purple-500 text-white';
  }
}

/**
 * PersonNode is a custom React Flow node that renders a person in the
 * family tree graph with a card-style design featuring an avatar,
 * name, and visual distinction for the current user.
 */
function PersonNodeComponent({ data }: NodeProps) {
  const { firstName, lastName, profilePhotoUrl, isCurrentUser, gender } =
    data as PersonNodeData;

  const displayName = formatDisplayName(firstName, lastName);
  const initials = getInitials(firstName, lastName);
  const avatarColors = getAvatarColors(gender);

  return (
    <>
      {/* Target handle (top) — parent-child edges connect here */}
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        className="w-3! h-3! bg-gray-300! border-2! border-white! -top-1.5!"
      />

      {/* Left handle — for spouse connections (incoming) */}
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="w-3! h-3! bg-gray-300! border-2! border-white! -left-1.5! opacity-0!"
      />

      {/* Card */}
      <div
        className={`
          flex flex-col items-center gap-1.5 px-4 py-3 rounded-xl
          bg-white shadow-lg border-2 transition-shadow
          min-w-[140px] max-w-[180px]
          hover:shadow-xl
          ${isCurrentUser
            ? 'border-blue-500 shadow-blue-100 ring-2 ring-blue-100'
            : 'border-gray-100'
          }
        `}
      >
        {/* Avatar */}
        {profilePhotoUrl ? (
          <img
            src={profilePhotoUrl}
            alt={`${firstName}'s photo`}
            className="w-12 h-12 rounded-full object-cover ring-2 ring-white shadow-sm"
          />
        ) : (
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold shadow-sm ring-2 ring-white ${avatarColors}`}
            aria-label={`${firstName}'s avatar`}
          >
            {initials}
          </div>
        )}

        {/* Name */}
        <span className="text-xs font-semibold text-gray-800 text-center leading-tight truncate w-full">
          {displayName}
        </span>

        {/* Current user indicator */}
        {isCurrentUser && (
          <span className="text-[10px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">
            You
          </span>
        )}
      </div>

      {/* Source handle (bottom) — parent-child edges go to children */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="w-3! h-3! bg-gray-300! border-2! border-white! -bottom-1.5!"
      />

      {/* Right handle — for spouse connections (outgoing) */}
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="w-3! h-3! bg-gray-300! border-2! border-white! -right-1.5! opacity-0!"
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
