const mongoose = require('mongoose');

const vendorSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },

    restaurantName: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      default: '',
    },

    phone: {
      type: String,
      default: '',
    },

    address: {
      type: String,
      default: '',
    },

    cuisineTypes: {
      type: [String],
      default: [],
    },

    operatingHours: {
      open: {
        type: String,
        default: '08:00',
      },
      close: {
        type: String,
        default: '22:00',
      },
    },

    deliveryAreas: {
      type: [String],
      default: [],
    },

    isOpen: {
      type: Boolean,
      default: true,
    },

    coverImage: {
      type: String,
      default: '',
    },

    commissionRate: {
      type: Number,
      default: 0.15,
    },

    // Kept for admin management, but DOES NOT block vendor operation.
    approvalStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'approved',
    },

    verificationStatus: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'verified',
    },

    rating: {
      type: Number,
      default: 4.8,
    },

    reviewCount: {
      type: Number,
      default: 0,
    },

    numRatings: {
      type: Number,
      default: 0,
    },

    payoutInfo: {
      type: Object,
      default: {},
    },

    // Kept for backward compatibility/admin reporting.
    isApproved: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Vendor', vendorSchema);