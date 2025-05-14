const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const compression = require('compression');
const { errorHandler } = require('./utils/error-handler');
const productRoutes = require('./routes/products');
const transactionRoutes = require('./routes/transactions');
const authRoutes = require('./routes/auth');
const authMiddleware = require('./middleware/auth');

// Initialize Express app
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(helmet());
app.use(compression());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API version endpoint
app.get('/version', (req, res) => {
  res.status(200).json({
    version: process.env.npm_package_version || '0.1.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', authMiddleware.authenticate, productRoutes);
app.use('/api/transactions', authMiddleware.authenticate, transactionRoutes);

// Error handling
app.use(errorHandler);

// Not found handler
app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.originalUrl} not found` });
});

// Start the server
app.listen(port, () => {
  console.log(`POS API server running on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Log table names for debugging
  console.log(`Products table: ${process.env.PRODUCTS_TABLE}`);
  console.log(`Transactions table: ${process.env.TRANSACTIONS_TABLE}`);
});

module.exports = app; // For testing purposes