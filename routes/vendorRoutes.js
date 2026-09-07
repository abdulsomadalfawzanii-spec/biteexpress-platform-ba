const express = require('express');
const router = express.Router();
const Vendor = require('../models/Vendor');
const MenuItem = require('../models/MenuItem');
const Order = require('../models/Order');
const Notification = require('../models/Notification');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);

const requireApprovedVendor = async (req, res, next) => {
  const vendor = await Vendor.findOne({ user: req.user._id });
  if (!vendor || vendor.approvalStatus !== 'approved') {
    return res.status(403).json({ success: false, message: 'Your restaurant must be approved before operating.' });
  }
  req.vendor = vendor;
  next();
};

router.get('/profile', authorize('vendor'), async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ user: req.user._id }).populate('user', 'name email phone');
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor profile not found' });
    res.json({ success: true, data: vendor });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch vendor profile' });
  }
});

router.put('/profile', authorize('vendor'), async (req, res) => {
  try {
    const updates = {
      restaurantName: req.body.restaurantName,
      description: req.body.description,
      phone: req.body.phone,
      address: req.body.address,
      cuisineTypes: req.body.cuisineTypes,
      operatingHours: req.body.operatingHours,
      deliveryAreas: req.body.deliveryAreas,
      isOpen: req.body.isOpen,
      payoutInfo: req.body.payoutInfo,
    };

    const vendor = await Vendor.findOneAndUpdate({ user: req.user._id }, updates, { new: true });
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });
    res.json({ success: true, message: 'Vendor profile updated', data: vendor });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update vendor profile' });
  }
});

router.post('/menu', authorize('vendor'), requireApprovedVendor, async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ user: req.user._id });
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

    const menuItem = await MenuItem.create({
      vendor: vendor._id,
      name: req.body.name,
      description: req.body.description || '',
      price: Number(req.body.price),
      category: req.body.category,
      image: req.body.image || '',
      ingredients: req.body.ingredients || [],
      allergens: req.body.allergens || [],
      // Accept both field names from frontend, keep both in sync
      prepTimeMinutes: Number(req.body.prepTimeMinutes || req.body.preparationTime || 20),
      preparationTime: Number(req.body.prepTimeMinutes || req.body.preparationTime || 20),
      availability: req.body.availability !== false,
      isAvailable: req.body.availability !== false,
      promotionalInfo: req.body.promotionalInfo || '',
      approvalStatus: 'approved',
    });

    res.status(201).json({ success: true, message: 'Menu item created', data: menuItem });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create menu item' });
  }
});

router.get('/menu', authorize('vendor'), requireApprovedVendor, async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ user: req.user._id });
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

    const menu = await MenuItem.find({ vendor: vendor._id }).sort({ createdAt: -1 });
    res.json({ success: true, data: menu });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch menu' });
  }
});

router.put('/menu/:itemId', authorize('vendor'), requireApprovedVendor, async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ user: req.user._id });
    const item = await MenuItem.findOne({ _id: req.params.itemId, vendor: vendor._id });
    if (!item) return res.status(403).json({ success: false, message: 'You cannot modify another vendor\'s menu item' });

    // Keep duplicate fields in sync
    const updates = { ...req.body };
    if (updates.prepTimeMinutes !== undefined) updates.preparationTime = Number(updates.prepTimeMinutes);
    if (updates.preparationTime !== undefined) updates.prepTimeMinutes = Number(updates.preparationTime);
    if (updates.availability !== undefined) updates.isAvailable = updates.availability;
    if (updates.isAvailable !== undefined) updates.availability = updates.isAvailable;
    if (updates.image !== undefined) updates.imageUrl = updates.image;

    Object.assign(item, updates);
    await item.save();
    res.json({ success: true, message: 'Menu item updated', data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update menu item' });
  }
});

router.delete('/menu/:itemId', authorize('vendor'), requireApprovedVendor, async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ user: req.user._id });
    const item = await MenuItem.findOne({ _id: req.params.itemId, vendor: vendor._id });
    if (!item) return res.status(403).json({ success: false, message: 'You cannot delete another vendor\'s menu item' });

    await item.deleteOne();
    res.json({ success: true, message: 'Menu item deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete menu item' });
  }
});

router.get('/orders', authorize('vendor'), requireApprovedVendor, async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ user: req.user._id });
    const orders = await Order.find({ vendor: vendor._id }).populate('customer', 'name email phone address').sort({ createdAt: -1 });
    res.json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch orders' });
  }
});

router.patch('/orders/:orderId/status', authorize('vendor'), requireApprovedVendor, async (req, res) => {
  try {
    const { status } = req.body;
    const vendor = await Vendor.findOne({ user: req.user._id });
    const order = await Order.findOne({ _id: req.params.orderId, vendor: vendor._id });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    const allowedStatuses = { pending: ['confirmed', 'rejected'], confirmed: ['preparing', 'rejected'], preparing: ['ready_for_pickup'] };
    if (!(allowedStatuses[order.orderStatus] || []).includes(status)) {
      return res.status(400).json({ success: false, message: `Cannot change an ${order.orderStatus} order to ${status}` });
    }

    order.orderStatus = status;
    order.statusHistory.push({ status, note: 'Vendor updated status', timestamp: new Date() });
    await order.save();

    await Notification.create({
      user: order.customer,
      title: 'Order status updated',
      message: `Your order has been updated to ${status.replace(/_/g, ' ')}`,
      type: 'order',
      relatedOrder: order._id,
    });

    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update order status' });
  }
});

router.get('/analytics', authorize('vendor'), requireApprovedVendor, async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ user: req.user._id });
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

    const allOrders = await Order.find({ vendor: vendor._id });
    const delivered = allOrders.filter((o) => o.orderStatus === 'delivered');

    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(now); weekStart.setDate(now.getDate() - 7);
    const monthStart = new Date(now); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

    const todayOrders = allOrders.filter((o) => new Date(o.createdAt) >= todayStart);
    const weekOrders = allOrders.filter((o) => new Date(o.createdAt) >= weekStart);
    const monthOrders = allOrders.filter((o) => new Date(o.createdAt) >= monthStart);

    const totalRevenue = delivered.reduce((sum, o) => sum + o.total, 0);
    const todayRevenue = delivered.filter((o) => new Date(o.createdAt) >= todayStart).reduce((sum, o) => sum + o.total, 0);
    const weekRevenue = delivered.filter((o) => new Date(o.createdAt) >= weekStart).reduce((sum, o) => sum + o.total, 0);
    const monthRevenue = delivered.filter((o) => new Date(o.createdAt) >= monthStart).reduce((sum, o) => sum + o.total, 0);

    // Popular items — count frequency in delivered orders
    const itemFrequency = {};
    delivered.forEach((order) => {
      order.items.forEach((item) => {
        itemFrequency[item.name] = (itemFrequency[item.name] || 0) + item.quantity;
      });
    });
    const popularItems = Object.entries(itemFrequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    // Weekly revenue chart (last 7 days)
    const weeklyChart = Array.from({ length: 7 }, (_, i) => {
      const day = new Date(now);
      day.setDate(now.getDate() - (6 - i));
      day.setHours(0, 0, 0, 0);
      const nextDay = new Date(day); nextDay.setDate(day.getDate() + 1);
      const dayRevenue = delivered
        .filter((o) => new Date(o.createdAt) >= day && new Date(o.createdAt) < nextDay)
        .reduce((sum, o) => sum + o.total, 0);
      return {
        label: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day.getDay()],
        revenue: +dayRevenue.toFixed(2),
      };
    });

    res.json({
      success: true,
      data: {
        totalRevenue: +totalRevenue.toFixed(2),
        todayRevenue: +todayRevenue.toFixed(2),
        weekRevenue: +weekRevenue.toFixed(2),
        monthRevenue: +monthRevenue.toFixed(2),
        totalOrders: allOrders.length,
        todayOrders: todayOrders.length,
        weekOrders: weekOrders.length,
        monthOrders: monthOrders.length,
        completedOrders: delivered.length,
        pendingOrders: allOrders.filter((o) => o.orderStatus === 'pending').length,
        averageRating: vendor.rating || 0,
        popularItems,
        weeklyChart,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch analytics' });
  }
});

router.get('/notifications', authorize('vendor'), async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, data: notifications });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load notifications' });
  }
});

module.exports = router;
