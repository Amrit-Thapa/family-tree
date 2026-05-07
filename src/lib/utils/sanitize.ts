/**
 * XSS sanitization utility for the Family Relationship Intelligence Platform.
 *
 * Uses isomorphic-dompurify (DOMPurify with JSDOM for server-side support)
 * to sanitize user-provided text inputs before storage or rendering.
 *
 * This module provides:
 * - sanitizeText: Strips ALL HTML/script content, returning plain text
 * - sanitizeHtml: Allows a safe subset of HTML (for rich text fields like biography)
 * - sanitizeObject: Recursively sanitizes all string fields in an object
 */

import DOMPurify from 'isomorphic-dompurify';

/**
 * Strips all HTML tags and returns plain text.
 * Use for fields that should never contain HTML (names, professions, locations, etc.).
 *
 * @param input - The raw user input string
 * @returns Sanitized plain text with all HTML removed
 */
export function sanitizeText(input: string): string {
  if (!input) return input;
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] }).trim();
}

/**
 * Sanitizes HTML while allowing a safe subset of formatting tags.
 * Use for fields that may contain basic formatting (biography, descriptions).
 *
 * Allowed tags: b, i, em, strong, p, br, ul, ol, li, a (with href only)
 *
 * @param input - The raw user input string (may contain HTML)
 * @returns Sanitized HTML with only safe tags preserved
 */
export function sanitizeHtml(input: string): string {
  if (!input) return input;
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li', 'a'],
    ALLOWED_ATTR: ['href'],
    ALLOW_DATA_ATTR: false,
  }).trim();
}

/**
 * Recursively sanitizes all string values in an object using sanitizeText.
 * Non-string values are passed through unchanged.
 * Useful for sanitizing entire form payloads before processing.
 *
 * @param obj - An object with string values to sanitize
 * @returns A new object with all string values sanitized
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = sanitizeText(value);
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = sanitizeObject(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        typeof item === 'string'
          ? sanitizeText(item)
          : item !== null && typeof item === 'object'
            ? sanitizeObject(item as Record<string, unknown>)
            : item
      );
    } else {
      result[key] = value;
    }
  }

  return result as T;
}
