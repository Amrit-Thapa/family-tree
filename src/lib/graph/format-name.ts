/**
 * Formats a person's display name by combining first and last name.
 * Truncates with ellipsis if the combined name exceeds 30 characters.
 *
 * Rules:
 * - Combines first + last name with a space separator
 * - Returns full name if combined length ≤ 30 characters
 * - Truncates to 29 characters + "…" if combined length exceeds 30
 */
export function formatDisplayName(
  firstName: string,
  lastName?: string
): string {
  const fullName = lastName ? `${firstName} ${lastName}` : firstName;

  if (fullName.length <= 30) {
    return fullName;
  }

  return fullName.slice(0, 29) + "\u2026";
}
