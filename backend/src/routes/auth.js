const express = require('express');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const AWS = require('aws-sdk');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// Configure Cognito
const cognito = new AWS.CognitoIdentityServiceProvider({
  region: process.env.AWS_REGION || 'us-east-1',
});

const userPoolId = process.env.COGNITO_USER_POOL_ID;
const clientId = process.env.COGNITO_CLIENT_ID;

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login', [
  body('username').notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required'),
], async (req, res, next) => {
  // Validate request
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  try {
    const { username, password } = req.body;
    
    const params = {
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: clientId,
      AuthParameters: {
        USERNAME: username,
        PASSWORD: password,
      },
    };
    
    const authResult = await cognito.initiateAuth(params).promise();
    
    // Get user info
    const userParams = {
      AccessToken: authResult.AuthenticationResult.AccessToken,
    };
    
    const userInfo = await cognito.getUser(userParams).promise();
    
    // Format user attributes
    const attributes = {};
    userInfo.UserAttributes.forEach(attr => {
      attributes[attr.Name] = attr.Value;
    });
    
    res.json({
      tokens: {
        idToken: authResult.AuthenticationResult.IdToken,
        accessToken: authResult.AuthenticationResult.AccessToken,
        refreshToken: authResult.AuthenticationResult.RefreshToken,
        expiresIn: authResult.AuthenticationResult.ExpiresIn,
      },
      user: {
        username: userInfo.Username,
        email: attributes.email,
        givenName: attributes.given_name,
        familyName: attributes.family_name,
        role: attributes['custom:role'],
        employeeId: attributes['custom:employeeId'],
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    
    if (error.code === 'NotAuthorizedException') {
      return res.status(401).json({ message: 'Invalid username or password' });
    }
    
    if (error.code === 'UserNotFoundException') {
      return res.status(401).json({ message: 'Invalid username or password' });
    }
    
    next(error);
  }
});

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh tokens
 * @access  Public
 */
router.post('/refresh', [
  body('refreshToken').notEmpty().withMessage('Refresh token is required'),
], async (req, res, next) => {
  // Validate request
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  try {
    const { refreshToken } = req.body;
    
    const params = {
      AuthFlow: 'REFRESH_TOKEN_AUTH',
      ClientId: clientId,
      AuthParameters: {
        REFRESH_TOKEN: refreshToken,
      },
    };
    
    const authResult = await cognito.initiateAuth(params).promise();
    
    res.json({
      idToken: authResult.AuthenticationResult.IdToken,
      accessToken: authResult.AuthenticationResult.AccessToken,
      expiresIn: authResult.AuthenticationResult.ExpiresIn,
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    
    if (error.code === 'NotAuthorizedException') {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }
    
    next(error);
  }
});

/**
 * @route   POST /api/auth/change-password
 * @desc    Change password
 * @access  Private
 */
router.post('/change-password', [
  body('oldPassword').notEmpty().withMessage('Old password is required'),
  body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
], async (req, res, next) => {
  // Validate request
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  try {
    const { oldPassword, newPassword } = req.body;
    const accessToken = req.headers.authorization.split(' ')[1];
    
    const params = {
      PreviousPassword: oldPassword,
      ProposedPassword: newPassword,
      AccessToken: accessToken,
    };
    
    await cognito.changePassword(params).promise();
    
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    
    if (error.code === 'NotAuthorizedException') {
      return res.status(401).json({ message: 'Incorrect old password' });
    }
    
    if (error.code === 'InvalidPasswordException') {
      return res.status(400).json({ message: error.message });
    }
    
    next(error);
  }
});

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Initiate forgot password process
 * @access  Public
 */
router.post('/forgot-password', [
  body('username').notEmpty().withMessage('Username is required'),
], async (req, res, next) => {
  // Validate request
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  try {
    const { username } = req.body;
    
    const params = {
      ClientId: clientId,
      Username: username,
    };
    
    await cognito.forgotPassword(params).promise();
    
    res.json({ message: 'Password reset code sent' });
  } catch (error) {
    console.error('Forgot password error:', error);
    
    if (error.code === 'UserNotFoundException') {
      // Return success anyway to prevent username enumeration
      return res.json({ message: 'Password reset code sent if account exists' });
    }
    
    next(error);
  }
});

/**
 * @route   POST /api/auth/confirm-forgot-password
 * @desc    Complete forgot password process
 * @access  Public
 */
router.post('/confirm-forgot-password', [
  body('username').notEmpty().withMessage('Username is required'),
  body('confirmationCode').notEmpty().withMessage('Confirmation code is required'),
  body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
], async (req, res, next) => {
  // Validate request
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  try {
    const { username, confirmationCode, newPassword } = req.body;
    
    const params = {
      ClientId: clientId,
      Username: username,
      ConfirmationCode: confirmationCode,
      Password: newPassword,
    };
    
    await cognito.confirmForgotPassword(params).promise();
    
    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Confirm forgot password error:', error);
    
    if (error.code === 'CodeMismatchException') {
      return res.status(400).json({ message: 'Invalid confirmation code' });
    }
    
    if (error.code === 'ExpiredCodeException') {
      return res.status(400).json({ message: 'Confirmation code has expired' });
    }
    
    if (error.code === 'InvalidPasswordException') {
      return res.status(400).json({ message: error.message });
    }
    
    next(error);
  }
});

/**
 * @route   POST /api/auth/users
 * @desc    Create a new user (admin only)
 * @access  Private (Admin only)
 */
router.post('/users', [
  requireRole('admin'),
  body('username').notEmpty().withMessage('Username is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('givenName').notEmpty().withMessage('Given name is required'),
  body('familyName').notEmpty().withMessage('Family name is required'),
  body('role').isIn(['admin', 'cashier', 'manager']).withMessage('Role must be admin, cashier, or manager'),
], async (req, res, next) => {
  // Validate request
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  try {
    const { username, password, email, givenName, familyName, role, employeeId } = req.body;
    
    // Create user
    const createParams = {
      UserPoolId: userPoolId,
      Username: username,
      TemporaryPassword: password,
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'email_verified', Value: 'true' },
        { Name: 'given_name', Value: givenName },
        { Name: 'family_name', Value: familyName },
        { Name: 'custom:role', Value: role },
        ...(employeeId ? [{ Name: 'custom:employeeId', Value: employeeId }] : []),
      ],
    };
    
    await cognito.adminCreateUser(createParams).promise();
    
    // Set permanent password
    const passwordParams = {
      UserPoolId: userPoolId,
      Username: username,
      Password: password,
      Permanent: true,
    };
    
    await cognito.adminSetUserPassword(passwordParams).promise();
    
    res.status(201).json({
      message: 'User created successfully',
      user: {
        username,
        email,
        givenName,
        familyName,
        role,
        employeeId,
      },
    });
  } catch (error) {
    console.error('Create user error:', error);
    
    if (error.code === 'UsernameExistsException') {
      return res.status(400).json({ message: 'Username already exists' });
    }
    
    if (error.code === 'InvalidPasswordException') {
      return res.status(400).json({ message: error.message });
    }
    
    next(error);
  }
});

/**
 * @route   GET /api/auth/me
 * @desc    Get current user info
 * @access  Private
 */
router.get('/me', async (req, res, next) => {
  try {
    const accessToken = req.headers.authorization.split(' ')[1];
    
    const params = {
      AccessToken: accessToken,
    };
    
    const userInfo = await cognito.getUser(params).promise();
    
    // Format user attributes
    const attributes = {};
    userInfo.UserAttributes.forEach(attr => {
      attributes[attr.Name] = attr.Value;
    });
    
    res.json({
      username: userInfo.Username,
      email: attributes.email,
      givenName: attributes.given_name,
      familyName: attributes.family_name,
      role: attributes['custom:role'],
      employeeId: attributes['custom:employeeId'],
    });
  } catch (error) {
    console.error('Get user error:', error);
    
    if (error.code === 'NotAuthorizedException') {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
    
    next(error);
  }
});

module.exports = router;