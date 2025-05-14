const express = require('express');
const { body, validationResult } = require('express-validator');
const { transactionOperations } = require('../utils/dynamodb');

const router = express.Router();

/**
 * @route   POST /api/transactions
 * @desc    Create a new transaction
 * @access  Private
 */
router.post('/', [
  body('items').isArray().withMessage('Items must be an array'),
  body('items.*.productId').notEmpty().withMessage('Product ID is required for each item'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('items.*.price').isNumeric().withMessage('Price must be a number'),
  body('total').isNumeric().withMessage('Total must be a number'),
  body('paymentMethod').notEmpty().withMessage('Payment method is required'),
], async (req, res, next) => {
  // Validate request
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  try {
    // Add user ID from auth token as cashierId
    const transaction = {
      ...req.body,
      cashierId: req.user.sub,
    };
    
    const result = await transactionOperations.createTransaction(transaction);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/transactions/:id
 * @desc    Get a transaction by ID
 * @access  Private
 */
router.get('/:id', async (req, res, next) => {
  try {
    const transaction = await transactionOperations.getTransactionById(req.params.id);
    
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }
    
    res.json(transaction);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/transactions/date/:startDate/:endDate
 * @desc    Get transactions by date range
 * @access  Private
 */
router.get('/date/:startDate/:endDate', async (req, res, next) => {
  try {
    const { startDate, endDate } = req.params;
    
    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      return res.status(400).json({ message: 'Invalid date format. Use YYYY-MM-DD' });
    }
    
    const transactions = await transactionOperations.getTransactionsByDateRange(startDate, endDate);
    res.json(transactions);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/transactions/cashier/:cashierId
 * @desc    Get transactions by cashier
 * @access  Private
 */
router.get('/cashier/:cashierId', async (req, res, next) => {
  try {
    const transactions = await transactionOperations.getTransactionsByCashier(req.params.cashierId);
    res.json(transactions);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/transactions/me
 * @desc    Get transactions by current cashier
 * @access  Private
 */
router.get('/me', async (req, res, next) => {
  try {
    const transactions = await transactionOperations.getTransactionsByCashier(req.user.sub);
    res.json(transactions);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/transactions
 * @desc    Get transactions with filtering options
 * @access  Private
 */
router.get('/', async (req, res, next) => {
  try {
    const { startDate, endDate, cashierId } = req.query;
    
    // If date range is provided
    if (startDate && endDate) {
      // Validate date format (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
        return res.status(400).json({ message: 'Invalid date format. Use YYYY-MM-DD' });
      }
      
      const transactions = await transactionOperations.getTransactionsByDateRange(startDate, endDate);
      return res.json(transactions);
    }
    
    // If cashier ID is provided
    if (cashierId) {
      const transactions = await transactionOperations.getTransactionsByCashier(cashierId);
      return res.json(transactions);
    }
    
    // If no filters, return today's transactions
    const today = new Date().toISOString().split('T')[0];
    const transactions = await transactionOperations.getTransactionsByDateRange(today, today);
    res.json(transactions);
  } catch (error) {
    next(error);
  }
});

module.exports = router;