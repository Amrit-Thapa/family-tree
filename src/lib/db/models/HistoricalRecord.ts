import mongoose, { Schema, Document, Types } from 'mongoose';

export type HistoricalRecordType =
  | 'life_event'
  | 'story'
  | 'migration'
  | 'document'
  | 'note'
  | 'custom';

export interface IHistoricalRecord extends Document {
  _id: Types.ObjectId;
  personId: Types.ObjectId;
  treeId: Types.ObjectId;
  type: HistoricalRecordType;
  title: string;
  description?: string;
  date?: Date;
  endDate?: Date;
  mediaAssetIds: Types.ObjectId[];
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  deletedBy: Types.ObjectId | null;
}

const HistoricalRecordSchema = new Schema<IHistoricalRecord>(
  {
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
    type: {
      type: String,
      enum: ['life_event', 'story', 'migration', 'document', 'note', 'custom'],
      required: true,
    },
    title: { type: String, required: true, maxlength: 200 },
    description: { type: String, maxlength: 5000 },
    date: { type: Date },
    endDate: { type: Date },
    mediaAssetIds: [{ type: Schema.Types.ObjectId, ref: 'MediaAsset' }],
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
  }
);

// Records for a person, ordered by date (most recent first), excluding deleted.
HistoricalRecordSchema.index({ personId: 1, deletedAt: 1, date: -1 });
// Records scoped to a tree.
HistoricalRecordSchema.index({ treeId: 1, deletedAt: 1 });

const HistoricalRecord =
  (mongoose.models.HistoricalRecord as mongoose.Model<IHistoricalRecord>) ??
  mongoose.model<IHistoricalRecord>('HistoricalRecord', HistoricalRecordSchema);

export default HistoricalRecord;
