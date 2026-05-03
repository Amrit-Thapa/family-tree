import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IFamilyTree extends Document {
  _id: Types.ObjectId;
  name: string;
  description?: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  deletedBy: Types.ObjectId | null;
  totalStorageBytes: number;
  storageLimit: number;
}

const FamilyTreeSchema = new Schema<IFamilyTree>(
  {
    name: { type: String, required: true, maxlength: 100 },
    description: { type: String, maxlength: 500 },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    totalStorageBytes: { type: Number, default: 0 },
    storageLimit: { type: Number, default: 524288000 }, // 500 MB
  },
  {
    timestamps: true,
  }
);

// Unique tree name per creator.
FamilyTreeSchema.index({ createdBy: 1, name: 1 }, { unique: true });
// Fast filtering of active (non-deleted) trees.
FamilyTreeSchema.index({ deletedAt: 1 });

const FamilyTree =
  (mongoose.models.FamilyTree as mongoose.Model<IFamilyTree>) ??
  mongoose.model<IFamilyTree>('FamilyTree', FamilyTreeSchema);

export default FamilyTree;
