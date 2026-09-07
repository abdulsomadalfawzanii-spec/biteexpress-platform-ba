const Order = require('../models/Order');
const Vendor = require('../models/Vendor');
const Notification = require('../models/Notification');
const MenuItem = require('../models/MenuItem');
const DeliveryPersonnel = require('../models/DeliveryPersonnel');
const stripeLib = process.env.STRIPE_SECRET_KEY ? require('stripe')(process.env.STRIPE_SECRET_KEY) : null;

exports.createOrder = async (req, res) => {
  try {
    const { vendor, items, deliveryAddress, customerNote, customerPhone, paymentMethod = 'card' } = req.body;

    if (!vendor || !items || !items.length || !deliveryAddress) {
      return res.status(400).json({ success: false, message: 'vendor, items, and deliveryAddress are required' });
    }

    // Verify vendor exists and is approved
    const vendorDoc = await Vendor.findById(vendor);
    if (!vendorDoc) return res.status(404).json({ success: false, message: 'Vendor not found' });
    if (vendorDoc.approvalStatus !== 'approved') {
      return res.status(400).json({ success: false, message: 'This restaurant is not currently accepting orders' });
    }

    const requestedItems = items.map((item) => ({ menuItem: item.menuItem || item.id, quantity: Number(item.quantity) }));
    if (requestedItems.some((item) => !item.menuItem || !Number.isInteger(item.quantity) || item.quantity < 1)) {
      return res.status(400).json({ success: false, message: 'Each order item requires a valid menu item and quantity.' });
    }

    const menuItems = await MenuItem.find({
      _id: { $in: requestedItems.map((item) => item.menuItem) },
      vendor: vendorDoc._id,
      availability: true,
      isAvailable: true,
    });
    if (menuItems.length !== requestedItems.length) {
      return res.status(400).json({ success: false, message: 'One or more items are unavailable or do not belong to this restaurant.' });
    }

    const itemById = new Map(menuItems.map((item) => [String(item._id), item]));
    const verifiedItems = requestedItems.map(({ menuItem, quantity }) => {
      const item = itemById.get(String(menuItem));
      return { menuItem: item._id, name: item.name, quantity, price: item.price };
    });
    const subtotal = verifiedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const deliveryFee = subtotal >= 35 ? 0 : 3.99;
    const tax = +(subtotal * 0.0825).toFixed(2);
    const discount = 0;
    const total = +(subtotal + deliveryFee + tax - discount).toFixed(2);

    const order = new Order({
      customer: req.user._id,
      vendor,
      items: verifiedItems,
      subtotal,
      deliveryFee,
      tax,
      discount,
      total,
      deliveryAddress,
      customerPhone: customerPhone || req.user.phone || '',
      customerNote: customerNote || '',
      paymentMethod,
      paymentStatus: 'pending',
      orderStatus: 'pending',
      statusHistory: [{ status: 'pending', note: 'Order placed by customer', timestamp: new Date() }],
    });

    const savedOrder = await order.save();

    // Notify the vendor of new order
    await Notification.create({
      user: vendorDoc.user,
      title: 'New order received',
      message: `A new order has been placed for ${verifiedItems.length} item(s). Total: $${total.toFixed(2)}`,
      type: 'order',
      relatedOrder: savedOrder._id,
    }).catch(() => {}); // Non-blocking

    // Stripe integration when configured
    if (stripeLib) {
      try {
        const paymentIntent = await stripeLib.paymentIntents.create({
          amount: Math.round(Number(savedOrder.total) * 100),
          currency: 'usd',
          metadata: { orderId: savedOrder._id.toString() },
        });
        savedOrder.stripePaymentId = paymentIntent.id;
        // NOTE: Do NOT mark as 'paid' here — payment must be confirmed via webhook
        await savedOrder.save();
        return res.status(201).json({
          success: true,
          data: { order: savedOrder, clientSecret: paymentIntent.client_secret },
        });
      } catch (stripeError) {
        console.error('Stripe error (order still created):', stripeError.message);
      }
    }

    res.status(201).json({ success: true, data: { order: savedOrder } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getCustomerOrders = async (req, res) => {
  try {
    const orders = await Order.find({ customer: req.user._id })
      .populate('vendor', 'restaurantName coverImage address')
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load customer orders' });
  }
};

exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId)
      .populate('vendor', 'restaurantName coverImage address phone')
      .populate('customer', 'name email phone')
      .populate('deliveryPersonnel', 'user phone vehicleDetails rating');

    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    // Access control: allow order's customer, vendor's user, assigned delivery person, or admin
    const role = req.user.role;
    if (role === 'admin') {
      return res.status(200).json({ success: true, data: order });
    }
    if (role === 'customer' && String(order.customer?._id || order.customer) === String(req.user._id)) {
      return res.status(200).json({ success: true, data: order });
    }
    if (role === 'vendor') {
      const vendorDoc = await Vendor.findOne({ user: req.user._id });
      if (vendorDoc && String(order.vendor?._id || order.vendor) === String(vendorDoc._id)) {
        return res.status(200).json({ success: true, data: order });
      }
    }
    if (role === 'delivery' && order.deliveryPersonnel) {
      if (String(order.deliveryPersonnel.user || order.deliveryPersonnel) === String(req.user._id)) {
        return res.status(200).json({ success: true, data: order });
      }
    }

    return res.status(403).json({ success: false, message: 'You do not have access to this order' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load order details' });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, deliveryPersonnelId, note } = req.body;

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    // Role-based ownership and state-transition enforcement.
    const role = req.user.role;
    const vendorStatuses = ['confirmed', 'rejected', 'preparing', 'ready_for_pickup'];
    const deliveryStatuses = ['picked_up', 'on_the_way', 'delivered'];
    const adminStatuses = ['pending', 'confirmed', 'rejected', 'preparing', 'ready_for_pickup', 'assigned', 'picked_up', 'on_the_way', 'delivered', 'cancelled'];

    if (!status) return res.status(400).json({ success: false, message: 'A status is required' });
    if (role === 'vendor' && !vendorStatuses.includes(status)) {
      return res.status(403).json({ success: false, message: `Vendors can only set: ${vendorStatuses.join(', ')}` });
    }
    if (role === 'delivery' && !deliveryStatuses.includes(status)) {
      return res.status(403).json({ success: false, message: `Delivery can only set: ${deliveryStatuses.join(', ')}` });
    }
    if (role === 'admin' && !adminStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid order status' });
    }

    if (role === 'vendor') {
      const vendor = await Vendor.findOne({ user: req.user._id });
      if (!vendor || String(order.vendor) !== String(vendor._id)) return res.status(403).json({ success: false, message: 'You do not own this order' });
    }
    if (role === 'delivery') {
      const driver = await DeliveryPersonnel.findOne({ user: req.user._id });
      if (!driver || String(order.deliveryPersonnel) !== String(driver._id)) return res.status(403).json({ success: false, message: 'This delivery is not assigned to you' });
    }

    const transitions = {
      pending: ['confirmed', 'rejected'],
      confirmed: ['preparing', 'rejected'],
      preparing: ['ready_for_pickup'],
      assigned: ['picked_up'],
      picked_up: ['on_the_way'],
      on_the_way: ['delivered'],
    };
    if (role !== 'admin' && !(transitions[order.orderStatus] || []).includes(status)) {
      return res.status(400).json({ success: false, message: `Cannot change an ${order.orderStatus} order to ${status}` });
    }

    if (status) {
      order.orderStatus = status;
      order.statusHistory.push({
        status,
        note: note || `Status updated by ${role}`,
        timestamp: new Date(),
      });
    }

    if (deliveryPersonnelId) order.deliveryPersonnel = deliveryPersonnelId;

    // Mark as paid when delivered (fallback for non-Stripe installs)
    if (status === 'delivered' && order.paymentStatus === 'pending') {
      order.paymentStatus = 'paid';
    }

    await order.save();

    if (status === 'delivered' && order.deliveryPersonnel) {
      const earnings = +(order.total * 0.08).toFixed(2);
      await DeliveryPersonnel.findByIdAndUpdate(order.deliveryPersonnel, {
        $inc: { totalDeliveriesCompleted: 1, totalEarnings: earnings },
        $set: { currentOrder: null, isAvailable: true },
      });
    }

    // Notify customer of status change
    const statusMessages = {
      confirmed: 'Your order has been confirmed by the restaurant!',
      rejected: 'Your order was rejected by the restaurant.',
      preparing: 'The kitchen is now preparing your order.',
      ready_for_pickup: 'Your order is ready and waiting for a driver.',
      assigned: 'A driver has been assigned to your delivery.',
      picked_up: 'Your order has been picked up by the driver.',
      on_the_way: 'Your order is on its way!',
      delivered: 'Your order has been delivered. Enjoy your meal!',
      cancelled: 'Your order has been cancelled.',
    };

    if (statusMessages[status]) {
      await Notification.create({
        user: order.customer,
        title: `Order ${status.replace(/_/g, ' ')}`,
        message: statusMessages[status],
        type: 'order',
        relatedOrder: order._id,
      }).catch(() => {});
    }

    const populated = await Order.findById(order._id)
      .populate('vendor', 'restaurantName address')
      .populate('customer', 'name email phone');

    res.json({ success: true, data: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
