import mongoose, { Schema, Document, Types } from 'mongoose';

export type AuditOperation =
  | 'create'
  | 'update'
  | 'soft_delete'
  | 'restore'
  | 'merge'
  | 'permanent_delete';

export type AuditEntityType =
  | 'person'
  | 'relationship'
  | 'historical_record'
  | 'media_asset'
  | 'membership'
  | 'claim_request'
  | 'merge_request'
  | 'family_tree';

export interface IAuditLog extends Document {
  _id: Types.ObjectId;
  treeId: Types.ObjectId;
  actorUserId?: Types.ObjectId;
  actorDisplayName?: string;
  operation: AuditOperation;
  entityType: AuditEntityType;
  entityId: Types.ObjectId;
  summary: string;
  changes?: Record<string, { old: unknown; new: unknown }>;
  timestamp: Date;
}

const AuditLogSchema = new Schema<IAuditLog>({
  treeId: {
    type: Schema.Types.ObjectId,
    ref: 'FamilyTree',
    required: true,
  },
  actorUserId: { type: Schema.Types.ObjectId, ref: 'User' },
  actorDisplayName: { type: String },
  operation: {
    type: String,
    enum: [
      'create',
      'update',
      'soft_delete',
      'restore',
      'merge',
      'permanent_delete',
    ],
    required: true,
  },
  entityType: {
    type: String,
    enum: [
      'person',
      'relationship',
      'historical_record',
      'media_asset',
      'membership',
      'claim_request',
      'merge_request',
      'family_tree',
    ],
    required: true,
  },
  entityId: { type: Schema.Types.ObjectId, required: true },
  summary: { type: String, required: true, maxlength: 500 },
  changes: { type: Schema.Types.Mixed },
  timestamp: { type: Date, default: Date.now },
});

// Paginated audit log viewing (most recent first).
AuditLogSchema.index({ treeId: 1, timestamp: -1 });
// Entity history lookup.
AuditLogSchema.index({ entityType: 1, entityId: 1 });
// TTL: automatically remove audit entries after 1 year (31 536 000 seconds).
AuditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 31536000 });

const AuditLog =
  (mongoose.models.AuditLog as mongoose.Model<IAuditLog>) ??
  mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);

export default AuditLog;
