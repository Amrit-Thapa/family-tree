import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ISession extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  token: string;
  expiresAt: Date;
  createdAt: Date;
  userAgent?: string;
  ipAddress?: string;
}

const SessionSchema = new Schema<ISession>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  token: { type: String, required: true, unique: true, index: true },
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
  userAgent: { type: String },
  ipAddress: { type: String },
});

// TTL index — MongoDB automatically removes documents once expiresAt is reached.
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Session =
  (mongoose.models.Session as mongoose.Model<ISession>) ??
  mongoose.model<ISession>('Session', SessionSchema);

export default Session;
