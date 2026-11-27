'use client';

import { useState, type FormEvent } from 'react';
import type { MembershipRole } from '@/lib/types/membership';
import type { GraphNodeData } from '@/lib/services/graph.service';

// --- Types ---

export interface AddPersonFormProps {
  treeId: string;
  role: MembershipRole;
  allNodes?: GraphNodeData[];
  /** Pre-fill relationship context (e.g., from quick-add buttons) */
  prefillRelationship?: {
    type: 'father' | 'mother' | 'spouse';
    targetNodeId: string;
    direction?: 'new_is_parent' | 'new_is_child';
  };
  /**
   * When adding a new child, the target's spouse who can also be linked as the
   * child's other parent. Shown as a checkbox (on by default).
   */
  coParent?: { nodeId: string; type: 'father' | 'mother'; label: string };
  onPersonCreated: (node: GraphNodeData) => void;
  onCancel?: () => void;
}

interface FieldErrors {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  dateOfDeath?: string;
  gender?: string;
  general?: string;
}

type Gender = 'male' | 'female' | 'other' | 'prefer_not_to_say';
type RelType = 'father' | 'mother' | 'spouse' | '';
type Direction = 'new_is_parent' | 'new_is_child';

// --- Constants ---

const NAME_MAX_LENGTH = 100;

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

const INPUT_CLASSES =
  'mt-1 block w-full rounded-xl border border-stone-300 px-3 py-2 text-stone-900 placeholder-stone-400 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 sm:text-sm';

// --- Component ---

/**
 * Form for adding a person node to the family tree with optional
 * relationship creation in a single step.
 *
 * Supports:
 * - Basic person creation (name, dates, gender)
 * - Optional relationship to an existing person (parent/child/spouse)
 * - Pre-filled relationship context from quick-add buttons
 */
export default function AddPersonForm({
  treeId,
  role,
  allNodes = [],
  prefillRelationship,
  coParent,
  onPersonCreated,
  onCancel,
}: AddPersonFormProps) {
  const [linkCoParent, setLinkCoParent] = useState(true);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [dateOfDeath, setDateOfDeath] = useState('');
  const [gender, setGender] = useState<Gender | ''>('');

  // Relationship fields
  const [relType, setRelType] = useState<RelType>(prefillRelationship?.type ?? '');
  const [relTargetNodeId, setRelTargetNodeId] = useState(prefillRelationship?.targetNodeId ?? '');
  const [relDirection, setRelDirection] = useState<Direction>(prefillRelationship?.direction ?? 'new_is_child');

  const [errors, setErrors] = useState<FieldErrors>({});
  const [dateWarning, setDateWarning] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  if (role !== 'admin') return null;

  const hasPrefill = !!prefillRelationship;

  function validate(): boolean {
    const newErrors: FieldErrors = {};
    const trimmedFirst = firstName.trim();
    if (!trimmedFirst) {
      newErrors.firstName = 'First name is required';
    } else if (trimmedFirst.length > NAME_MAX_LENGTH) {
      newErrors.firstName = `First name must be ${NAME_MAX_LENGTH} characters or less`;
    }
    const trimmedLast = lastName.trim();
    if (trimmedLast && trimmedLast.length > NAME_MAX_LENGTH) {
      newErrors.lastName = `Last name must be ${NAME_MAX_LENGTH} characters or less`;
    }
    setErrors(newErrors);
    checkDateWarning();
    return Object.keys(newErrors).length === 0;
  }

  function checkDateWarning(): void {
    if (dateOfBirth && dateOfDeath) {
      if (new Date(dateOfDeath) < new Date(dateOfBirth)) {
        setDateWarning('Date of death is earlier than date of birth. Dates may be approximate.');
        return;
      }
    }
    setDateWarning('');
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    setErrors({});
    setSuccessMessage('');

    try {
      // Step 1: Create the person
      const body: Record<string, string> = { firstName: firstName.trim() };
      const trimmedLast = lastName.trim();
      if (trimmedLast) body.lastName = trimmedLast;
      if (dateOfBirth) body.dateOfBirth = dateOfBirth;
      if (dateOfDeath) body.dateOfDeath = dateOfDeath;
      if (gender) body.gender = gender;

      const res = await fetch(`/api/trees/${treeId}/persons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        const apiError = data?.error;
        if (apiError?.field) {
          setErrors({ [apiError.field]: apiError.message });
        } else {
          setErrors({ general: apiError?.message || 'An unexpected error occurred' });
        }
        return;
      }

      const data = await res.json();
      const newNode: GraphNodeData = data.node;

      // Step 2: Create relationship if specified
      if (relType && relTargetNodeId) {
        let fromNodeId: string;
        let toNodeId: string;
        let relTypeToSend: string = relType;

        if (relType === 'father' || relType === 'mother') {
          if (relDirection === 'new_is_parent') {
            // New person is the parent of the target
            fromNodeId = newNode.id;
            toNodeId = relTargetNodeId;
          } else {
            // Target is the parent of the new person
            fromNodeId = relTargetNodeId;
            toNodeId = newNode.id;
            // When adding a child, the parent's gender determines the type
            // But since we're creating from quick-add, the type is already set correctly
          }
        } else {
          // Spouse — server normalizes direction
          fromNodeId = newNode.id;
          toNodeId = relTargetNodeId;
          relTypeToSend = 'spouse';
        }

        const relRes = await fetch(`/api/trees/${treeId}/relationships`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fromNodeId, toNodeId, type: relTypeToSend }),
        });

        if (!relRes.ok) {
          // Person was created but relationship failed — still notify success
          setSuccessMessage(`${firstName.trim()} added, but relationship could not be created automatically.`);
        }
      }

      // Step 3: Also link the other parent (target's spouse) if requested
      if (coParent && linkCoParent && relDirection === 'new_is_child') {
        const coRes = await fetch(`/api/trees/${treeId}/relationships`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fromNodeId: coParent.nodeId, toNodeId: newNode.id, type: coParent.type }),
        });
        if (!coRes.ok) {
          setSuccessMessage(
            `${firstName.trim()} added, but could not be linked to ${coParent.label} automatically.`
          );
        }
      }

      onPersonCreated(newNode);

      // Reset form for adding another
      setFirstName('');
      setLastName('');
      setDateOfBirth('');
      setDateOfDeath('');
      setGender('');
      if (!hasPrefill) {
        setRelType('');
        setRelTargetNodeId('');
        setRelDirection('new_is_child');
      }
      setDateWarning('');
      setErrors({});
    } catch {
      setErrors({ general: 'Network error. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  }

  // Helper to get a person's display name for the dropdown
  function getNodeLabel(node: GraphNodeData): string {
    return node.lastName ? `${node.firstName} ${node.lastName}` : node.firstName;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" aria-label="Add person form" noValidate>
      <h3 className="text-lg font-semibold text-stone-900">
        {hasPrefill
          ? prefillRelationship.type === 'spouse'
            ? 'Add Spouse'
            : prefillRelationship.direction === 'new_is_parent'
              ? `Add ${prefillRelationship.type === 'father' ? 'Father' : 'Mother'}`
              : 'Add Child'
          : 'Add Person'}
      </h3>

      {errors.general && (
        <div role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {errors.general}
        </div>
      )}

      {successMessage && (
        <div role="status" className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {successMessage}
        </div>
      )}

      {/* Name fields — side by side */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="add-person-firstName" className="block text-sm font-medium text-stone-700">
            First Name <span className="text-red-500">*</span>
          </label>
          <input
            id="add-person-firstName"
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            maxLength={NAME_MAX_LENGTH}
            placeholder="First name"
            className={INPUT_CLASSES}
            aria-required="true"
            aria-invalid={errors.firstName ? 'true' : undefined}
          />
          {errors.firstName && (
            <p className="mt-1 text-xs text-red-600">{errors.firstName}</p>
          )}
        </div>
        <div>
          <label htmlFor="add-person-lastName" className="block text-sm font-medium text-stone-700">
            Last Name
          </label>
          <input
            id="add-person-lastName"
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            maxLength={NAME_MAX_LENGTH}
            placeholder="Last name"
            className={INPUT_CLASSES}
          />
        </div>
      </div>

      {/* Gender + Dates — compact row */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label htmlFor="add-person-gender" className="block text-sm font-medium text-stone-700">
            Gender
          </label>
          <select
            id="add-person-gender"
            value={gender}
            onChange={(e) => setGender(e.target.value as Gender | '')}
            className={INPUT_CLASSES}
          >
            <option value="">—</option>
            {GENDER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="add-person-dob" className="block text-sm font-medium text-stone-700">
            Born
          </label>
          <input
            id="add-person-dob"
            type="date"
            value={dateOfBirth}
            onChange={(e) => { setDateOfBirth(e.target.value); checkDateWarning(); }}
            className={INPUT_CLASSES}
          />
        </div>
        <div>
          <label htmlFor="add-person-dod" className="block text-sm font-medium text-stone-700">
            Died
          </label>
          <input
            id="add-person-dod"
            type="date"
            value={dateOfDeath}
            onChange={(e) => { setDateOfDeath(e.target.value); checkDateWarning(); }}
            className={INPUT_CLASSES}
          />
        </div>
      </div>

      {dateWarning && (
        <p className="text-xs text-amber-600">{dateWarning}</p>
      )}

      {/* Relationship section */}
      {!hasPrefill && allNodes.length > 0 && (
        <div className="border-t border-stone-100 pt-4 space-y-3">
          <p className="text-sm font-medium text-stone-700">
            Connect to existing person <span className="text-stone-400">(optional)</span>
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="rel-type" className="block text-xs font-medium text-stone-500">
                Relationship
              </label>
              <select
                id="rel-type"
                value={relType}
                onChange={(e) => setRelType(e.target.value as RelType)}
                className={INPUT_CLASSES}
              >
                <option value="">None</option>
                <option value="father">Father</option>
                <option value="mother">Mother</option>
                <option value="spouse">Spouse</option>
              </select>
            </div>
            <div>
              <label htmlFor="rel-target" className="block text-xs font-medium text-stone-500">
                Person
              </label>
              <select
                id="rel-target"
                value={relTargetNodeId}
                onChange={(e) => setRelTargetNodeId(e.target.value)}
                className={INPUT_CLASSES}
                disabled={!relType}
              >
                <option value="">Select person</option>
                {allNodes.map((n) => (
                  <option key={n.id} value={n.id}>{getNodeLabel(n)}</option>
                ))}
              </select>
            </div>
          </div>

          {relType === 'father' || relType === 'mother' ? (
            relTargetNodeId && (
              <div className="flex gap-4">
                <label className="flex items-center gap-1.5 text-sm text-stone-700 cursor-pointer">
                  <input
                    type="radio"
                    name="rel-direction"
                    checked={relDirection === 'new_is_child'}
                    onChange={() => setRelDirection('new_is_child')}
                    className="h-3.5 w-3.5 text-brand-600"
                  />
                  New person is child
                </label>
                <label className="flex items-center gap-1.5 text-sm text-stone-700 cursor-pointer">
                  <input
                    type="radio"
                    name="rel-direction"
                    checked={relDirection === 'new_is_parent'}
                    onChange={() => setRelDirection('new_is_parent')}
                    className="h-3.5 w-3.5 text-brand-600"
                  />
                  New person is {relType}
                </label>
              </div>
            )
          ) : null}
        </div>
      )}

      {/* Pre-filled relationship indicator */}
      {hasPrefill && (
        <div className="rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-700">
          Will be added as{' '}
          <span className="font-medium">
            {prefillRelationship.type === 'spouse'
              ? 'spouse'
              : prefillRelationship.direction === 'new_is_parent'
                ? prefillRelationship.type
                : 'child'}
          </span>{' '}
          of{' '}
          <span className="font-medium">
            {allNodes.find((n) => n.id === prefillRelationship.targetNodeId)
              ? getNodeLabel(allNodes.find((n) => n.id === prefillRelationship.targetNodeId)!)
              : 'selected person'}
          </span>
        </div>
      )}

      {/* Also link the other parent */}
      {coParent && relDirection === 'new_is_child' && (
        <label className="flex items-center gap-2 text-sm text-stone-700">
          <input
            type="checkbox"
            checked={linkCoParent}
            onChange={(e) => setLinkCoParent(e.target.checked)}
            disabled={isSubmitting}
            className="h-4 w-4 rounded border-stone-300 text-brand-600 focus:ring-brand-500"
          />
          Also add as child of <span className="font-medium">{coParent.label}</span>
        </label>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-bold text-stone-700 shadow-sm hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-60"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-full bg-brand-500 px-4 py-2 text-sm font-bold text-white hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 shadow-[0_3px_0_0_var(--color-brand-700)] disabled:shadow-none"
        >
          {isSubmitting ? 'Adding...' : 'Add Person'}
        </button>
      </div>
    </form>
  );
}
