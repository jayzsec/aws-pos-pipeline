import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import ProductCatalog from '../components/pos/ProductCatalog';
import ShoppingCart from '../components/pos/ShoppingCart';
import Checkout from '../components/pos/Checkout';
import { Container, Grid, Paper, Typography, Box, Divider } from '@mui/material';

const POS = () => {
  const { user } = useAuth();
  const { cart, clearCart } = useCart();
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [transactionComplete, setTransactionComplete] = useState(false);
  const [transactionData, setTransactionData] = useState(null);

  // Handle checkout process
  const handleCheckout = () => {
    setIsCheckingOut(true);
  };

  // Handle cancel checkout
  const handleCancelCheckout = () => {
    setIsCheckingOut(false);
  };

  // Handle successful transaction
  const handleTransactionComplete = (data) => {
    setTransactionData(data);
    setTransactionComplete(true);
    clearCart();
  };

  // Start a new transaction
  const handleNewTransaction = () => {
    setTransactionComplete(false);
    setTransactionData(null);
    setIsCheckingOut(false);
  };

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom>
        Point of Sale
      </Typography>
      
      <Box mb={2}>
        <Typography variant="subtitle1">
          Cashier: {user?.givenName} {user?.familyName}
        </Typography>
      </Box>
      
      <Divider sx={{ mb: 3 }} />
      
      {transactionComplete ? (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h5" gutterBottom color="success.main">
            Transaction Complete
          </Typography>
          
          <Typography variant="body1" paragraph>
            Transaction ID: {transactionData?.transactionId}
          </Typography>
          
          <Typography variant="h6" gutterBottom>
            Total: ${transactionData?.total.toFixed(2)}
          </Typography>
          
          <Box mt={3}>
            <Button variant="contained" onClick={handleNewTransaction}>
              Start New Transaction
            </Button>
          </Box>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {isCheckingOut ? (
            <Grid item xs={12}>
              <Checkout 
                onCancel={handleCancelCheckout}
                onComplete={handleTransactionComplete}
              />
            </Grid>
          ) : (
            <>
              <Grid item xs={12} md={8}>
                <ProductCatalog />
              </Grid>
              
              <Grid item xs={12} md={4}>
                <ShoppingCart onCheckout={handleCheckout} />
              </Grid>
            </>
          )}
        </Grid>
      )}
    </Container>
  );
};

export default POS;