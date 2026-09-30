export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
};