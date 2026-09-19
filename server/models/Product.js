const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required.'],
      trim: true,
      maxlength: [120, 'Name must be under 120 characters.'],
      unique: true,
    },
    slug: {
      type: String,
      required: [true, 'Slug is required.'],
      trim: true,
      lowercase: true,
      unique: true,
      index: true,
    },
    category: {
      type: String,
      required: [true, 'Category is required.'],
      enum: {
        values: ['Youth', 'Adults', 'Merch'],
        message: '{VALUE} is not a supported category.',
      },
    },
    // Single global baseline: tracked in INR. All conversions derive from this.
    priceInr: {
      type: Number,
      required: [true, 'Base price is required.'],
      min: [1, 'Price must be a positive number.'],
      integer: [true, 'Price must be a whole number.'],
      set: (v) => Math.round(Number(v)),
    },
    stock: {
      type: Number,
      required: [true, 'Stock count is required.'],
      min: [0, 'Stock cannot be negative.'],
      default: 0,
      integer: [true, 'Stock must be a whole number.'],
    },
    flags: {
      type: [{ type: String, enum: ['BESTSELLER', 'TRENDING'] }],
      default: [],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [400, 'Description must be under 400 characters.'],
    },
    image: { type: String, trim: true },
    // Galleries uploaded through the CMS — one entry per storefront sub-view.
    images: {
      type: [String],
      default: [],
    },
    // CMS-managed sizing parameters (e.g. ['S', 'M', 'L', 'XL']).
    sizes: {
      type: [String],
      default: [],
    },
    isActive: { type: Boolean, default: true },
    soldCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Product', productSchema);