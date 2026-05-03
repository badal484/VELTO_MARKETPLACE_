import mongoose, { Schema, Document } from 'mongoose';
import { IServiceZone } from '@shared/types';

export interface IServiceZoneSchema extends Omit<IServiceZone, '_id' | 'createdAt' | 'updatedAt'>, Document {}

const serviceZoneSchema = new Schema<IServiceZoneSchema>(
  {
    name: { type: String, required: true, unique: true },
    center: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true }, // [lng, lat]
    },
    radius: { type: Number, required: true }, // in km
    isActive: { type: Boolean, default: true },
    city: { type: String, required: true },
  },
  { timestamps: true }
);

serviceZoneSchema.index({ center: '2dsphere' });

export const ServiceZone = mongoose.model<IServiceZoneSchema>('ServiceZone', serviceZoneSchema);
