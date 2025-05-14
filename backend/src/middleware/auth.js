const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const AWS = require('aws-sdk');

// Get AWS region and Cognito user pool ID from environment variables
const region = process.env.AWS_REGION || 'us-east-1';
const userPoolId = process.env.COGNITO_USER_POOL_ID;

// Initialize JWKS client
const client = jwksClient({
  jwksUri: `https://cognito-idp.${region}.amazonaws.com/${userPoolId}/.well-known/jwks.json`
});

/**
 * Get signing key from JWKS
 * @param {string} kid - Key ID
 * @returns {Promise<Object>} Signing key
 */
function getSigningKey(kid) {
  return new Promise((resolve, reject) => {
    client.getSigningKey(kid, (err, key) => {
      if (err) {
        return reject(err);
      }
      
      const signingKey = key.publicKey || key.rsaPublicKey;
      resolve(signingKey);
    });
  });
}

/**
 * Authenticate JWT token middleware
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function authenticate(req, res, next) {
  try {
    // Get authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ message: 'No authorization header provided' });
    }
    
    // Split 'Bearer token'
    const parts = authHeader.split(' ');
    
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({ message: 'Authorization header format must be "Bearer token"' });
    }
    
    const token = parts[1];
    
    // Decode token to get key ID (kid)
    const decodedToken = jwt.decode(token, { complete: true });
    
    if (!decodedToken) {
      return res.status(401).json({ message: 'Invalid token' });
    }
    
    // Get signing key
    const signingKey = await getSigningKey(decodedToken.header.kid);
    
    // Verify token
    const verifiedToken = jwt.verify(token, signingKey, {
      algorithms: ['RS256'],
    });
    
    // Add user to request
    req.user = verifiedToken;
    
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    
    res.status(401).json({ message: 'Authentication failed' });
  }
}

/**
 * Require specific role middleware
 * @param {string} requiredRole - Required role
 * @returns {Function} Express middleware
 */
function requireRole(requiredRole) {
  return function(req, res, next) {
    // Ensure authenticate middleware has run
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    // Check if user has the required role
    const userRole = req.user['custom:role'];
    
    if (!userRole || userRole !== requiredRole) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }
    
    next();
  };
}

/**
 * Require any of the specified roles middleware
 * @param {Array<string>} roles - Array of allowed roles
 * @returns {Function} Express middleware
 */
function requireAnyRole(roles) {
  return function(req, res, next) {
    // Ensure authenticate middleware has run
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    // Check if user has any of the required roles
    const userRole = req.user['custom:role'];
    
    if (!userRole || !roles.includes(userRole)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }
    
    next();
  };
}

module.exports = {
  authenticate,
  requireRole,
  requireAnyRole,
};