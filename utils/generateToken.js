const jwt = require('jsonwebtoken');

const generateToken = (user) => jwt.sign(
  {
    id: user._id || user.id,
    role: user.role,
    email: user.email,
    name: user.name,
  },
  process.env.JWT_SECRET || 'biteexpress-secret',
  { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
);

module.exports = generateToken;
