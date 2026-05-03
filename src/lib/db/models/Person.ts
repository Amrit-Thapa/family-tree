import mongoose, { Schema, Document, Types } from 'mongoose';

export type FieldVisibilityLevel =
  | 'all_members'
  | 'admins_only'
  | 'owner_and_admins';

export interface IFieldVisibility {
  dateOfBirth: FieldVisibilityLevel;
  phoneNumber: FieldVisibilityLevel;
  email: FieldVisibilityLevel;
  biography: FieldVisibilityLevel;
}

export interface IPersonLocation {
  city?: string;
  country?: string;
}

export interface IPerson extends Document {
  _id: Types.ObjectId;
  firstName: string;
  lastName?: string;
  maidenName?: string;
  dateOfBirth?: Date;
  dateOfDeath?: Date;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  profession?: string;
  location?: IPersonLocation;
  phoneNumber?: string;
  email?: string;
  biography?: string;
  profilePhotoId?: Types.ObjectId;
  fieldVisibility: IFieldVisibility;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  deletedBy: Types.ObjectId | null;
}

const VISIBILITY_ENUM: FieldVisibilityLevel[] = [
  'all_members',
  'admins_only',
  'owner_and_admins',
];

const PersonSchema = new Schema<IPerson>(
  {
    firstName: { type: String, required: true, maxlength: 100 },
    lastName: { type: String, maxlength: 100 },
    maidenName: { type: String, maxlength: 100 },
    dateOfBirth: { type: Date },
    dateOfDeath: { type: Date },
    gender: {
      type: String,
      enum: ['male', 'female', 'other', 'prefer_not_to_say'],
    },
    profession: { type: String, maxlength: 200 },
    location: {
      city: { type: String, maxlength: 100 },
      country: { type: String, maxlength: 100 },
    },
    phoneNumber: { type: String, maxlength: 30 },
    email: { type: String, maxlength: 200 },
    biography: { type: String, maxlength: 2000 },
    profilePhotoId: { type: Schema.Types.ObjectId, ref: 'MediaAsset' },
    fieldVisibility: {
      dateOfBirth: {
        type: String,
        enum: VISIBILITY_ENUM,
        default: 'all_members',
      },
      phoneNumber: {
        type: String,
        enum: VISIBILITY_ENUM,
        default: 'all_members',
      },
      email: {
        type: String,
        enum: VISIBILITY_ENUM,
        default: 'all_members',
      },
      biography: {
        type: String,
        enum: VISIBILITY_ENUM,
        default: 'all_members',
      },
    },
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

// Full-text search on name fields.
PersonSchema.index(
  { firstName: 'text', lastName: 'text', maidenName: 'text' },
  { name: 'person_name_text' }
);
PersonSchema.index({ email: 1 });
PersonSchema.index({ deletedAt: 1 });
PersonSchema.index({ 'location.city': 1, 'location.country': 1 });

const Person =
  (mongoose.models.Person as mongoose.Model<IPerson>) ??
  mongoose.model<IPerson>('Person', PersonSchema);

export default Person;
