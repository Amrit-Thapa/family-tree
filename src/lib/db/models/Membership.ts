import mongoose, { Schema, Document, Types } from 'mongoose';

export type MembershipRole = 'admin' | 'editor' | 'viewer';

export interface IMembership extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  treeId: Types.ObjectId;
  role: MembershipRole;
  joinedAt: Date;
  invitedBy?: Types.ObjectId;
  deletedAt: Date | null;
  deletedBy: Types.ObjectId | null;
}

const MembershipSchema = new Schema<IMembership>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
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
  joinedAt: { type: Date, default: Date.now },
  invitedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  deletedAt: { type: Date, default: null },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
});

// One active membership per user per tree (deletedAt is part of the key so
// a user can be re-invited after removal).
MembershipSchema.index(
  { userId: 1, treeId: 1, deletedAt: 1 },
  { unique: true }
);
// Find all admins of a tree quickly.
MembershipSchema.index({ treeId: 1, role: 1 });
// Find a user's active memberships.
MembershipSchema.index({ userId: 1, deletedAt: 1 });

const Membership =
  (mongoose.models.Membership as mongoose.Model<IMembership>) ??
  mongoose.model<IMembership>('Membership', MembershipSchema);

export default Membership;
