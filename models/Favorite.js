const mongoose = require('mongoose');

const favoriteSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
    menuItem: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem' },
  },
  { timestamps: true }
);

favoriteSchema.index({ user: 1, vendor: 1 }, { unique: true, sparse: true });
favoriteSchema.index({ user: 1, menuItem: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Favorite', favoriteSchema);
