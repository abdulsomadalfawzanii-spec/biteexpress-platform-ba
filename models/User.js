const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
    default: '',
  },
  role: {
    type: String,
    enum: ['admin', 'vendor', 'customer', 'delivery'],
    default: 'customer',
  },
  address: {
    type: String,
    default: '',
  },
  profileImage: { type: String, default: '' },
  preferences: {
    type: Object,
    default: {},
  },
  accountStatus: {
    type: String,
    enum: ['active', 'pending', 'suspended'],
    default: 'active',
  },
  isEmailVerified: {
    type: Boolean,
    default: false,
  },
  verificationToken: { type: String },
  verificationExpires: { type: Date },
  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date },
  lastLogin: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);