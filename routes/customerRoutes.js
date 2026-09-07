const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Vendor = require('../models/Vendor');
const MenuItem = require('../models/MenuItem');
const Favorite = require('../models/Favorite');
const Review = require('../models/Review');
const Notification = require('../models/Notification');
const Order = require('../models/Order');
const { protect, authorize } = require('../middleware/authMiddleware');

router.get('/restaurants', async (req, res) => {
  try {
    const { search, category, sort = 'recommended', page = 1, limit = 12 } = req.query;
    const query = {};

    if (search) {
      query.$or = [
        { restaurantName: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { cuisineTypes: { $in: [new RegExp(search, 'i')] } },
      ];
    }

    if (category && category !== 'All') {
      query.cuisineTypes = { $in: [category] };
    }

    const skip = (Number(page) - 1) * Number(limit);
    const restaurants = await Vendor.find({ ...query, approvalStatus: 'approved', verificationStatus: 'verified' })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const results = restaurants.map((vendor) => ({
      id: vendor._id,
      name: vendor.restaurantName,
      description: vendor.description,
      image: vendor.coverImage || 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80',
      rating: vendor.rating || 4.8,
      reviewsCount: vendor.reviewCount || 120,
      deliveryTime: '20-30 min',
      deliveryFee: 2.99,
      distance: '0.8 mi',
      minOrder: 15,
      cuisine: vendor.cuisineTypes?.[0] || 'American',
      tags: vendor.cuisineTypes || ['Burgers'],
      isOpen: vendor.isOpen,
    }));

    if (sort === 'rating') {
      results.sort((a, b) => b.rating - a.rating);
    }

    res.json({ success: true, data: results, message: 'Restaurants fetched' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch restaurants' });
  }
});

router.get('/restaurants/:id', async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ _id: req.params.id, approvalStatus: 'approved', verificationStatus: 'verified' }).lean();
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Restaurant not found' });
    }

    const menuItems = await MenuItem.find({ vendor: vendor._id, availability: true, isAvailable: true }).lean();

    res.json({
      success: true,
      data: {
        id: vendor._id,
        name: vendor.restaurantName,
        description: vendor.description,
        image: vendor.coverImage || 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80',
        rating: vendor.rating || 4.8,
        reviewsCount: vendor.reviewCount || 120,
        deliveryTime: '20-30 min',
        deliveryFee: 2.99,
        distance: '0.8 mi',
        minOrder: 15,
        cuisine: vendor.cuisineTypes?.[0] || 'American',
        tags: vendor.cuisineTypes || ['Burgers'],
        isOpen: vendor.isOpen,
        menu: menuItems.map((item) => ({
          id: item._id,
          vendorId: vendor._id,
          name: item.name,
          description: item.description,
          price: item.price,
          category: item.category,
          image: item.image,
          rating: item.rating || 4.8,
          isAvailable: item.availability,
          vendorName: vendor.restaurantName,
        })),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch restaurant details' });
  }
});

router.get('/menu', async (req, res) => {
  try {
    const menu = await MenuItem.find({ availability: true }).populate('vendor', 'restaurantName').lean();
    res.json({ success: true, data: menu.map((item) => ({
      id: item._id,
      vendorId: item.vendor?._id,
      vendorName: item.vendor?.restaurantName,
      name: item.name,
      description: item.description,
      price: item.price,
      category: item.category,
      image: item.image,
      isAvailable: item.availability,
      rating: item.rating || 4.8,
    }))});
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load menu items' });
  }
});

router.get('/favorites', protect, authorize('customer'), async (req, res) => {
  try {
    const favorites = await Favorite.find({ user: req.user._id }).populate('vendor').populate('menuItem');
    res.json({ success: true, data: favorites });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch favorites' });
  }
});

router.post('/favorites', protect, authorize('customer'), async (req, res) => {
  try {
    const { vendor, menuItem } = req.body;
    const payload = { user: req.user._id };
    if (vendor) payload.vendor = vendor;
    if (menuItem) payload.menuItem = menuItem;

    const existing = await Favorite.findOne(payload);
    if (existing) {
      await Favorite.deleteOne({ _id: existing._id });
      return res.json({ success: true, message: 'Favorite removed', data: null });
    }

    const favorite = await Favorite.create(payload);
    res.status(201).json({ success: true, message: 'Favorite added', data: favorite });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update favorite' });
  }
});

router.get('/notifications', protect, authorize('customer'), async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, data: notifications });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch notifications' });
  }
});

router.patch('/notifications/:id/read', protect, authorize('customer'), async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, { read: true }, { new: true });
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    res.json({ success: true, data: notification });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update notification' });
  }
});

router.patch('/notifications/read-all', protect, authorize('customer'), async (req, res) => {
  try {
    await Notification.updateMany({ user: req.user._id }, { read: true });
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to mark notifications as read' });
  }
});

router.get('/profile', protect, authorize('customer'), async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load profile' });
  }
});

router.put('/profile', protect, authorize('customer'), async (req, res) => {
  try {
    const allowedFields = ['name', 'phone', 'address', 'preferences', 'profileImage'];
    const updates = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true }).select('-password');
    res.json({ success: true, message: 'Profile updated', data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update profile' });
  }
});

router.get('/reviews', protect, authorize('customer'), async (req, res) => {
  try {
    const reviews = await Review.find({ customer: req.user._id }).populate('vendor').populate('menuItem');
    res.json({ success: true, data: reviews });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load reviews' });
  }
});

router.post('/reviews', protect, authorize('customer'), async (req, res) => {
  try {
    const { vendor, order, menuItem, rating, comment } = req.body;
    const completedOrder = await Order.findOne({ _id: order, customer: req.user._id, orderStatus: 'delivered' });

    if (!completedOrder) {
      return res.status(400).json({ success: false, message: 'Only customers with completed orders can review.' });
    }

    const existing = await Review.findOne({ customer: req.user._id, order });
    if (existing) {
      return res.status(400).json({ success: false, message: 'You already reviewed this order.' });
    }

    if (String(completedOrder.vendor) !== String(vendor) || (menuItem && !completedOrder.items.some((item) => String(item.menuItem) === String(menuItem)))) {
      return res.status(400).json({ success: false, message: 'Review details do not match this completed order.' });
    }
    const review = await Review.create({ customer: req.user._id, vendor, order, menuItem, rating, comment });
    res.status(201).json({ success: true, message: 'Review created', data: review });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to submit review' });
  }
});

module.exports = router;
