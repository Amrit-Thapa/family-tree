'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { MembershipRole } from '@/lib/types/membership';

/**
 * Represents the tree data provided to child routes via context.
 */
export interface TreeData {
  id: string;
  name: string;
  description: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Shape of the tree context value provided to consuming components.
 */
export interface TreeContextValue {
  /** The current family tree data. */
  tree: TreeData;
  /** The current user's role in this tree. */
  role: MembershipRole;
  /** The current user's membership ID. */
  membershipId: string;
}

const TreeContext = createContext<TreeContextValue | undefined>(undefined);
TreeContext.displayName = 'TreeContext';

interface TreeProviderProps {
  children: ReactNode;
  tree: TreeData;
  role: MembershipRole;
  membershipId: string;
}

/**
 * TreeProvider wraps child routes within a tree-scoped layout to provide
 * tree data and the user's membership role via React context.
 *
 * This allows any child component to access tree info and the user's
 * permissions without prop drilling or redundant database queries.
 */
export default function TreeProvider({
  children,
  tree,
  role,
  membershipId,
}: TreeProviderProps) {
  const value = useMemo(
    () => ({ tree, role, membershipId }),
    [tree, role, membershipId]
  );

  return (
    <TreeContext.Provider value={value}>
      {children}
    </TreeContext.Provider>
  );
}

/**
 * Hook to consume the tree context. Must be used within a TreeProvider
 * (i.e., within a tree-scoped route under /trees/[treeId]).
 *
 * @returns The current tree context value (tree data, role, membershipId).
 * @throws Error if used outside of a TreeProvider.
 */
export function useTree(): TreeContextValue {
  const context = useContext(TreeContext);

  if (context === undefined) {
    throw new Error('useTree must be used within a TreeProvider');
  }

  return context;
}
