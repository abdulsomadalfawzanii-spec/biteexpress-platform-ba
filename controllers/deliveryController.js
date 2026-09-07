const Order = require('../models/Order');
const DeliveryPersonnel = require('../models/DeliveryPersonnel');
const Notification = require('../models/Notification');

exports.getAvailableDeliveries = async (req, res) => {
  try {
    const availableOrders = await Order.find({
      orderStatus: 'ready_for_pickup',
      deliveryPersonnel: null,
    })
      .populate('vendor', 'restaurantName address phone')
      .populate('customer', 'name phone');

    res.status(200).json({ success: true, data: availableOrders });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching available orders', error: error.message });
  }
};

exports.claimDelivery = async (req, res) => {
  try {
    const { orderId } = req.params;

    // Find the DeliveryPersonnel doc (we need its _id for the Order reference)
    const personnel = await DeliveryPersonnel.findOne({ user: req.user._id });
    if (!personnel) {
      return res.status(404).json({ success: false, message: 'Delivery profile not found. Please complete your profile first.' });
    }

    // Atomic claim — only succeeds if deliveryPersonnel is still null
    const order = await Order.findOneAndUpdate(
      { _id: orderId, orderStatus: 'ready_for_pickup', deliveryPersonnel: null },
      {
        deliveryPersonnel: personnel._id,  // Store DeliveryPersonnel doc ID, not User ID
        orderStatus: 'assigned',
        $push: {
          statusHistory: {
            status: 'assigned',
            note: 'Driver claimed delivery',
            timestamp: new Date(),
          },
        },
      },
      { new: true }
    );

    if (!order) {
      return res.status(400).json({ success: false, message: 'Order already claimed or no longer available' });
    }

    // Update delivery personnel record
    await DeliveryPersonnel.findByIdAndUpdate(personnel._id, {
      currentOrder: order._id,
      isAvailable: false,
    });

    // Notify customer
    await Notification.create({
      user: order.customer,
      title: 'Driver assigned',
      message: 'A driver has been assigned and is heading to pick up your order.',
      type: 'delivery',
      relatedOrder: order._id,
    }).catch(() => {});

    res.status(200).json({ success: true, message: 'Delivery claimed successfully', data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error claiming delivery', error: error.message });
  }
};

exports.getMyDeliveries = async (req, res) => {
  try {
    const personnel = await DeliveryPersonnel.findOne({ user: req.user._id });
    if (!personnel) {
      return res.status(200).json({ success: true, data: [] });
    }

    const orders = await Order.find({ deliveryPersonnel: personnel._id })
      .populate('vendor', 'restaurantName address phone')
      .populate('customer', 'name phone')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching your deliveries', error: error.message });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const personnel = await DeliveryPersonnel.findOne({ user: req.user._id })
      .populate('user', 'name email phone');
    if (!personnel) {
      return res.status(404).json({ success: false, message: 'Delivery profile not found' });
    }
    res.status(200).json({ success: true, data: personnel });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load profile' });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const updates = {
      phone: req.body.phone,
      vehicleDetails: req.body.vehicleDetails,
      isOnline: req.body.isOnline,
      payoutDetails: req.body.payoutDetails,
    };
    // Remove undefined keys so we don't overwrite with null
    Object.keys(updates).forEach((key) => updates[key] === undefined && delete updates[key]);

    const personnel = await DeliveryPersonnel.findOneAndUpdate(
      { user: req.user._id },
      updates,
      { new: true, upsert: true }
    ).populate('user', 'name email phone');

    res.status(200).json({ success: true, data: personnel });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update profile' });
  }
};

exports.getEarnings = async (req, res) => {
  try {
    const personnel = await DeliveryPersonnel.findOne({ user: req.user._id });
    if (!personnel) return res.status(200).json({ success: true, data: { totalEarnings: 0, deliveries: [] } });

    const deliveries = await Order.find({
      deliveryPersonnel: personnel._id,
      orderStatus: 'delivered',
    })
      .populate('vendor', 'restaurantName')
      .sort({ createdAt: -1 });

    // Earnings = 8% of order total per delivery
    const earningsPerDelivery = deliveries.map((order) => ({
      orderId: order._id,
      vendorName: order.vendor?.restaurantName || 'Restaurant',
      deliveryAddress: order.deliveryAddress,
      total: order.total,
      earnings: +(order.total * 0.08).toFixed(2),
      completedAt: order.updatedAt,
    }));

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEarnings = earningsPerDelivery
      .filter((d) => new Date(d.completedAt) >= today)
      .reduce((sum, d) => sum + d.earnings, 0);

    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    const weekEarnings = earningsPerDelivery
      .filter((d) => new Date(d.completedAt) >= weekStart)
      .reduce((sum, d) => sum + d.earnings, 0);

    res.status(200).json({
      success: true,
      data: {
        totalEarnings: personnel.totalEarnings || earningsPerDelivery.reduce((s, d) => s + d.earnings, 0),
        todayEarnings: +todayEarnings.toFixed(2),
        weekEarnings: +weekEarnings.toFixed(2),
        totalDeliveries: personnel.totalDeliveriesCompleted,
        rating: personnel.rating,
        deliveries: earningsPerDelivery,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load earnings', error: error.message });
  }
};
