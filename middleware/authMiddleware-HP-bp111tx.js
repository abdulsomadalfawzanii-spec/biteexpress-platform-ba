const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Not authorized, no token' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'biteexpress-secret');
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({ success: false, message: 'User no longer exists' });
    }

    if (user.accountStatus === 'suspended') {
      return res.status(403).json({ success: false, message: 'Account suspended. Contact support.' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Not authorized, token failed' });
  }
};

const authorize = (...roles) => (req, res, next) => {
  const userRole = String(req.user?.role || '').trim().toLowerCase();
  const allowedRoles = roles.map((role) => String(role).trim().toLowerCase());
  if (!userRole || !allowedRoles.includes(userRole)) {
    return res.status(403).json({ success: false, message: 'Access denied for this role' });
  }
  next();
};

module.exports = { protect, authorize };