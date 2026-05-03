import mongoose, { Schema, Document, Types } from 'mongoose';

export interface INotificationPreferences {
  invites: boolean;
  claims: boolean;
  membershipChanges: boolean;
  treeUpdates: boolean;
  crossTreeEdits: boolean;
}

export interface IUser extends Document {
  _id: Types.ObjectId;
  firebaseUid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  deletedBy: Types.ObjectId | null;
  notificationPreferences: INotificationPreferences;
}

const UserSchema = new Schema<IUser>(
  {
    firebaseUid: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true, index: true },
    displayName: { type: String, required: true },
    photoURL: { type: String },
    lastLoginAt: { type: Date },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    notificationPreferences: {
      invites: { type: Boolean, default: true },
      claims: { type: Boolean, default: true },
      membershipChanges: { type: Boolean, default: true },
      treeUpdates: { type: Boolean, default: true },
      crossTreeEdits: { type: Boolean, default: true },
    },
  },
  {
    timestamps: true,
  }
);

const User =
  (mongoose.models.User as mongoose.Model<IUser>) ??
  mongoose.model<IUser>('User', UserSchema);

export default User;
