const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    menuItem: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem' },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: '' },
  },
  { timestamps: true }
);

reviewSchema.index({ order: 1, customer: 1 }, { unique: true });

module.exports = mongoose.model('Review', reviewSchema);
