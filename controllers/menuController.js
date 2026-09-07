const MenuItem = require('../models/MenuItem');
const Vendor = require('../models/Vendor');

// @desc    Get all menu items (Public - supports search & category filter)
// @route   GET /api/menu
exports.getAllMenuItems = async (req, res) => {
  try {
    const { category, search, vendorId } = req.query;
    let query = { isAvailable: true };

    if (category) query.category = category;
    if (vendorId) query.vendor = vendorId;
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    const menuItems = await MenuItem.find(query).populate('vendor', 'restaurantName address rating');
    res.status(200).json(menuItems);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch menu items', error: error.message });
  }
};

// @desc    Get single menu item by ID
// @route   GET /api/menu/:id
exports.getMenuItemById = async (req, res) => {
  try {
    const menuItem = await MenuItem.findById(req.params.id).populate('vendor', 'restaurantName');
    if (!menuItem) {
      return res.status(404).json({ message: 'Menu item not found' });
    }
    res.status(200).json(menuItem);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching menu item', error: error.message });
  }
};

// @desc    Create new menu item (Vendor only)
// @route   POST /api/menu
exports.createMenuItem = async (req, res) => {
  try {
    // Find vendor associated with logged in user
    const vendor = await Vendor.findOne({ owner: req.user.id });
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor profile not found for this user' });
    }

    const { name, description, price, category, imageUrl, prepTimeMinutes } = req.body;

    const newItem = await MenuItem.create({
      vendor: vendor._id,
      name,
      description,
      price,
      category,
      imageUrl,
      prepTimeMinutes
    });

    res.status(201).json({ message: 'Menu item created successfully', menuItem: newItem });
  } catch (error) {
    res.status(500).json({ message: 'Failed to create menu item', error: error.message });
  }
};

// @desc    Update menu item (Vendor owner only)
// @route   PUT /api/menu/:id
exports.updateMenuItem = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user.id });
    const menuItem = await MenuItem.findById(req.params.id);

    if (!menuItem) {
      return res.status(404).json({ message: 'Menu item not found' });
    }

    // Authorization check: Verify vendor owns this menu item
    if (menuItem.vendor.toString() !== vendor._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this item' });
    }

    const updatedItem = await MenuItem.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.status(200).json({ message: 'Menu item updated', menuItem: updatedItem });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update menu item', error: error.message });
  }
};

// @desc    Toggle menu item availability (Vendor only)
// @route   PATCH /api/menu/:id/availability
exports.toggleAvailability = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user.id });
    const menuItem = await MenuItem.findById(req.params.id);

    if (!menuItem) return res.status(404).json({ message: 'Menu item not found' });

    if (menuItem.vendor.toString() !== vendor._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to modify this item' });
    }

    menuItem.isAvailable = !menuItem.isAvailable;
    await menuItem.save();

    res.status(200).json({ message: 'Availability status updated', isAvailable: menuItem.isAvailable });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update availability', error: error.message });
  }
};

// @desc    Delete menu item (Vendor owner or Admin)
// @route   DELETE /api/menu/:id
exports.deleteMenuItem = async (req, res) => {
  try {
    const menuItem = await MenuItem.findById(req.params.id);
    if (!menuItem) return res.status(404).json({ message: 'Menu item not found' });

    if (req.user.role === 'vendor') {
      const vendor = await Vendor.findOne({ owner: req.user.id });
      if (menuItem.vendor.toString() !== vendor._id.toString()) {
        return res.status(403).json({ message: 'Not authorized to delete this item' });
      }
    }

    await MenuItem.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Menu item deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete menu item', error: error.message });
  }
};