const express = require('express');
const { body, validationResult } = require('express-validator');
const { productOperations } = require('../utils/dynamodb');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

/**
 * @route   GET /api/products
 * @desc    Get all products
 * @access  Private
 */
router.get('/', async (req, res, next) => {
  try {
    const { category, limit, lastKey } = req.query;
    const options = {
      category,
      limit: limit ? parseInt(limit, 10) : 50,
    };

    if (lastKey) {
      options.lastEvaluatedKey = JSON.parse(Buffer.from(lastKey, 'base64').toString());
    }

    const result = await productOperations.getAllProducts(options);
    
    // Encode the lastEvaluatedKey for pagination
    const response = {
      items: result.items,
      pagination: result.lastEvaluatedKey ? {
        lastKey: Buffer.from(JSON.stringify(result.lastEvaluatedKey)).toString('base64'),
      } : null,
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/products/search
 * @desc    Search products
 * @access  Private
 */
router.get('/search', async (req, res, next) => {
  try {
    const { q } = req.query;
    
    if (!q || q.trim().length < 2) {
      return res.status(400).json({ message: 'Search query must be at least 2 characters' });
    }
    
    const products = await productOperations.searchProducts(q);
    res.json(products);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/products/:id
 * @desc    Get product by ID
 * @access  Private
 */
router.get('/:id', async (req, res, next) => {
  try {
    const product = await productOperations.getProductById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    res.json(product);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/products
 * @desc    Create a new product
 * @access  Private (Admin only)
 */
router.post('/', [
  requireRole('admin'),
  body('name').notEmpty().withMessage('Product name is required'),
  body('price').isNumeric().withMessage('Price must be a number'),
  body('category').notEmpty().withMessage('Category is required'),
], async (req, res, next) => {
  // Validate request
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  try {
    const product = await productOperations.createProduct(req.body);
    res.status(201).json(product);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PUT /api/products/:id
 * @desc    Update a product
 * @access  Private (Admin only)
 */
router.put('/:id', [
  requireRole('admin'),
  body('price').optional().isNumeric().withMessage('Price must be a number'),
], async (req, res, next) => {
  // Validate request
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  try {
    // Check if product exists
    const existingProduct = await productOperations.getProductById(req.params.id);
    
    if (!existingProduct) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    const updatedProduct = await productOperations.updateProduct(req.params.id, req.body);
    res.json(updatedProduct);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   DELETE /api/products/:id
 * @desc    Delete a product
 * @access  Private (Admin only)
 */
router.delete('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    // Check if product exists
    const existingProduct = await productOperations.getProductById(req.params.id);
    
    if (!existingProduct) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    await productOperations.deleteProduct(req.params.id);
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;