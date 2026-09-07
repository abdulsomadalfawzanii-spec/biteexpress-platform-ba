const express = require('express');
const router = express.Router();
const {
  getAvailableDeliveries,
  claimDelivery,
  getMyDeliveries,
  getProfile,
  updateProfile,
  getEarnings,
} = require('../controllers/deliveryController');
const { protect, authorize } = require('../middleware/authMiddleware');

// All routes require authentication + delivery role
router.use(protect, authorize('delivery'));

router.get('/available', getAvailableDeliveries);
router.get('/my-deliveries', getMyDeliveries);
router.post('/claim/:orderId', claimDelivery);
router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.get('/earnings', getEarnings);

module.exports = router;
