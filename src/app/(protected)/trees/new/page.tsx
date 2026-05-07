'use client';

import { useState, useActionState } from 'react';
import Link from 'next/link';
import { createTreeAction, ActionState } from '@/app/actions/tree';
import { TREE_NAME_MAX, TREE_DESCRIPTION_MAX } from '@/lib/validations/tree';

// --- Constants ---

const DASHBOARD_PATH = '/dashboard';

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

/**
 * Tree creation page with a form for name and optional description.
 *
 * Uses React 19's useActionState to integrate with the createTreeAction
 * server action, providing pending state and error feedback.
 */
export default function NewTreePage() {
  const [state, formAction, isPending] = useActionState(createTreeAction, null);
  const [descriptionLength, setDescriptionLength] = useState(0);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <Link
          href={DASHBOARD_PATH}
          className="text-sm text-indigo-600 hover:text-indigo-500"
        >
          &larr; Back to Dashboard
        </Link>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">
          Create a New Family Tree
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Give your family tree a name and an optional description to get started.
        </p>

        <form action={formAction} className="mt-6 space-y-6">
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
              defaultValue={state?.values?.name ?? ''}
              placeholder="e.g. The Smith Family"
              className={INPUT_CLASSES}
              aria-describedby="name-hint"
              aria-invalid={state?.error?.field === 'name' ? 'true' : undefined}
            />
            <p id="name-hint" className="mt-1 text-xs text-gray-500">
              1–{TREE_NAME_MAX} characters. Must not be empty after trimming.
            </p>
            <FieldError state={state} field="name" />
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
              defaultValue={state?.values?.description ?? ''}
              placeholder="A brief description of this family tree (optional)"
              className={INPUT_CLASSES}
              aria-describedby="description-hint"
              aria-invalid={state?.error?.field === 'description' ? 'true' : undefined}
              onChange={(e) => setDescriptionLength(e.target.value.length)}
            />
            <div className="mt-1 flex items-center justify-between">
              <p id="description-hint" className="text-xs text-gray-500">
                Up to {TREE_DESCRIPTION_MAX} characters.
              </p>
              <CharacterCounter current={descriptionLength} max={TREE_DESCRIPTION_MAX} />
            </div>
            <FieldError state={state} field="description" />
          </div>

          {state?.error && !state.error.field && (
            <div
              role="alert"
              aria-live="polite"
              className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {state.error.message}
            </div>
          )}

          <div className="flex items-center justify-end gap-3">
            {isPending ? (
              <span
                aria-disabled="true"
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm opacity-60 cursor-default"
              >
                Cancel
              </span>
            ) : (
              <Link
                href={DASHBOARD_PATH}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                Cancel
              </Link>
            )}
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? 'Creating...' : 'Create Tree'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
