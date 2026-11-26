'use client';

import { useState, useActionState } from 'react';
import { useTree } from '@/components/tree/TreeProvider';
import { updateTreeAction, softDeleteTreeAction, ActionState } from '@/app/actions/tree';
import { TREE_NAME_MAX, TREE_DESCRIPTION_MAX } from '@/lib/validations/tree';

// --- Constants ---

const INPUT_CLASSES =
  'mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm';

// --- Reusable field error component ---

type FormField = 'name' | 'description';

function FieldError({ state, field }: { state: ActionState | null; field: FormField }) {
  if (state?.error?.field !== field) return null;
  return (
    <p className="mt-1 text-sm text-red-600" aria-live="polite">
      {state.error.message}
    </p>
  );
}

// --- Character counter component ---

function CharacterCounter({ current, max }: { current: number; max: number }) {
  return (
    <span className="text-xs text-gray-400">
      {current}/{max}
    </span>
  );
}

// --- Confirmation Dialog ---

function DeleteConfirmationDialog({
  treeName,
  isOpen,
  onClose,
  onConfirm,
  isPending,
  error,
}: {
  treeName: string;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isPending: boolean;
  error: string | null;
}) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
    >
      <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2
          id="delete-dialog-title"
          className="text-lg font-semibold text-gray-900"
        >
          Delete Family Tree
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Are you sure you want to delete{' '}
          <span className="font-medium text-gray-900">&ldquo;{treeName}&rdquo;</span>?
          This action will soft-delete the tree. It can be restored within 30 days.
        </p>
        <p className="mt-2 text-sm text-gray-500">
          Only the sole admin of a tree can delete it. If there are other admins,
          they must be removed first.
        </p>

        {error && (
          <div
            role="alert"
            aria-live="polite"
            className="mt-3 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? 'Deleting...' : 'Delete Tree'}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Main Settings Page ---

/**
 * Tree settings page (admin-only).
 *
 * Provides:
 * 1. An edit form for updating tree name and description
 * 2. A soft-delete action with a confirmation dialog
 *
 * Access control: If the user's role is not 'admin', a forbidden message is shown.
 * The tree-scoped layout already verifies membership, so we only need to check role.
 */
export default function TreeSettingsPage() {
  const { tree, role } = useTree();

  // Edit form state
  const [updateState, updateFormAction, isUpdatePending] = useActionState(
    updateTreeAction,
    null
  );
  const [descriptionLength, setDescriptionLength] = useState(
    tree.description?.length ?? 0
  );

  // Delete state
  const [deleteState, deleteFormAction, isDeletePending] = useActionState(
    softDeleteTreeAction,
    null
  );
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Admin-only access enforcement
  if (role !== 'admin') {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center">
          <h1 className="text-xl font-semibold text-red-800">Access Denied</h1>
          <p className="mt-2 text-sm text-red-600">
            Only administrators can access tree settings.
          </p>
        </div>
      </div>
    );
  }

  const handleDeleteConfirm = () => {
    const formData = new FormData();
    formData.append('treeId', tree.id);
    deleteFormAction(formData);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tree Settings</h1>
        <p className="mt-1 text-sm text-gray-600">
          Manage your family tree&apos;s name, description, and other settings.
        </p>
      </div>

      {/* Edit Form */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">General</h2>
        <p className="mt-1 text-sm text-gray-600">
          Update your tree&apos;s basic information.
        </p>

        <form action={updateFormAction} className="mt-6 space-y-6">
          <input type="hidden" name="treeId" value={tree.id} />

          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700"
            >
              Tree Name <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              maxLength={TREE_NAME_MAX}
              defaultValue={updateState?.data?.name as string ?? tree.name}
              placeholder="e.g. The Smith Family"
              className={INPUT_CLASSES}
              aria-describedby="name-hint"
              aria-invalid={updateState?.error?.field === 'name' ? 'true' : undefined}
            />
            <p id="name-hint" className="mt-1 text-xs text-gray-500">
              1–{TREE_NAME_MAX} characters. Must not be empty after trimming.
            </p>
            <FieldError state={updateState} field="name" />
          </div>

          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium text-gray-700"
            >
              Description
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              maxLength={TREE_DESCRIPTION_MAX}
              defaultValue={updateState?.data?.description as string ?? tree.description ?? ''}
              placeholder="A brief description of this family tree (optional)"
              className={INPUT_CLASSES}
              aria-describedby="description-hint"
              aria-invalid={updateState?.error?.field === 'description' ? 'true' : undefined}
              onChange={(e) => setDescriptionLength(e.target.value.length)}
            />
            <div className="mt-1 flex items-center justify-between">
              <p id="description-hint" className="text-xs text-gray-500">
                Up to {TREE_DESCRIPTION_MAX} characters.
              </p>
              <CharacterCounter current={descriptionLength} max={TREE_DESCRIPTION_MAX} />
            </div>
            <FieldError state={updateState} field="description" />
          </div>

          {/* General (non-field) error */}
          {updateState?.error && !updateState.error.field && (
            <div
              role="alert"
              aria-live="polite"
              className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {updateState.error.message}
            </div>
          )}

          {/* Success message */}
          {updateState?.success && (
            <div
              role="status"
              aria-live="polite"
              className="rounded-md bg-green-50 px-4 py-3 text-sm text-green-700"
            >
              Tree settings updated successfully.
            </div>
          )}

          <div className="flex items-center justify-end">
            <button
              type="submit"
              disabled={isUpdatePending}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isUpdatePending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      {/* Danger Zone */}
      <div className="rounded-lg border border-red-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-red-700">Danger Zone</h2>
        <p className="mt-1 text-sm text-gray-600">
          Irreversible and destructive actions.
        </p>

        <div className="mt-6 flex items-center justify-between rounded-md border border-red-200 bg-red-50 p-4">
          <div>
            <h3 className="text-sm font-medium text-gray-900">
              Delete this family tree
            </h3>
            <p className="mt-1 text-xs text-gray-600">
              The tree will be soft-deleted and can be restored within 30 days.
              After that, it will be permanently removed.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowDeleteDialog(true)}
            className="ml-4 shrink-0 rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 shadow-sm hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          >
            Delete Tree
          </button>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        treeName={tree.name}
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDeleteConfirm}
        isPending={isDeletePending}
        error={deleteState?.error?.message ?? null}
      />
    </div>
  );
}
