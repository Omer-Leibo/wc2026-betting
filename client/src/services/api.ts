import axios from 'axios';

const api = axios.create({
  // Dynamically use the same hostname the page was loaded from,
  // so it works both on localhost AND when accessed from a phone on the same WiFi.
  baseURL: import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3001/api`,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Global error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
