import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IDisplayPosition {
  x: number;
  y: number;
}

export interface ITreeNode extends Document {
  _id: Types.ObjectId;
  personId: Types.ObjectId;
  treeId: Types.ObjectId;
  linkedUserId: Types.ObjectId | null;
  displayPosition: IDisplayPosition;
  addedBy: Types.ObjectId;
  addedAt: Date;
  deletedAt: Date | null;
  deletedBy: Types.ObjectId | null;
}

const TreeNodeSchema = new Schema<ITreeNode>({
  personId: {
    type: Schema.Types.ObjectId,
    ref: 'Person',
    required: true,
  },
  treeId: {
    type: Schema.Types.ObjectId,
    ref: 'FamilyTree',
    required: true,
  },
  linkedUserId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  displayPosition: {
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 },
  },
  addedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  addedAt: { type: Date, default: Date.now },
  deletedAt: { type: Date, default: null },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
});

// One person per tree (soft-delete aware).
TreeNodeSchema.index(
  { personId: 1, treeId: 1, deletedAt: 1 },
  { unique: true }
);
// List all active persons in a tree.
TreeNodeSchema.index({ treeId: 1, deletedAt: 1 });
// Find which trees reference a person.
TreeNodeSchema.index({ personId: 1, deletedAt: 1 });
// Find a user's linked person in a specific tree.
TreeNodeSchema.index({ linkedUserId: 1, treeId: 1 });

const TreeNode =
  (mongoose.models.TreeNode as mongoose.Model<ITreeNode>) ??
  mongoose.model<ITreeNode>('TreeNode', TreeNodeSchema);

export default TreeNode;
