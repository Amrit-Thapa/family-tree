import mongoose, { Schema, Document, Types } from 'mongoose';

export type RelationshipType = 'parent_child' | 'spouse' | 'sibling';
export type RelationshipDirection = 'forward' | 'inverse';

export interface IRelationship extends Document {
  _id: Types.ObjectId;
  treeId: Types.ObjectId;
  fromPersonId: Types.ObjectId;
  toPersonId: Types.ObjectId;
  type: RelationshipType;
  direction: RelationshipDirection;
  label?: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  deletedBy: Types.ObjectId | null;
}

const RelationshipSchema = new Schema<IRelationship>(
  {
    treeId: {
      type: Schema.Types.ObjectId,
      ref: 'FamilyTree',
      required: true,
    },
    fromPersonId: {
      type: Schema.Types.ObjectId,
      ref: 'Person',
      required: true,
    },
    toPersonId: {
      type: Schema.Types.ObjectId,
      ref: 'Person',
      required: true,
    },
    type: {
      type: String,
      enum: ['parent_child', 'spouse', 'sibling'],
      required: true,
    },
    direction: {
      type: String,
      enum: ['forward', 'inverse'],
      required: true,
    },
    label: { type: String, maxlength: 50 },
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

// Adjacency list queries: find all relationships from a person in a tree.
RelationshipSchema.index({ treeId: 1, fromPersonId: 1, deletedAt: 1 });
// Reverse lookups: find all relationships to a person in a tree.
RelationshipSchema.index({ treeId: 1, toPersonId: 1, deletedAt: 1 });
// Prevent duplicate relationships of the same type between two persons.
RelationshipSchema.index(
  { treeId: 1, fromPersonId: 1, toPersonId: 1, type: 1, deletedAt: 1 },
  { unique: true }
);

const Relationship =
  (mongoose.models.Relationship as mongoose.Model<IRelationship>) ??
  mongoose.model<IRelationship>('Relationship', RelationshipSchema);

export default Relationship;
