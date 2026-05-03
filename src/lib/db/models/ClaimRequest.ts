import mongoose, { Schema, Document, Types } from 'mongoose';

export type ClaimStatus = 'pending' | 'approved' | 'rejected';

export interface IClaimRequest extends Document {
  _id: Types.ObjectId;
  treeId: Types.ObjectId;
  personId: Types.ObjectId;
  claimantUserId: Types.ObjectId;
  status: ClaimStatus;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  rejectionReason?: string;
  createdAt: Date;
}

const ClaimRequestSchema = new Schema<IClaimRequest>({
  treeId: {
    type: Schema.Types.ObjectId,
    ref: 'FamilyTree',
    required: true,
  },
  personId: {
    type: Schema.Types.ObjectId,
    ref: 'Person',
    required: true,
  },
  claimantUserId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: { type: Date },
  rejectionReason: { type: String, maxlength: 500 },
  createdAt: { type: Date, default: Date.now },
});

// List pending claims for a tree (admin view).
ClaimRequestSchema.index({ treeId: 1, status: 1 });
// Find claims by a specific user.
ClaimRequestSchema.index({ claimantUserId: 1 });
// Prevent duplicate claims for the same person by the same user in a tree.
ClaimRequestSchema.index({ treeId: 1, personId: 1, claimantUserId: 1 });

const ClaimRequest =
  (mongoose.models.ClaimRequest as mongoose.Model<IClaimRequest>) ??
  mongoose.model<IClaimRequest>('ClaimRequest', ClaimRequestSchema);

export default ClaimRequest;
