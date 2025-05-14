import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import api from '../services/api';

// Create Cart Context
const CartContext = createContext();

// Hook to use the Cart Context
export const useCart = () => {
  return useContext(CartContext);
};

// Cart Provider Component
export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState([]);
  const [total, setTotal] = useState(0);
  const { isAuthenticated } = useAuth();

  // Calculate total whenever cart changes
  useEffect(() => {
    const newTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    setTotal(newTotal);
  }, [cart]);

  // Add item to cart
  const addToCart = (product) => {
    setCart(prevCart => {
      // Check if product already exists in cart
      const existingItem = prevCart.find(item => item.productId === product.productId);
      
      if (existingItem) {
        // Update quantity if product already in cart
        return prevCart.map(item => 
          item.productId === product.productId 
            ? { ...item, quantity: item.quantity + 1 } 
            : item
        );
      } else {
        // Add new product to cart
        return [...prevCart, { ...product, quantity: 1 }];
      }
    });
  };

  // Update item quantity
  const updateQuantity = (productId, quantity) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    
    setCart(prevCart => 
      prevCart.map(item => 
        item.productId === productId 
          ? { ...item, quantity } 
          : item
      )
    );
  };

  // Remove item from cart
  const removeFromCart = (productId) => {
    setCart(prevCart => prevCart.filter(item => item.productId !== productId));
  };

  // Clear cart
  const clearCart = () => {
    setCart([]);
  };

  // Process checkout
  const checkout = async (paymentMethod) => {
    if (!isAuthenticated || cart.length === 0) {
      return null;
    }
    
    try {
      const transaction = {
        items: cart.map(item => ({
          productId: item.productId,
          name: item.name,
          price: item.price,
          quantity: item.quantity
        })),
        total,
        paymentMethod
      };
      
      const response = await api.post('/transactions', transaction);
      return response.data;
    } catch (error) {
      console.error('Checkout error:', error);
      throw error;
    }
  };

  // Value to be provided by the context
  const value = {
    cart,
    total,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    checkout,
    itemCount: cart.reduce((count, item) => count + item.quantity, 0)
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};