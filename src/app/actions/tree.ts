'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { verifySession } from '@/lib/auth/session';
import { createTree, updateTree } from '@/lib/services/tree.service';
import { createTreeSchema, updateTreeSchema } from '@/lib/validations/tree';
import { objectIdSchema } from '@/lib/validations/common';
import { AppError } from '@/lib/utils/errors';
import { z } from 'zod';

// --- Types ---

export interface ActionState {
  success: boolean;
  error?: {
    code: string;
    message: string;
    field?: string;
  };
  data?: Record<string, unknown>;
  /** Submitted form values — returned so the UI can preserve inputs on error. */
  values?: Record<string, string>;
}

// --- Helpers ---

/**
 * Verifies the user session and returns an error ActionState if unauthenticated.
 */
async function requireAuth(action: string): Promise<
  | { userId: string }
  | ActionState
> {
  const session = await verifySession();
  if (!session) {
    return {
      success: false,
      error: {
        code: 'NOT_AUTHENTICATED',
        message: `You must be signed in to ${action}`,
      },
    };
  }
  return { userId: session.userId };
}

/**
 * Validates raw input against a Zod schema.
 * Returns parsed data on success, or an ActionState error on failure.
 */
function validateInput<T>(schema: z.ZodType<T>, raw: unknown): { data: T } | ActionState {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return {
      success: false,
      error: {
        code: 'INVALID_INPUT',
        message: firstIssue.message,
        field: firstIssue.path.join('.'),
      },
    };
  }
  return { data: parsed.data };
}

/**
 * Converts a caught error into an ActionState.
 */
function handleActionError(error: unknown): ActionState {
  if (error instanceof AppError) {
    return {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        field: error.field,
      },
    };
  }
  console.error('[Server Action Error]', error);
  return {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred. Please try again.',
    },
  };
}

/**
 * Type guard: checks if a result is an error ActionState.
 */
function isActionError(result: unknown): result is ActionState {
  return (
    typeof result === 'object' &&
    result !== null &&
    'success' in result &&
    (result as ActionState).success === false
  );
}

// --- Server Actions ---

/**
 * Server Action for creating a new family tree.
 *
 * Validates the form data, authenticates the user, creates the tree,
 * revalidates the dashboard path, and redirects to the new tree.
 *
 * @param _prevState - Previous form state (used by useActionState)
 * @param formData - Form data containing `name` and optional `description`
 * @returns ActionState with success/error information
 */
export async function createTreeAction(
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  // Capture submitted values so the UI can preserve inputs on error
  const submittedValues: Record<string, string> = {
    name: (formData.get('name') as string) ?? '',
    description: (formData.get('description') as string) ?? '',
  };

  const auth = await requireAuth('create a family tree');
  if (isActionError(auth)) return { ...auth, values: submittedValues };

  const rawInput = {
    name: formData.get('name'),
    description: formData.get('description') || undefined,
  };

  const validation = validateInput(createTreeSchema, rawInput);
  if (isActionError(validation)) return { ...validation, values: submittedValues };

  // Create tree via service layer — redirect is outside try/catch
  // because Next.js redirect() throws internally
  let treeId: string;
  try {
    const result = await createTree(auth.userId, validation.data);
    treeId = result.tree.id;
  } catch (error: unknown) {
    return { ...handleActionError(error), values: submittedValues };
  }

  revalidatePath('/dashboard');
  redirect(`/trees/${treeId}`);
}

/**
 * Server Action for updating an existing family tree's name and/or description.
 *
 * Validates the form data, authenticates the user, updates the tree,
 * and revalidates the relevant paths.
 *
 * @param _prevState - Previous form state (used by useActionState)
 * @param formData - Form data containing `treeId`, optional `name`, and optional `description`
 * @returns ActionState with success/error information
 */
export async function updateTreeAction(
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const auth = await requireAuth('update a family tree');
  if (isActionError(auth)) return auth;

  // Validate treeId format
  const rawTreeId = formData.get('treeId');
  const treeIdResult = objectIdSchema.safeParse(rawTreeId);
  if (!treeIdResult.success) {
    return {
      success: false,
      error: {
        code: 'INVALID_INPUT',
        message: 'A valid Tree ID is required',
        field: 'treeId',
      },
    };
  }
  const treeId = treeIdResult.data;

  // Extract and validate update fields
  const rawInput: Record<string, unknown> = {};
  const name = formData.get('name');
  const description = formData.get('description');

  if (name !== null) rawInput.name = name;
  if (description !== null) rawInput.description = description;

  const validation = validateInput(updateTreeSchema, rawInput);
  if (isActionError(validation)) return validation;

  // Update tree via service layer
  try {
    const result = await updateTree(treeId, auth.userId, validation.data);

    revalidatePath('/dashboard');
    revalidatePath(`/trees/${treeId}`);

    return {
      success: true,
      data: {
        id: result.id,
        name: result.name,
        description: result.description,
      },
    };
  } catch (error: unknown) {
    return handleActionError(error);
  }
}
