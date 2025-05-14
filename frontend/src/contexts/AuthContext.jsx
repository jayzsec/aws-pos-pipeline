import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

// Create Auth Context
const AuthContext = createContext();

// Hook to use the Auth Context
export const useAuth = () => {
  return useContext(AuthContext);
};

// Auth Provider Component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [tokens, setTokens] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load tokens from localStorage on initial render
  useEffect(() => {
    const loadTokens = () => {
      const storedTokens = localStorage.getItem('tokens');
      
      if (storedTokens) {
        try {
          const parsedTokens = JSON.parse(storedTokens);
          setTokens(parsedTokens);
          
          // Fetch user info with the stored tokens
          fetchUserProfile(parsedTokens.accessToken);
        } catch (err) {
          console.error('Error parsing stored tokens:', err);
          localStorage.removeItem('tokens');
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };

    loadTokens();
  }, []);

  // Fetch user profile
  const fetchUserProfile = async (accessToken) => {
    try {
      // Set authorization header
      api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
      
      const response = await api.get('/auth/me');
      setUser(response.data);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching user profile:', err);
      
      // If token is invalid or expired, clear auth state
      if (err.response && (err.response.status === 401 || err.response.status === 403)) {
        logout();
      }
      
      setLoading(false);
    }
  };

  // Login function
  const login = async (username, password) => {
    try {
      setError(null);
      
      const response = await api.post('/auth/login', { username, password });
      const { tokens: newTokens, user: userData } = response.data;
      
      // Store tokens in state and localStorage
      setTokens(newTokens);
      localStorage.setItem('tokens', JSON.stringify(newTokens));
      
      // Set user data
      setUser(userData);
      
      // Set authorization header for future requests
      api.defaults.headers.common['Authorization'] = `Bearer ${newTokens.accessToken}`;
      
      return userData;
    } catch (err) {
      console.error('Login error:', err);
      
      const errorMessage = err.response?.data?.message || 'Login failed. Please try again.';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  // Logout function
  const logout = () => {
    // Remove tokens from localStorage
    localStorage.removeItem('tokens');
    
    // Clear auth state
    setTokens(null);
    setUser(null);
    
    // Remove authorization header
    delete api.defaults.headers.common['Authorization'];
  };

  // Refresh token function
  const refreshTokens = async () => {
    if (!tokens?.refreshToken) {
      throw new Error('No refresh token available');
    }
    
    try {
      const response = await api.post('/auth/refresh', {
        refreshToken: tokens.refreshToken
      });
      
      const newTokens = {
        ...tokens,
        accessToken: response.data.accessToken,
        idToken: response.data.idToken,
        expiresIn: response.data.expiresIn
      };
      
      // Update tokens in state and localStorage
      setTokens(newTokens);
      localStorage.setItem('tokens', JSON.stringify(newTokens));
      
      // Update authorization header
      api.defaults.headers.common['Authorization'] = `Bearer ${newTokens.accessToken}`;
      
      return newTokens;
    } catch (err) {
      console.error('Token refresh error:', err);
      
      // If refresh fails, log the user out
      logout();
      throw err;
    }
  };

  // Value to be provided by the context
  const value = {
    user,
    tokens,
    loading,
    error,
    isAuthenticated: !!user,
    login,
    logout,
    refreshTokens,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};