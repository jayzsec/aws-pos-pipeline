const { body, validationResult } = require('express-validator');

/**
 * Validation middleware for Express
 * @param {Array} validations - Array of express-validator validations
 * @returns {Function} Express middleware
 */
function validate(validations) {
  return async (req, res, next) => {
    // Run all validations
    await Promise.all(validations.map(validation => validation.run(req)));
    
    // Check if there are validation errors
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    next();
  };
}

// Common validation rules
const rules = {
  productId: body('productId')
    .notEmpty().withMessage('Product ID is required')
    .isString().withMessage('Product ID must be a string'),
  
  name: body('name')
    .notEmpty().withMessage('Name is required')
    .isString().withMessage('Name must be a string')
    .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
  
  price: body('price')
    .notEmpty().withMessage('Price is required')
    .isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  
  category: body('category')
    .notEmpty().withMessage('Category is required')
    .isString().withMessage('Category must be a string'),
  
  quantity: body('quantity')
    .notEmpty().withMessage('Quantity is required')
    .isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
  
  date: body('date')
    .optional()
    .isDate().withMessage('Date must be a valid date')
    .toDate(),
  
  items: body('items')
    .isArray().withMessage('Items must be an array')
    .notEmpty().withMessage('Items cannot be empty'),
  
  total: body('total')
    .notEmpty().withMessage('Total is required')
    .isFloat({ min: 0 }).withMessage('Total must be a positive number'),
  
  paymentMethod: body('paymentMethod')
    .notEmpty().withMessage('Payment method is required')
    .isString().withMessage('Payment method must be a string')
    .isIn(['cash', 'card', 'mobile']).withMessage('Payment method must be cash, card, or mobile'),
};

module.exports = {
  validate,
  rules,
};