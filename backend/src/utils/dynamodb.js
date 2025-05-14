const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

// Configure AWS
if (process.env.NODE_ENV !== 'production') {
  // Local development settings
  AWS.config.update({
    region: process.env.AWS_REGION || 'us-east-1',
    // For local development with DynamoDB local
    ...(process.env.DYNAMODB_ENDPOINT && {
      endpoint: process.env.DYNAMODB_ENDPOINT,
      accessKeyId: 'LOCAL_KEY',
      secretAccessKey: 'LOCAL_SECRET',
    }),
  });
}

// Initialize DynamoDB client
const documentClient = new AWS.DynamoDB.DocumentClient();

// Get table names from environment variables
const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE || 'Products';
const TRANSACTIONS_TABLE = process.env.TRANSACTIONS_TABLE || 'Transactions';

// Product operations
const productOperations = {
  /**
   * Get all products
   * @param {Object} options - Query options
   * @returns {Promise<Array>} List of products
   */
  getAllProducts: async (options = {}) => {
    const { category, limit = 50, lastEvaluatedKey } = options;
    
    let params = {
      TableName: PRODUCTS_TABLE,
      Limit: limit,
    };
    
    // Add pagination support
    if (lastEvaluatedKey) {
      params.ExclusiveStartKey = lastEvaluatedKey;
    }
    
    // If category is provided, use the GSI
    if (category) {
      params = {
        TableName: PRODUCTS_TABLE,
        IndexName: 'CategoryIndex',
        KeyConditionExpression: 'category = :category',
        ExpressionAttributeValues: {
          ':category': category,
        },
        Limit: limit,
      };
      
      if (lastEvaluatedKey) {
        params.ExclusiveStartKey = lastEvaluatedKey;
      }
    }
    
    try {
      const result = await documentClient.scan(params).promise();
      return {
        items: result.Items,
        lastEvaluatedKey: result.LastEvaluatedKey,
      };
    } catch (error) {
      console.error('Error fetching products:', error);
      throw error;
    }
  },
  
  /**
   * Get product by ID
   * @param {string} productId - Product ID
   * @returns {Promise<Object>} Product details
   */
  getProductById: async (productId) => {
    const params = {
      TableName: PRODUCTS_TABLE,
      Key: {
        productId,
      },
    };
    
    try {
      const result = await documentClient.get(params).promise();
      return result.Item;
    } catch (error) {
      console.error(`Error fetching product ${productId}:`, error);
      throw error;
    }
  },
  
  /**
   * Create new product
   * @param {Object} product - Product data
   * @returns {Promise<Object>} Created product
   */
  createProduct: async (product) => {
    const timestamp = new Date().toISOString();
    const productId = uuidv4();
    
    const params = {
      TableName: PRODUCTS_TABLE,
      Item: {
        productId,
        ...product,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    };
    
    try {
      await documentClient.put(params).promise();
      return params.Item;
    } catch (error) {
      console.error('Error creating product:', error);
      throw error;
    }
  },
  
  /**
   * Update product
   * @param {string} productId - Product ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated product
   */
  updateProduct: async (productId, updates) => {
    const timestamp = new Date().toISOString();
    
    // Build update expression and attribute values
    let updateExpression = 'set updatedAt = :updatedAt';
    const expressionAttributeValues = {
      ':updatedAt': timestamp,
    };
    
    // Add all updates to the expression
    Object.keys(updates).forEach((key) => {
      // Skip productId as it's a key
      if (key !== 'productId') {
        updateExpression += `, ${key} = :${key}`;
        expressionAttributeValues[`:${key}`] = updates[key];
      }
    });
    
    const params = {
      TableName: PRODUCTS_TABLE,
      Key: {
        productId,
      },
      UpdateExpression: updateExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    };
    
    try {
      const result = await documentClient.update(params).promise();
      return result.Attributes;
    } catch (error) {
      console.error(`Error updating product ${productId}:`, error);
      throw error;
    }
  },
  
  /**
   * Delete product
   * @param {string} productId - Product ID
   * @returns {Promise<boolean>} Deletion success
   */
  deleteProduct: async (productId) => {
    const params = {
      TableName: PRODUCTS_TABLE,
      Key: {
        productId,
      },
    };
    
    try {
      await documentClient.delete(params).promise();
      return true;
    } catch (error) {
      console.error(`Error deleting product ${productId}:`, error);
      throw error;
    }
  },
  
  /**
   * Search products
   * @param {string} query - Search query
   * @returns {Promise<Array>} Search results
   */
  searchProducts: async (query) => {
    const params = {
      TableName: PRODUCTS_TABLE,
      FilterExpression: 'contains(#name, :query) OR contains(#description, :query) OR contains(#sku, :query)',
      ExpressionAttributeNames: {
        '#name': 'name',
        '#description': 'description',
        '#sku': 'sku',
      },
      ExpressionAttributeValues: {
        ':query': query,
      },
    };
    
    try {
      const result = await documentClient.scan(params).promise();
      return result.Items;
    } catch (error) {
      console.error(`Error searching products for '${query}':`, error);
      throw error;
    }
  },
};

// Transaction operations
const transactionOperations = {
  /**
   * Create new transaction
   * @param {Object} transaction - Transaction data
   * @returns {Promise<Object>} Created transaction
   */
  createTransaction: async (transaction) => {
    const timestamp = new Date().toISOString();
    const date = timestamp.split('T')[0]; // Extract YYYY-MM-DD
    const transactionId = uuidv4();
    
    const params = {
      TableName: TRANSACTIONS_TABLE,
      Item: {
        transactionId,
        timestamp,
        date, // For date-based queries
        ...transaction,
        status: transaction.status || 'completed',
      },
    };
    
    try {
      await documentClient.put(params).promise();
      return params.Item;
    } catch (error) {
      console.error('Error creating transaction:', error);
      throw error;
    }
  },
  
  /**
   * Get transaction by ID
   * @param {string} transactionId - Transaction ID
   * @returns {Promise<Object>} Transaction details
   */
  getTransactionById: async (transactionId) => {
    const params = {
      TableName: TRANSACTIONS_TABLE,
      Key: {
        transactionId,
      },
    };
    
    try {
      const result = await documentClient.get(params).promise();
      return result.Item;
    } catch (error) {
      console.error(`Error fetching transaction ${transactionId}:`, error);
      throw error;
    }
  },
  
  /**
   * Get transactions by date range
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @returns {Promise<Array>} Transactions within date range
   */
  getTransactionsByDateRange: async (startDate, endDate) => {
    // If we have a date index, we can use a query
    const params = {
      TableName: TRANSACTIONS_TABLE,
      IndexName: 'DateIndex',
      KeyConditionExpression: '#date BETWEEN :startDate AND :endDate',
      ExpressionAttributeNames: {
        '#date': 'date',
      },
      ExpressionAttributeValues: {
        ':startDate': startDate,
        ':endDate': endDate,
      },
    };
    
    try {
      const result = await documentClient.query(params).promise();
      return result.Items;
    } catch (error) {
      console.error(`Error fetching transactions between ${startDate} and ${endDate}:`, error);
      throw error;
    }
  },
  
  /**
   * Get transactions by cashier
   * @param {string} cashierId - Cashier ID
   * @returns {Promise<Array>} Transactions by cashier
   */
  getTransactionsByCashier: async (cashierId) => {
    const params = {
      TableName: TRANSACTIONS_TABLE,
      IndexName: 'CashierIndex',
      KeyConditionExpression: 'cashierId = :cashierId',
      ExpressionAttributeValues: {
        ':cashierId': cashierId,
      },
    };
    
    try {
      const result = await documentClient.query(params).promise();
      return result.Items;
    } catch (error) {
      console.error(`Error fetching transactions for cashier ${cashierId}:`, error);
      throw error;
    }
  },
};

module.exports = {
  productOperations,
  transactionOperations,
  PRODUCTS_TABLE,
  TRANSACTIONS_TABLE,
};