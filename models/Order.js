const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
  {
    menuItem: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem', required: true },
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
    deliveryPersonnel: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryPersonnel' },
    items: [orderItemSchema],
    subtotal: { type: Number, required: true, default: 0 },
    deliveryFee: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    total: { type: Number, required: true, default: 0 },
    deliveryAddress: { type: String, required: true },
    customerPhone: { type: String, default: '' },
    paymentMethod: { type: String, default: 'card' },
    paymentStatus: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' },
    stripePaymentId: { type: String, default: '' },
    stripeTransactionId: { type: String, default: '' },
    orderStatus: {
      type: String,
      enum: ['pending', 'confirmed', 'rejected', 'preparing', 'ready_for_pickup', 'assigned', 'picked_up', 'on_the_way', 'delivered', 'cancelled'],
      default: 'pending',
    },
    statusHistory: [
      {
        status: { type: String },
        note: { type: String },
        timestamp: { type: Date, default: Date.now },
      },
    ],
    customerNote: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', orderSchema);