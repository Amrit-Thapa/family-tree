import mongoose, { Schema, Document, Types } from 'mongoose';

export type InviteStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

export interface IInvite extends Document {
  _id: Types.ObjectId;
  treeId: Types.ObjectId;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
  token: string;
  invitedBy: Types.ObjectId;
  status: InviteStatus;
  expiresAt: Date;
  acceptedAt?: Date;
  acceptedBy?: Types.ObjectId;
  createdAt: Date;
}

const InviteSchema = new Schema<IInvite>({
  treeId: {
    type: Schema.Types.ObjectId,
    ref: 'FamilyTree',
    required: true,
  },
  email: { type: String, required: true },
  role: {
    type: String,
    enum: ['admin', 'editor', 'viewer'],
    required: true,
  },
  token: { type: String, required: true, unique: true, index: true },
  invitedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'expired', 'revoked'],
    default: 'pending',
  },
  expiresAt: { type: Date, required: true },
  acceptedAt: { type: Date },
  acceptedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
});

// Look up invites by tree + email (e.g., check for existing invite).
InviteSchema.index({ treeId: 1, email: 1 });
// Expiry-based queries.
InviteSchema.index({ expiresAt: 1 });

const Invite =
  (mongoose.models.Invite as mongoose.Model<IInvite>) ??
  mongoose.model<IInvite>('Invite', InviteSchema);

export default Invite;
