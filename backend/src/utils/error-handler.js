const { validationResult } = require('express-validator');

/**
 * Central error handler for the application
 * @param {Object} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function errorHandler(err, req, res, next) {
  console.error('Error:', err);
  
  // Handle validation errors
  if (err instanceof validationResult.Result) {
    return res.status(400).json({ errors: err.array() });
  }
  
  // Handle AWS SDK errors
  if (err.code) {
    switch (err.code) {
      case 'ConditionalCheckFailedException':
        return res.status(409).json({ message: 'Resource already exists or condition not met' });
      
      case 'ResourceNotFoundException':
        return res.status(404).json({ message: 'Resource not found' });
      
      case 'ServiceUnavailable':
        return res.status(503).json({ message: 'Service temporarily unavailable' });
      
      case 'ThrottlingException':
        return res.status(429).json({ message: 'Too many requests, please try again later' });
      
      case 'ValidationException':
        return res.status(400).json({ message: err.message || 'Validation error' });
      
      case 'AccessDeniedException':
        return res.status(403).json({ message: 'Access denied' });
        
      case 'ProvisionedThroughputExceededException':
        return res.status(429).json({ message: 'Database capacity exceeded, please try again later' });
    }
  }
  
  // Default error response
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';
  
  // In production, don't send detailed error info
  if (process.env.NODE_ENV === 'production' && statusCode === 500) {
    return res.status(500).json({ message: 'Internal server error' });
  }
  
  // Include stack trace in development
  const response = {
    message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  };
  
  res.status(statusCode).json(response);
}

module.exports = {
  errorHandler,
};