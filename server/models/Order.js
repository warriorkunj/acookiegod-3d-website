const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product reference is required.'],
    },
    slug: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    qty: {
      type: Number,
      required: [true, 'Quantity is required.'],
      min: [1, 'Quantity must be at least 1.'],
      integer: true,
    },
    // Server-authoritative unit price at order time, always stored in INR.
    priceInr: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true, index: true },
    sessionId: { type: String, required: true, unique: true, trim: true },
    items: {
      type: [orderItemSchema],
      validate: {
        validator: (v) => Array.isArray(v) && v.length >= 1,
        message: 'An order must contain at least one item.',
      },
    },
    customerEmail: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^[\w.+-]+@[\w-]+(\.[\w-]+)+$/, 'Invalid customer email.'],
    },
    subtotalInr: { type: Number, required: true, min: 0 },
    shippingInr: { type: Number, required: true, min: 0, default: 0 },
    totalInr: { type: Number, required: true, min: 0 },
    currencyCode: {
      type: String,
      enum: ['INR', 'USD', 'EUR'],
      default: 'INR',
      uppercase: true,
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed'],
      default: 'pending',
    },
    paymentId: { type: String, trim: true, default: '' },
    gatewayRef: { type: String, trim: true, default: '' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', orderSchema);