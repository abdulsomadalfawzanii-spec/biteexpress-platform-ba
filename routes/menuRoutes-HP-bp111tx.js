const express = require('express');
const router = express.Router();
const {
  getAllMenuItems,
  getMenuItemById,
  createMenuItem,
  updateMenuItem,
  toggleAvailability,
  deleteMenuItem
} = require('../controllers/menuController');
const { protect, authorize } = require('../middleware/authMiddleware');


router.get('/', getAllMenuItems);
router.get('/:id', getMenuItemById);

router.post('/', protect, authorize('vendor'), createMenuItem);
router.put('/:id', protect, authorize('vendor'), updateMenuItem);
router.patch('/:id/availability', protect, authorize('vendor'), toggleAvailability);
router.delete('/:id', protect, authorize('vendor', 'admin'), deleteMenuItem);

module.exports = router;