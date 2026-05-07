import mongoose, { Schema, Document, Types } from 'mongoose';
import { INVITE_LABEL_MAX, DEFAULT_MAX_USES } from '@/lib/constants/invite';

export { INVITE_LABEL_MAX, DEFAULT_MAX_USES };

export type InviteStatus = 'active' | 'expired' | 'revoked' | 'exhausted';

export interface IInviteAcceptance {
  userId: Types.ObjectId;
  acceptedAt: Date;
}

export interface IInvite extends Document {
  _id: Types.ObjectId;
  treeId: Types.ObjectId;
  role: 'admin' | 'editor' | 'viewer';
  token: string;
  label?: string;
  invitedBy: Types.ObjectId;
  status: InviteStatus;
  maxUses: number;
  usedCount: number;
  expiresAt: Date;
  acceptedBy: IInviteAcceptance[];
  createdAt: Date;
  computedStatus(): InviteStatus;
  isAcceptable(): boolean;
}

export interface IInviteModel extends mongoose.Model<IInvite> {
  acceptForUser(
    inviteId: Types.ObjectId,
    userId: Types.ObjectId
  ): Promise<IInvite | null>;
}

const InviteAcceptanceSchema = new Schema<IInviteAcceptance>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    acceptedAt: { type: Date, required: true, default: Date.now },
  },
  { _id: false }
);

const InviteSchema = new Schema<IInvite>({
  treeId: {
    type: Schema.Types.ObjectId,
    ref: 'FamilyTree',
    required: true,
  },
  role: {
    type: String,
    enum: ['admin', 'editor', 'viewer'],
    required: true,
  },
  token: { type: String, required: true, unique: true, index: true },
  label: { type: String, maxlength: INVITE_LABEL_MAX },
  invitedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  status: {
    type: String,
    enum: ['active', 'expired', 'revoked', 'exhausted'],
    default: 'active',
  },
  maxUses: { type: Number, default: DEFAULT_MAX_USES },
  usedCount: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
  acceptedBy: { type: [InviteAcceptanceSchema], default: [] },
  createdAt: { type: Date, default: Date.now },
});

// --- Indexes ---

// Look up invites by tree + status (e.g., list active invites for a tree).
InviteSchema.index({ treeId: 1, status: 1 });
// Expiry-based queries.
InviteSchema.index({ expiresAt: 1 });
// Supports lookup of acceptances by userId (application-level duplicate prevention).
InviteSchema.index({ 'acceptedBy.userId': 1 });

// --- Validation ---

// usedCount may equal maxUses (exhausted state) but must never exceed it.
InviteSchema.pre('validate', function () {
  if (this.usedCount > this.maxUses) {
    throw new Error('usedCount cannot exceed maxUses');
  }
});

// --- Methods ---

/**
 * Returns the deterministic status based on current state,
 * regardless of the stored `status` field which may be stale.
 */
InviteSchema.methods.computedStatus = function (): InviteStatus {
  if (this.status === 'revoked') return 'revoked';
  if (this.expiresAt.getTime() < Date.now()) return 'expired';
  if (this.usedCount >= this.maxUses) return 'exhausted';
  return 'active';
};

/**
 * Returns true if this invite can still be accepted (status is effectively 'active').
 */
InviteSchema.methods.isAcceptable = function (): boolean {
  return this.computedStatus() === 'active';
};

// --- Statics ---

/**
 * Atomically accepts an invite for a user, preventing duplicate accepts.
 * Uses findOneAndUpdate with a condition that the userId is not already in acceptedBy,
 * the invite is active, not expired, and has remaining uses.
 * Returns the updated document, or null if the user already accepted or invite is invalid.
 */
InviteSchema.statics.acceptForUser = async function (
  inviteId: Types.ObjectId,
  userId: Types.ObjectId
): Promise<IInvite | null> {
  return this.findOneAndUpdate(
    {
      _id: inviteId,
      status: 'active',
      expiresAt: { $gt: new Date() },
      'acceptedBy.userId': { $ne: userId },
      $expr: { $lt: ['$usedCount', '$maxUses'] },
    },
    {
      $push: { acceptedBy: { userId, acceptedAt: new Date() } },
      $inc: { usedCount: 1 },
    },
    { new: true }
  );
};

const Invite =
  (mongoose.models.Invite as IInviteModel) ??
  mongoose.model<IInvite, IInviteModel>('Invite', InviteSchema);

export default Invite;
