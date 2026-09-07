const { body } = require('express-validator');

const registerValidation = [
  body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters long.'),
  body('email').isEmail().withMessage('Please provide a valid email.'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long.'),
  body('role').optional().isIn(['customer', 'vendor', 'delivery']).withMessage('Invalid role.'),
];

const loginValidation = [
  body('email').isEmail().withMessage('Please provide a valid email.'),
  body('password').notEmpty().withMessage('Password is required.'),
];

const forgotPasswordValidation = [
  body('email').isEmail().withMessage('Please provide a valid email.'),
];

module.exports = { registerValidation, loginValidation, forgotPasswordValidation };
