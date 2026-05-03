import mongoose, { Schema, Document, Types } from 'mongoose';

export type MergeStatus = 'pending' | 'confirmed' | 'undone';

export interface IMergeRequest extends Document {
  _id: Types.ObjectId;
  treeId: Types.ObjectId;
  sourcePersonId: Types.ObjectId;
  targetPersonId: Types.ObjectId;
  fieldResolutions?: Record<string, 'source' | 'target'>;
  status: MergeStatus;
  initiatedBy: Types.ObjectId;
  confirmedAt?: Date;
  undoneAt?: Date;
  undoneBy?: Types.ObjectId;
  createdAt: Date;
}

const MergeRequestSchema = new Schema<IMergeRequest>({
  treeId: {
    type: Schema.Types.ObjectId,
    ref: 'FamilyTree',
    required: true,
  },
  sourcePersonId: {
    type: Schema.Types.ObjectId,
    ref: 'Person',
    required: true,
  },
  targetPersonId: {
    type: Schema.Types.ObjectId,
    ref: 'Person',
    required: true,
  },
  fieldResolutions: { type: Schema.Types.Mixed },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'undone'],
    default: 'pending',
  },
  initiatedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  confirmedAt: { type: Date },
  undoneAt: { type: Date },
  undoneBy: { type: Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
});

// List merge requests by tree and status.
MergeRequestSchema.index({ treeId: 1, status: 1 });

const MergeRequest =
  (mongoose.models.MergeRequest as mongoose.Model<IMergeRequest>) ??
  mongoose.model<IMergeRequest>('MergeRequest', MergeRequestSchema);

export default MergeRequest;
