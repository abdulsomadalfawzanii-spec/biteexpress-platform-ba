const mongoose = require('mongoose');

const vendorSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  restaurantName: { type: String, required: true },
  description: { type: String, default: '' },
  phone: { type: String, default: '' },
  address: { type: String, default: '' },
  cuisineTypes: [{ type: String }],
  operatingHours: {
    open: { type: String, default: '08:00' },
    close: { type: String, default: '22:00' }
  },
  deliveryAreas: [{ type: String }],
  isOpen: { type: Boolean, default: true },
  coverImage: { type: String, default: '' },
  commissionRate: { type: Number, default: 0.15 },
  approvalStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  verificationStatus: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' },
  rating: { type: Number, default: 4.8 },
  reviewCount: { type: Number, default: 0 },
  numRatings: { type: Number, default: 0 },
  payoutInfo: { type: Object, default: {} },
  isApproved: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('Vendor', vendorSchema);