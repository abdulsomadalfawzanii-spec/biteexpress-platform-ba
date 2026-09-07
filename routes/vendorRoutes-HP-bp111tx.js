const express = require('express');
const router = express.Router();

const Vendor = require('../models/Vendor');
const MenuItem = require('../models/MenuItem');
const Order = require('../models/Order');
const Notification = require('../models/Notification');

const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);

/* =========================================================
   VENDOR PROFILE
========================================================= */

/**
 * GET /api/vendor/profile
 */
router.get('/profile', authorize('vendor'), async (req, res) => {
  try {
    const vendor = await Vendor.findOne({
      user: req.user._id,
    }).populate('user', 'name email phone');

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor profile not found',
      });
    }

    res.json({
      success: true,
      data: vendor,
    });
  } catch (error) {
    console.error('GET /vendor/profile:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to fetch vendor profile',
    });
  }
});

/**
 * PUT /api/vendor/profile
 */
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
      coverImage: req.body.coverImage,
      payoutInfo: req.body.payoutInfo,
    };

    // Remove undefined fields
    Object.keys(updates).forEach((key) => {
      if (updates[key] === undefined) {
        delete updates[key];
      }
    });

    const vendor = await Vendor.findOneAndUpdate(
      { user: req.user._id },
      updates,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found',
      });
    }

    res.json({
      success: true,
      message: 'Vendor profile updated successfully',
      data: vendor,
    });
  } catch (error) {
    console.error('PUT /vendor/profile:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to update vendor profile',
    });
  }
});

/* =========================================================
   MENU
========================================================= */

/**
 * POST /api/vendor/menu
 *
 * Vendor can create menu items immediately.
 * No admin approval required.
 */
router.post('/menu', authorize('vendor'), async (req, res) => {
  try {
    const vendor = await Vendor.findOne({
      user: req.user._id,
    });

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor profile not found',
      });
    }

    const {
      name,
      description,
      price,
      category,
      image,
      ingredients,
      allergens,
      prepTimeMinutes,
      preparationTime,
      availability,
      isAvailable,
      promotionalInfo,
    } = req.body;

    if (!name || !category) {
      return res.status(400).json({
        success: false,
        message: 'Name and category are required',
      });
    }

    const numericPrice = Number(price);

    if (!Number.isFinite(numericPrice) || numericPrice < 0) {
      return res.status(400).json({
        success: false,
        message: 'Price must be a valid positive number',
      });
    }

    /*
      Support both frontend names:
      availability
      isAvailable

      Keep both fields synchronized.
    */
    const finalAvailability =
      availability !== undefined
        ? Boolean(availability)
        : isAvailable !== undefined
          ? Boolean(isAvailable)
          : true;

    const finalPrepTime = Number(
      prepTimeMinutes ?? preparationTime ?? 20
    );

    const menuItem = await MenuItem.create({
      vendor: vendor._id,

      name: String(name).trim(),

      description: description
        ? String(description).trim()
        : '',

      price: numericPrice,

      category: String(category).trim(),

      image: image || '',

      ingredients: Array.isArray(ingredients)
        ? ingredients
        : [],

      allergens: Array.isArray(allergens)
        ? allergens
        : [],

      prepTimeMinutes:
        Number.isFinite(finalPrepTime) && finalPrepTime > 0
          ? finalPrepTime
          : 20,

      preparationTime:
        Number.isFinite(finalPrepTime) && finalPrepTime > 0
          ? finalPrepTime
          : 20,

      availability: finalAvailability,

      isAvailable: finalAvailability,

      promotionalInfo: promotionalInfo || '',

      // Menu created by the vendor is immediately usable.
      approvalStatus: 'approved',
    });

    res.status(201).json({
      success: true,
      message: 'Menu item created successfully',
      data: menuItem,
    });
  } catch (error) {
    console.error('POST /vendor/menu:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to create menu item',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : undefined,
    });
  }
});

/**
 * GET /api/vendor/menu
 */
router.get('/menu', authorize('vendor'), async (req, res) => {
  try {
    const vendor = await Vendor.findOne({
      user: req.user._id,
    });

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor profile not found',
      });
    }

    const menu = await MenuItem.find({
      vendor: vendor._id,
    }).sort({
      createdAt: -1,
    });

    res.json({
      success: true,
      data: menu,
    });
  } catch (error) {
    console.error('GET /vendor/menu:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to fetch menu',
    });
  }
});

/**
 * PUT /api/vendor/menu/:itemId
 */
router.put('/menu/:itemId', authorize('vendor'), async (req, res) => {
  try {
    const vendor = await Vendor.findOne({
      user: req.user._id,
    });

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor profile not found',
      });
    }

    const item = await MenuItem.findOne({
      _id: req.params.itemId,
      vendor: vendor._id,
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Menu item not found',
      });
    }

    const updates = {
      ...req.body,
    };

    /*
      Keep availability fields synchronized.
    */
    if (updates.availability !== undefined) {
      updates.availability = Boolean(updates.availability);
      updates.isAvailable = Boolean(updates.availability);
    }

    if (updates.isAvailable !== undefined) {
      updates.isAvailable = Boolean(updates.isAvailable);
      updates.availability = Boolean(updates.isAvailable);
    }

    /*
      Keep preparation-time fields synchronized.
    */
    if (updates.prepTimeMinutes !== undefined) {
      const value = Number(updates.prepTimeMinutes);

      if (!Number.isFinite(value) || value <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Preparation time must be a valid positive number',
        });
      }

      updates.prepTimeMinutes = value;
      updates.preparationTime = value;
    }

    if (updates.preparationTime !== undefined) {
      const value = Number(updates.preparationTime);

      if (!Number.isFinite(value) || value <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Preparation time must be a valid positive number',
        });
      }

      updates.preparationTime = value;
      updates.prepTimeMinutes = value;
    }

    /*
      Validate price if supplied.
    */
    if (updates.price !== undefined) {
      const value = Number(updates.price);

      if (!Number.isFinite(value) || value < 0) {
        return res.status(400).json({
          success: false,
          message: 'Price must be a valid positive number',
        });
      }

      updates.price = value;
    }

    /*
      Don't allow a vendor to change ownership.
    */
    delete updates.vendor;

    Object.assign(item, updates);

    await item.save();

    res.json({
      success: true,
      message: 'Menu item updated successfully',
      data: item,
    });
  } catch (error) {
    console.error('PUT /vendor/menu/:itemId:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to update menu item',
    });
  }
});

/**
 * DELETE /api/vendor/menu/:itemId
 */
router.delete('/menu/:itemId', authorize('vendor'), async (req, res) => {
  try {
    const vendor = await Vendor.findOne({
      user: req.user._id,
    });

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor profile not found',
      });
    }

    const item = await MenuItem.findOne({
      _id: req.params.itemId,
      vendor: vendor._id,
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Menu item not found',
      });
    }

    await item.deleteOne();

    res.json({
      success: true,
      message: 'Menu item deleted successfully',
    });
  } catch (error) {
    console.error('DELETE /vendor/menu/:itemId:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to delete menu item',
    });
  }
});

/* =========================================================
   VENDOR ORDERS
========================================================= */

/**
 * GET /api/vendor/orders
 */
router.get('/orders', authorize('vendor'), async (req, res) => {
  try {
    const vendor = await Vendor.findOne({
      user: req.user._id,
    });

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor profile not found',
      });
    }

    const orders = await Order.find({
      vendor: vendor._id,
    })
      .populate(
        'customer',
        'name email phone address'
      )
      .sort({
        createdAt: -1,
      });

    res.json({
      success: true,
      data: orders,
    });
  } catch (error) {
    console.error('GET /vendor/orders:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to fetch vendor orders',
    });
  }
});

/**
 * PATCH /api/vendor/orders/:orderId/status
 */
router.patch(
  '/orders/:orderId/status',
  authorize('vendor'),
  async (req, res) => {
    try {
      const status =
        req.body.status ||
        req.body.orderStatus;

      if (!status) {
        return res.status(400).json({
          success: false,
          message: 'Order status is required',
        });
      }

      const vendor = await Vendor.findOne({
        user: req.user._id,
      });

      if (!vendor) {
        return res.status(404).json({
          success: false,
          message: 'Vendor profile not found',
        });
      }

      const order = await Order.findOne({
        _id: req.params.orderId,
        vendor: vendor._id,
      });

      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Order not found',
        });
      }

      const currentStatus =
        order.orderStatus ||
        order.status ||
        'pending';

      const allowedStatuses = {
        pending: [
          'confirmed',
          'rejected',
        ],

        confirmed: [
          'preparing',
          'rejected',
        ],

        preparing: [
          'ready_for_pickup',
        ],

        ready_for_pickup: [],

        assigned: [],

        picked_up: [],

        on_the_way: [],

        delivered: [],

        rejected: [],

        cancelled: [],
      };

      const allowedNext =
        allowedStatuses[currentStatus] || [];

      if (!allowedNext.includes(status)) {
        return res.status(400).json({
          success: false,
          message:
            `Cannot change an ${currentStatus} order to ${status}`,
        });
      }

      /*
        Support projects that have either
        orderStatus or status.
      */
      if (
        Object.prototype.hasOwnProperty.call(
          order.toObject(),
          'orderStatus'
        )
      ) {
        order.orderStatus = status;
      }

      if (
        Object.prototype.hasOwnProperty.call(
          order.toObject(),
          'status'
        )
      ) {
        order.status = status;
      }

      /*
        Some schemas only have orderStatus.
      */
      if (order.orderStatus !== undefined) {
        order.orderStatus = status;
      }

      if (
        Array.isArray(order.statusHistory)
      ) {
        order.statusHistory.push({
          status,
          note: 'Vendor updated order status',
          timestamp: new Date(),
        });
      }

      await order.save();

      /*
        Notify customer.
      */
      try {
        await Notification.create({
          user: order.customer,
          title: 'Order status updated',
          message:
            `Your order has been updated to ${status.replace(
              /_/g,
              ' '
            )}`,
          type: 'order',
          relatedOrder: order._id,
        });
      } catch (notificationError) {
        console.error(
          'Notification creation failed:',
          notificationError
        );
      }

      res.json({
        success: true,
        message: 'Order status updated successfully',
        data: order,
      });
    } catch (error) {
      console.error(
        'PATCH /vendor/orders/:orderId/status:',
        error
      );

      res.status(500).json({
        success: false,
        message: 'Failed to update order status',
      });
    }
  }
);

/* =========================================================
   ANALYTICS
========================================================= */

/**
 * GET /api/vendor/analytics
 */
router.get('/analytics', authorize('vendor'), async (req, res) => {
  try {
    const vendor = await Vendor.findOne({
      user: req.user._id,
    });

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor profile not found',
      });
    }

    const orders = await Order.find({
      vendor: vendor._id,
    }).lean();

    const totalOrders = orders.length;

    const completedOrders = orders.filter(
      (order) =>
        (order.orderStatus || order.status) ===
        'delivered'
    );

    const pendingOrders = orders.filter(
      (order) =>
        ['pending', 'confirmed', 'preparing'].includes(
          order.orderStatus || order.status
        )
    );

    const totalRevenue = completedOrders.reduce(
      (sum, order) =>
        sum + Number(order.total || 0),
      0
    );

    const averageOrderValue =
      completedOrders.length > 0
        ? totalRevenue / completedOrders.length
        : 0;

    const menuItemsCount =
      await MenuItem.countDocuments({
        vendor: vendor._id,
      });

    const availableMenuItems =
      await MenuItem.countDocuments({
        vendor: vendor._id,
        isAvailable: true,
      });

    res.json({
      success: true,
      data: {
        totalOrders,
        completedOrders: completedOrders.length,
        pendingOrders: pendingOrders.length,
        totalRevenue,
        averageOrderValue,
        menuItemsCount,
        availableMenuItems,
        rating: vendor.rating || 0,
        reviewCount: vendor.reviewCount || 0,
      },
    });
  } catch (error) {
    console.error('GET /vendor/analytics:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to fetch vendor analytics',
    });
  }
});

/* =========================================================
   NOTIFICATIONS
========================================================= */

/**
 * GET /api/vendor/notifications
 */
router.get(
  '/notifications',
  authorize('vendor'),
  async (req, res) => {
    try {
      const notifications =
        await Notification.find({
          user: req.user._id,
        })
          .sort({
            createdAt: -1,
          })
          .limit(50);

      res.json({
        success: true,
        data: notifications,
      });
    } catch (error) {
      console.error(
        'GET /vendor/notifications:',
        error
      );

      res.status(500).json({
        success: false,
        message: 'Failed to fetch notifications',
      });
    }
  }
);

module.exports = router;