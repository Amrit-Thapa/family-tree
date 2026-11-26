import { Types } from 'mongoose';
import { ValidationError } from '@/lib/utils/errors';

/**
 * Validates and converts a string to a Mongoose ObjectId.
 * Throws a ValidationError if the format is invalid.
 *
 * @param id - The string to convert
 * @param label - A human-readable label for error messages (e.g., 'treeId', 'userId')
 * @returns A valid Mongoose ObjectId
 * @throws ValidationError if the string is not a valid ObjectId format
 */
export function toObjectId(id: string, label: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) {
    throw new ValidationError(`Invalid ${label} ID format`, 'INVALID_ID', {
      field: label,
    });
  }
  return new Types.ObjectId(id);
}
