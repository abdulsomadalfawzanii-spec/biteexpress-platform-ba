const mongoose = require('mongoose');

const menuItemSchema = new mongoose.Schema({
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  price: { type: Number, required: true },
  category: { type: String, required: true },
  image: { type: String, default: '' },
  imageUrl: { type: String, default: '' },
  availability: { type: Boolean, default: true },
  isAvailable: { type: Boolean, default: true },
  prepTimeMinutes: { type: Number, default: 20 },
  preparationTime: { type: Number, default: 20 },
  ingredients: [{ type: String }],
  allergens: [{ type: String }],
  promotionalInfo: { type: String, default: '' },
  rating: { type: Number, default: 4.8 },
  approvalStatus: { type: String, default: 'approved' },
}, { timestamps: true });

module.exports = mongoose.model('MenuItem', menuItemSchema);