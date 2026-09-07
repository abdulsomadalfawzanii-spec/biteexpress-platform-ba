const mongoose = require('mongoose');

const deliveryPersonnelSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  phone: { type: String, default: '' },
  verificationStatus: { type: String, enum: ['pending', 'verified'], default: 'pending' },
  vehicleDetails: {
    vehicleType: {
      type: String,
      enum: ['Bicycle', 'Motorcycle', 'Scooter', 'Car', 'Van'],
      required: true,
      default: 'Car'
    },
    licensePlate: { type: String, default: '' },
    model: { type: String, default: '' }
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  currentLocation: {
    lat: { type: Number },
    lng: { type: Number },
    lastUpdated: { type: Date }
  },
  currentOrder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    default: null
  },
  totalDeliveriesCompleted: {
    type: Number,
    default: 0
  },
  rating: {
    type: Number,
    default: 5.0
  },
  totalEarnings: {
    type: Number,
    default: 0
  },
  payoutDetails: {
    bankName: { type: String },
    accountNumber: { type: String },
    routingNumber: { type: String }
  }
}, { timestamps: true });

module.exports = mongoose.model('DeliveryPersonnel', deliveryPersonnelSchema);