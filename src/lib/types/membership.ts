/**
 * Shared membership role type.
 *
 * Extracted from the Mongoose model so client components can import it
 * without pulling in server-side DB dependencies.
 */
export type MembershipRole = 'admin' | 'editor' | 'viewer';
