const MenuItem = require('../models/MenuItem');
const Order = require('../models/Order');
const Vendor = require('../models/Vendor');

// Add new menu item
exports.addMenuItem = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user.id });
    if (!vendor) return res.status(404).json({ message: 'Vendor profile not found' });

    const newItem = await MenuItem.create({ ...req.body, vendor: vendor._id });
    res.status(201).json(newItem);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create menu item', error: error.message });
  }
};

// Get pending orders for this specific kitchen
exports.getVendorOrders = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user.id });
    const orders = await Order.find({ vendor: vendor._id })
      .populate('customer', 'name phone')
      .populate('items.menuItem', 'name price')
      .sort({ createdAt: -1 });

    res.status(200).json(orders);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching kitchen orders', error: error.message });
  }
};

const MenuItem = require('../models/MenuItem');
const Vendor = require('../models/Vendor');

// Get menu for a vendor
exports.getVendorMenuItems = async (req, res) => {
  try {
    const items = await MenuItem.find({ vendor: req.params.vendorId, isAvailable: true });
    res.status(200).json(items);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching menu items', error: error.message });
  }
};

// Update existing menu item
exports.updateMenuItem = async (req, res) => {
  try {
    const item = await MenuItem.findByIdAndUpdate(req.params.itemId, req.body, { new: true });
    res.status(200).json(item);
  } catch (error) {
    res.status(500).json({ message: 'Error updating menu item', error: error.message });
  }
};

// Delete menu item
exports.deleteMenuItem = async (req, res) => {
  try {
    await MenuItem.findByIdAndDelete(req.params.itemId);
    res.status(200).json({ message: 'Item deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting menu item', error: error.message });
  }
};