const User = require('../models/User');
const Vendor = require('../models/Vendor');
const Order = require('../models/Order');
const Notification = require('../models/Notification');

exports.getAnalytics = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ role: 'customer' });
    const totalVendors = await Vendor.countDocuments({ approvalStatus: 'approved' });
    const totalDeliveryPersonnel = await User.countDocuments({ role: 'delivery' });
    const pendingVendors = await Vendor.countDocuments({ approvalStatus: 'pending' });

    const revenueAggregation = await Order.aggregate([
      { $match: { paymentStatus: 'paid' } },
      { $group: { _id: null, totalGrossRevenue: { $sum: '$total' }, totalOrders: { $sum: 1 } } },
    ]);

    const allOrdersCount = await Order.countDocuments({});
    const completedOrders = await Order.countDocuments({ orderStatus: 'delivered' });
    const pendingOrders = await Order.countDocuments({ orderStatus: 'pending' });

    const stats = revenueAggregation[0] || { totalGrossRevenue: 0, totalOrders: 0 };
    const platformCommissionEarned = stats.totalGrossRevenue * 0.15;

    // Recent orders for dashboard feed
    const recentOrders = await Order.find({})
      .populate('vendor', 'restaurantName')
      .populate('customer', 'name email')
      .sort({ createdAt: -1 })
      .limit(10)
      .select('orderStatus total createdAt deliveryAddress');

    res.status(200).json({
      success: true,
      data: {
        totalUsers,
        totalVendors,
        totalDeliveryPersonnel,
        pendingVendors,
        totalOrders: allOrdersCount,
        paidOrders: stats.totalOrders,
        completedOrders,
        pendingOrders,
        totalGrossRevenue: stats.totalGrossRevenue,
        platformCommissionEarned,
        recentOrders,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error aggregating system stats', error: error.message });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}).select('-password').sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load users' });
  }
};

exports.updateUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { accountStatus } = req.body;
    const allowed = ['active', 'suspended', 'pending'];
    if (!allowed.includes(accountStatus)) {
      return res.status(400).json({ success: false, message: 'Invalid accountStatus value' });
    }
    const user = await User.findByIdAndUpdate(userId, { accountStatus }, { new: true }).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update user status' });
  }
};

exports.getAllVendors = async (req, res) => {
  try {
    const vendors = await Vendor.find({})
      .populate('user', 'name email accountStatus')
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: vendors });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load vendors' });
  }
};

exports.toggleVendorApproval = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const { approvalStatus } = req.body;
    const allowed = ['approved', 'rejected', 'pending'];
    if (!allowed.includes(approvalStatus)) {
      return res.status(400).json({ success: false, message: 'Invalid approvalStatus value' });
    }

    const vendor = await Vendor.findByIdAndUpdate(
      vendorId,
      {
        approvalStatus,
        isApproved: approvalStatus === 'approved',
        verificationStatus: approvalStatus === 'approved' ? 'verified' : 'pending',
      },
      { new: true }
    ).populate('user', 'name email');

    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

    // Notify the vendor user
    if (vendor.user) {
      await Notification.create({
        user: vendor.user._id,
        title: `Restaurant ${approvalStatus === 'approved' ? 'approved' : 'status updated'}`,
        message: approvalStatus === 'approved'
          ? 'Congratulations! Your restaurant has been approved and is now live.'
          : `Your restaurant approval status has been set to ${approvalStatus}.`,
        type: 'approval',
      }).catch(() => {}); // Non-blocking
    }

    res.status(200).json({ success: true, message: `Vendor approval status set to ${approvalStatus}`, data: vendor });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating vendor status', error: error.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findByIdAndDelete(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.status(200).json({ success: true, message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete user' });
  }
};
