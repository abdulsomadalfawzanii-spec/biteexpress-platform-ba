const { body, param } = require('express-validator');

const createOrderValidation = [
  body('vendor').notEmpty().withMessage('Vendor is required.'),
  body('items').isArray({ min: 1 }).withMessage('Items are required.'),
  body('deliveryAddress').notEmpty().withMessage('Delivery address is required.'),
  body('total').isNumeric().withMessage('Order total must be numeric.'),
];

const statusValidation = [
  body('status').isIn(['pending', 'confirmed', 'rejected', 'preparing', 'ready_for_pickup', 'assigned', 'picked_up', 'on_the_way', 'delivered', 'cancelled']).withMessage('Invalid order status.'),
  param('orderId').isMongoId().withMessage('Invalid order id.'),
];

module.exports = { createOrderValidation, statusValidation };
