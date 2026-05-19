import mongoose, { Schema, Document } from 'mongoose';
import { IPharmacyCatalog, MedicineForm } from '@shared/types';

export interface IPharmacyCatalogDocument
  extends Omit<IPharmacyCatalog, '_id' | 'createdAt' | 'updatedAt'>,
    Document {
  createdAt: Date;
  updatedAt: Date;
}

const pharmacyCatalogSchema = new Schema<IPharmacyCatalogDocument>(
  {
    name: { type: String, required: true, trim: true },
    brand: { type: String, required: true, trim: true },
    genericName: { type: String, required: true, trim: true },
    strength: { type: String, required: true, trim: true },
    form: {
      type: String,
      enum: Object.values(MedicineForm),
      required: true,
    },
    mrp: { type: Number, required: true, min: 0 },
    image: { type: String, default: '' },
    searchTerms: { type: [String], default: [] },
    requiresPrescription: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Text index for fast search across name, brand, generic and search terms
pharmacyCatalogSchema.index(
  { name: 'text', brand: 'text', genericName: 'text', searchTerms: 'text' },
  { weights: { name: 10, brand: 8, genericName: 6, searchTerms: 4 } }
);

// Fast filtering by active status and prescription requirement
pharmacyCatalogSchema.index({ isActive: 1, requiresPrescription: 1 });

export const PharmacyCatalog = mongoose.model<IPharmacyCatalogDocument>(
  'PharmacyCatalog',
  pharmacyCatalogSchema
);
