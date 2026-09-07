const express = require('express');
const mongoose = require('mongoose');

const Vendor = require('../models/Vendor');
const MenuItem = require('../models/MenuItem');
const User = require('../models/User');
const Order = require('../models/Order');
const Notification = require('../models/Notification');
const Favorite = require('../models/Favorite');
const Review = require('../models/Review');

const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

/*
|--------------------------------------------------------------------------
| CUSTOMER ROUTES
|--------------------------------------------------------------------------
|
| Public:
|   GET /api/customer/restaurants
|   GET /api/customer/restaurants/:id
|
| Protected:
|   Customer profile, orders, favorites, reviews, notifications, etc.
|
|--------------------------------------------------------------------------
*/


/*
|--------------------------------------------------------------------------
| GET ALL RESTAURANTS
|--------------------------------------------------------------------------
| GET /api/customer/restaurants
|
| Customers should be able to see active vendors immediately.
| Admin approval is NOT required.
|--------------------------------------------------------------------------
*/

router.get('/restaurants', async (req, res) => {
  try {
    const {
      search = '',
      category = 'All',
      sort = 'recommended',
    } = req.query;

    const query = {
      // Only show vendors whose account still exists/works.
    };

    /*
    |--------------------------------------------------------------------------
    | Search
    |--------------------------------------------------------------------------
    */

    if (search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');

      query.$or = [
        { restaurantName: searchRegex },
        { description: searchRegex },
        { cuisineTypes: searchRegex },
      ];
    }

    /*
    |--------------------------------------------------------------------------
    | Category
    |--------------------------------------------------------------------------
    */

    if (category && category !== 'All') {
      query.cuisineTypes = {
        $regex: new RegExp(`^${category}$`, 'i'),
      };
    }

    /*
    |--------------------------------------------------------------------------
    | Sorting
    |--------------------------------------------------------------------------
    */

    let sortOption = {};

    switch (sort) {
      case 'rating':
        sortOption = {
          rating: -1,
          reviewCount: -1,
        };
        break;

      case 'fee':
        // Vendors currently don't have a dedicated deliveryFee
        // field in the supplied Vendor model.
        // Keep recommended ordering instead.
        sortOption = {
          rating: -1,
        };
        break;

      case 'recommended':
      default:
        sortOption = {
          rating: -1,
          reviewCount: -1,
          createdAt: -1,
        };
        break;
    }

    const vendors = await Vendor.find(query)
      .populate({
        path: 'user',
        select: 'name email phone accountStatus profileImage',
      })
      .sort(sortOption)
      .lean();

    /*
    |--------------------------------------------------------------------------
    | Only return vendors whose user account is active.
    |--------------------------------------------------------------------------
    */

    const activeVendors = vendors.filter((vendor) => {
      if (!vendor.user) return false;

      return vendor.user.accountStatus !== 'suspended';
    });

    /*
    |--------------------------------------------------------------------------
    | Format response for frontend
    |--------------------------------------------------------------------------
    */

    const restaurants = activeVendors.map((vendor) => ({
      id: vendor._id,

      name:
        vendor.restaurantName ||
        'Unnamed Restaurant',

      description:
        vendor.description || '',

      image:
        vendor.coverImage ||
        vendor.user?.profileImage ||
        '',

      cuisine:
        vendor.cuisineTypes?.[0] ||
        'Cuisine',

      cuisines:
        vendor.cuisineTypes || [],

      tags:
        vendor.cuisineTypes || [],

      rating:
        Number(vendor.rating || 0),

      reviewsCount:
        Number(
          vendor.reviewCount ||
          vendor.numRatings ||
          0
        ),

      deliveryTime:
        '20-30 min',

      deliveryFee:
        2.99,

      distance:
        'Nearby',

      isOpen:
        vendor.isOpen !== false,

      address:
        vendor.address || '',

      phone:
        vendor.phone || '',

      operatingHours:
        vendor.operatingHours || {
          open: '08:00',
          close: '22:00',
        },

      deliveryAreas:
        vendor.deliveryAreas || [],

      owner:
        vendor.user?._id || null,
    }));

    return res.status(200).json({
      success: true,
      count: restaurants.length,
      restaurants,
    });
  } catch (error) {
    console.error('Get restaurants error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to load restaurants.',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : undefined,
    });
  }
});


/*
|--------------------------------------------------------------------------
| GET SINGLE RESTAURANT
|--------------------------------------------------------------------------
| GET /api/customer/restaurants/:id
|
| Returns restaurant information + available menu.
|--------------------------------------------------------------------------
*/

router.get('/restaurants/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid restaurant ID.',
      });
    }

    const vendor = await Vendor.findById(id)
      .populate({
        path: 'user',
        select: 'name email phone accountStatus profileImage',
      })
      .lean();

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Restaurant not found.',
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Don't show suspended vendor accounts
    |--------------------------------------------------------------------------
    */

    if (
      vendor.user &&
      vendor.user.accountStatus === 'suspended'
    ) {
      return res.status(404).json({
        success: false,
        message: 'Restaurant is currently unavailable.',
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Get available menu items
    |--------------------------------------------------------------------------
    |
    | Different parts of the existing project have used both
    | `availability` and `isAvailable`.
    |
    | We support both so existing database records continue working.
    |--------------------------------------------------------------------------
    */

    const menuItems = await MenuItem.find({
      vendor: vendor._id,
      $and: [
        { isAvailable: { $ne: false } },
        { availability: { $ne: false } },
      ],
    })
      .sort({
        createdAt: -1,
      })
      .lean();

    /*
    |--------------------------------------------------------------------------
    | Format menu
    |--------------------------------------------------------------------------
    */

    const menu = menuItems.map((item) => ({
      id: item._id,

      _id: item._id,

      name:
        item.name || 'Menu Item',

      description:
        item.description || '',

      price:
        Number(item.price || 0),

      image:
        item.image ||
        item.imageUrl ||
        '',

      category:
        item.category ||
        'Other',

      isAvailable:
        item.isAvailable !== undefined
          ? item.isAvailable
          : item.availability !== false,

      availability:
        item.availability !== undefined
          ? item.availability
          : item.isAvailable !== false,

      vendor:
        vendor._id,
    }));

    /*
    |--------------------------------------------------------------------------
    | Format restaurant
    |--------------------------------------------------------------------------
    */

    const restaurant = {
      id: vendor._id,

      _id: vendor._id,

      name:
        vendor.restaurantName ||
        'Unnamed Restaurant',

      restaurantName:
        vendor.restaurantName ||
        'Unnamed Restaurant',

      description:
        vendor.description || '',

      image:
        vendor.coverImage ||
        vendor.user?.profileImage ||
        '',

      coverImage:
        vendor.coverImage || '',

      cuisine:
        vendor.cuisineTypes?.[0] ||
        'Cuisine',

      cuisines:
        vendor.cuisineTypes || [],

      cuisineTypes:
        vendor.cuisineTypes || [],

      tags:
        vendor.cuisineTypes || [],

      rating:
        Number(vendor.rating || 0),

      reviewsCount:
        Number(
          vendor.reviewCount ||
          vendor.numRatings ||
          0
        ),

      reviewCount:
        Number(vendor.reviewCount || 0),

      deliveryTime:
        '20-30 min',

      deliveryFee:
        2.99,

      distance:
        'Nearby',

      isOpen:
        vendor.isOpen !== false,

      address:
        vendor.address || '',

      phone:
        vendor.phone || '',

      operatingHours:
        vendor.operatingHours || {
          open: '08:00',
          close: '22:00',
        },

      deliveryAreas:
        vendor.deliveryAreas || [],

      menu,
    };

    return res.status(200).json({
      success: true,
      restaurant,
    });
  } catch (error) {
    console.error('Get restaurant details error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to load restaurant details.',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : undefined,
    });
  }
});


/*
|--------------------------------------------------------------------------
| CUSTOMER PROFILE
|--------------------------------------------------------------------------
*/

router.get('/profile', protect, authorize('customer'), async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    return res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    console.error('Get customer profile error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to load profile.',
    });
  }
});


/*
|--------------------------------------------------------------------------
| UPDATE CUSTOMER PROFILE
|--------------------------------------------------------------------------
*/

router.put('/profile', protect, authorize('customer'), async (req, res) => {
  try {
    const {
      name,
      phone,
      address,
      profileImage,
      preferences,
    } = req.body;

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    if (name !== undefined) {
      user.name = name.trim();
    }

    if (phone !== undefined) {
      user.phone = phone;
    }

    if (address !== undefined) {
      user.address = address;
    }

    if (profileImage !== undefined) {
      user.profileImage = profileImage;
    }

    if (preferences !== undefined) {
      user.preferences = preferences;
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      user: {
        ...user.toObject(),
        password: undefined,
      },
    });
  } catch (error) {
    console.error('Update customer profile error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to update profile.',
    });
  }
});

router.get('/favorites', protect, authorize('customer'), async (req, res) => {
  try {
    const favorites = await Favorite.find({ user: req.user._id })
      .select('vendor menuItem')
      .lean();

    return res.status(200).json({ success: true, favorites });
  } catch (error) {
    console.error('Get customer favorites error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load favorites.' });
  }
});

router.post('/favorites', protect, authorize('customer'), async (req, res) => {
  try {
    const { vendor } = req.body;

    if (!vendor || !mongoose.Types.ObjectId.isValid(vendor)) {
      return res.status(400).json({ success: false, message: 'A valid vendor is required.' });
    }

    const vendorDoc = await Vendor.findById(vendor).select('_id').lean();
    if (!vendorDoc) {
      return res.status(404).json({ success: false, message: 'Restaurant not found.' });
    }

    const existing = await Favorite.findOne({ user: req.user._id, vendor }).lean();
    if (existing) {
      await Favorite.deleteOne({ _id: existing._id });
      return res.status(200).json({ success: true, favorited: false });
    }

    await Favorite.create({ user: req.user._id, vendor });
    return res.status(201).json({ success: true, favorited: true });
  } catch (error) {
    console.error('Toggle customer favorite error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update favorite.' });
  }
});


/*
|--------------------------------------------------------------------------
| CUSTOMER ORDERS
|--------------------------------------------------------------------------
*/

router.get('/orders', protect, authorize('customer'), async (req, res) => {
  try {
    const orders = await Order.find({
      customer: req.user._id,
    })
      .populate('vendor', 'restaurantName coverImage')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: orders.length,
      orders,
    });
  } catch (error) {
    console.error('Get customer orders error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to load orders.',
    });
  }
});

router.get('/reviews', protect, authorize('customer'), async (req, res) => {
  try {
    const reviews = await Review.find({ customer: req.user._id })
      .populate('vendor', 'restaurantName')
      .sort({ createdAt: -1 })
      .lean();
    return res.status(200).json({ success: true, reviews });
  } catch (error) {
    console.error('Get customer reviews error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load reviews.' });
  }
});

router.post('/reviews', protect, authorize('customer'), async (req, res) => {
  try {
    const { vendor, order, rating, comment = '' } = req.body;
    if (!vendor || !order || !Number.isInteger(Number(rating)) || Number(rating) < 1 || Number(rating) > 5) {
      return res.status(400).json({ success: false, message: 'Vendor, order, and a rating from 1 to 5 are required.' });
    }

    const customerOrder = await Order.findOne({ _id: order, customer: req.user._id });
    if (!customerOrder) return res.status(404).json({ success: false, message: 'Order not found.' });
    if (customerOrder.orderStatus !== 'delivered') {
      return res.status(400).json({ success: false, message: 'Only delivered orders can be reviewed.' });
    }
    if (String(customerOrder.vendor) !== String(vendor)) {
      return res.status(400).json({ success: false, message: 'Review vendor does not match the order.' });
    }

    const review = await Review.create({
      customer: req.user._id,
      vendor: customerOrder.vendor,
      order: customerOrder._id,
      rating: Number(rating),
      comment: String(comment).trim(),
    });

    const vendorReviews = await Review.aggregate([
      { $match: { vendor: customerOrder.vendor } },
      { $group: { _id: '$vendor', rating: { $avg: '$rating' }, reviewCount: { $sum: 1 } } },
    ]);
    const summary = vendorReviews[0] || { rating: 0, reviewCount: 0 };
    await Vendor.findByIdAndUpdate(customerOrder.vendor, {
      rating: Number(summary.rating.toFixed(2)),
      reviewCount: summary.reviewCount,
      numRatings: summary.reviewCount,
    });

    return res.status(201).json({ success: true, review });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: 'This order has already been reviewed.' });
    console.error('Create customer review error:', error);
    return res.status(500).json({ success: false, message: 'Failed to submit review.' });
  }
});


/*
|--------------------------------------------------------------------------
| CUSTOMER NOTIFICATIONS
|--------------------------------------------------------------------------
*/

router.get(
  '/notifications',
  protect,
  authorize('customer'),
  async (req, res) => {
    try {
      const notifications = await Notification.find({
        user: req.user._id,
      })
        .sort({ createdAt: -1 })
        .limit(100);

      return res.status(200).json({
        success: true,
        notifications,
      });
    } catch (error) {
      console.error(
        'Get customer notifications error:',
        error
      );

      return res.status(500).json({
        success: false,
        message: 'Failed to load notifications.',
      });
    }
  }
);


module.exports = router;