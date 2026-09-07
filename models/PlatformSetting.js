const mongoose = require('mongoose');

const platformSettingSchema = new mongoose.Schema(
  {
    platformName: { type: String, default: 'BiteExpress' },
    defaultCommissionRate: { type: Number, default: 0.15 },
    baseDeliveryFee: { type: Number, default: 3.99 },
    taxRate: { type: Number, default: 0.0825 },
    requireVendorApproval: { type: Boolean, default: true },
    requireDeliveryVerification: { type: Boolean, default: true },
    maintenanceMode: { type: Boolean, default: false },
    lastUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PlatformSetting', platformSettingSchema);