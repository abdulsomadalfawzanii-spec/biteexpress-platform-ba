const express = require('express');
const router = express.Router();
const {
  getAnalytics,
  getAllUsers,
  updateUserStatus,
  deleteUser,
  getAllVendors,
  toggleVendorApproval,
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/authMiddleware');

// All admin routes require authentication + admin role
router.use(protect, authorize('admin'));

router.get('/analytics', getAnalytics);

router.get('/users', getAllUsers);
router.patch('/users/:userId/status', updateUserStatus);
router.delete('/users/:userId', deleteUser);

router.get('/vendors', getAllVendors);
router.patch('/vendors/:vendorId/approval', toggleVendorApproval);

module.exports = router;
