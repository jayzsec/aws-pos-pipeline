import axios from 'axios';

// Load API URL from environment or config.json
let API_URL = process.env.REACT_APP_API_URL;

// Try to load config from config.json if API_URL is not set
if (!API_URL) {
  try {
    // Attempt to fetch config.json if it exists
    fetch('/config.json')
      .then(response => response.json())
      .then(config => {
        API_URL = config.apiEndpoint;
        api.defaults.baseURL = API_URL;
      })
      .catch(error => {
        console.error('Error loading config.json:', error);
        // Fallback to localhost for development
        API_URL = 'http://localhost:3000';
        api.defaults.baseURL = API_URL;
      });
  } catch (error) {
    console.error('Error loading config:', error);
    // Fallback to localhost for development
    API_URL = 'http://localhost:3000';
  }
} 

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor for authentication
api.interceptors.request.use(
  (config) => {
    // Get tokens from localStorage
    const tokensString = localStorage.getItem('tokens');
    
    if (tokensString) {
      try {
        const tokens = JSON.parse(tokensString);
        
        // Add authorization header
        if (tokens.accessToken) {
          config.headers.Authorization = `Bearer ${tokens.accessToken}`;
        }
      } catch (error) {
        console.error('Error parsing tokens from localStorage:', error);
      }
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor for token refresh
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    
    // If the error is 401 and we haven't retried yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const tokensString = localStorage.getItem('tokens');
        
        if (tokensString) {
          const tokens = JSON.parse(tokensString);
          
          // Attempt to refresh the token
          const refreshResponse = await axios.post(`${API_URL}/auth/refresh`, {
            refreshToken: tokens.refreshToken,
          });
          
          const newTokens = {
            ...tokens,
            accessToken: refreshResponse.data.accessToken,
            idToken: refreshResponse.data.idToken,
            expiresIn: refreshResponse.data.expiresIn,
          };
          
          // Update tokens in localStorage
          localStorage.setItem('tokens', JSON.stringify(newTokens));
          
          // Update authorization header for the original request
          originalRequest.headers.Authorization = `Bearer ${newTokens.accessToken}`;
          
          // Retry the original request
          return api(originalRequest);
        }
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        
        // If refresh fails, redirect to login
        localStorage.removeItem('tokens');
        window.location.href = '/login';
        
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

// API service functions
const apiService = {
  // Auth endpoints
  auth: {
    login: (username, password) => api.post('/api/auth/login', { username, password }),
    refreshToken: (refreshToken) => api.post('/api/auth/refresh', { refreshToken }),
    changePassword: (oldPassword, newPassword) => api.post('/api/auth/change-password', { oldPassword, newPassword }),
    getUserProfile: () => api.get('/api/auth/me'),
  },
  
  // Product endpoints
  products: {
    getAll: (params) => api.get('/api/products', { params }),
    getById: (id) => api.get(`/api/products/${id}`),
    search: (query) => api.get(`/api/products/search`, { params: { q: query } }),
    create: (product) => api.post('/api/products', product),
    update: (id, product) => api.put(`/api/products/${id}`, product),
    delete: (id) => api.delete(`/api/products/${id}`),
  },
  
  // Transaction endpoints
  transactions: {
    create: (transaction) => api.post('/api/transactions', transaction),
    getById: (id) => api.get(`/api/transactions/${id}`),
    getByDateRange: (startDate, endDate) => api.get(`/api/transactions/date/${startDate}/${endDate}`),
    getByCashier: (cashierId) => api.get(`/api/transactions/cashier/${cashierId}`),
    getOwn: () => api.get('/api/transactions/me'),
    getAll: (params) => api.get('/api/transactions', { params }),
  },
};

export default api;
export { apiService };