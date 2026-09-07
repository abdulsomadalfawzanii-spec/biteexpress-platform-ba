const express = require('express');
const router = express.Router();
const { 
  createOrder, 
  updateOrderStatus, 
  getCustomerOrders, 
  getOrderById 
} = require('../controllers/orderController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.post('/', protect, authorize('customer'), createOrder);
router.get('/my-orders', protect, authorize('customer'), getCustomerOrders);
router.get('/:orderId', protect, getOrderById);
router.patch('/:orderId/status', protect, authorize('vendor', 'delivery', 'admin'), updateOrderStatus);

module.exports = router;