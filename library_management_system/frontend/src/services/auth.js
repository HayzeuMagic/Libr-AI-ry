import api from './api';
import { jwtDecode } from 'jwt-decode';

// LOGIN
export const loginUser = async (credentials) => {
  try {
    const response = await api.post('/login/', credentials);

    const { access, refresh, user } = response.data;

    localStorage.setItem('accessToken', access);
    localStorage.setItem('refreshToken', refresh);

    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('isAdmin', user.is_staff ? 'true' : 'false');
    }

    return user;
  } catch (error) {
    console.error('❌ Login failed:', error.response?.data || error.message);
    throw error;
  }
};

// LOGOUT
export const logout = () => {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  localStorage.removeItem('isAdmin');
  localStorage.removeItem('isLoggedIn');
};

// GET CURRENT USER
export const getCurrentUser = () => {
  const token = localStorage.getItem('accessToken');

  if (!token) {
    return { isAuthenticated: false };
  }

  try {
    const decoded = jwtDecode(token);
    const user = localStorage.getItem('user')
      ? JSON.parse(localStorage.getItem('user'))
      : null;

    const isAdmin =
      localStorage.getItem('isAdmin') === 'true' || user?.is_staff || false;

    return {
      isAuthenticated: true,
      user,
      isAdmin,
      exp: decoded.exp,
    };
  } catch (error) {
    console.warn('⚠️ Failed to decode token:', error);
    logout();
    return { isAuthenticated: false };
  }
};