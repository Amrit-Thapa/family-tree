import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IMediaAsset extends Document {
  _id: Types.ObjectId;
  filename: string;
  storagePath: string;
  storageFilename: string;
  mimeType: string;
  sizeBytes: number;
  personId?: Types.ObjectId;
  historicalRecordId?: Types.ObjectId;
  treeId: Types.ObjectId;
  uploadedBy: Types.ObjectId;
  uploadedAt: Date;
  deletedAt: Date | null;
  deletedBy: Types.ObjectId | null;
}

const MediaAssetSchema = new Schema<IMediaAsset>({
  filename: { type: String, required: true },
  storagePath: { type: String, required: true },
  storageFilename: { type: String, required: true },
  mimeType: { type: String, required: true },
  sizeBytes: { type: Number, required: true },
  personId: { type: Schema.Types.ObjectId, ref: 'Person' },
  historicalRecordId: {
    type: Schema.Types.ObjectId,
    ref: 'HistoricalRecord',
  },
  treeId: {
    type: Schema.Types.ObjectId,
    ref: 'FamilyTree',
    required: true,
  },
  uploadedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  uploadedAt: { type: Date, default: Date.now },
  deletedAt: { type: Date, default: null },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
});

// Photos for a person.
MediaAssetSchema.index({ personId: 1, deletedAt: 1 });
// Files attached to a historical record.
MediaAssetSchema.index({ historicalRecordId: 1, deletedAt: 1 });
// Storage calculation per tree.
MediaAssetSchema.index({ treeId: 1, deletedAt: 1 });
// Serve files by their non-guessable storage name.
MediaAssetSchema.index({ storageFilename: 1 });

const MediaAsset =
  (mongoose.models.MediaAsset as mongoose.Model<IMediaAsset>) ??
  mongoose.model<IMediaAsset>('MediaAsset', MediaAssetSchema);

export default MediaAsset;
