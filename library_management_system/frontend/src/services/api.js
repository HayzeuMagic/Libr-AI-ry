import axios from 'axios';

const API_BASE = 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  xsrfCookieName: 'csrftoken',
  xsrfHeaderName: 'X-CSRFToken',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

const clearSession = () => {
  ['accessToken', 'refreshToken', 'user', 'isAdmin', 'isLoggedIn'].forEach((k) =>
    localStorage.removeItem(k)
  );
};

// Access tokens expire after 1 hour. Previously every request then failed
// with 401 until the user manually logged out and in again. Now we refresh
// once, retry, and only send the user to /login if the refresh also fails.
let refreshPromise = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    const isAuthCall = original?.url?.includes('/login/') || original?.url?.includes('/token/refresh/');

    if (status !== 401 || !original || original._retried || isAuthCall) {
      return Promise.reject(error);
    }

    const refresh = localStorage.getItem('refreshToken');
    if (!refresh) {
      return Promise.reject(error);
    }

    try {
      refreshPromise =
        refreshPromise ||
        axios
          .post(`${API_BASE}/token/refresh/`, { refresh })
          .finally(() => {
            refreshPromise = null;
          });
      const { data } = await refreshPromise;
      localStorage.setItem('accessToken', data.access);
      original._retried = true;
      original.headers.Authorization = `Bearer ${data.access}`;
      return api(original);
    } catch (refreshError) {
      clearSession();
      if (window.location.pathname !== '/login') {
        window.location.assign('/login');
      }
      return Promise.reject(error);
    }
  }
);

// Book-related API
export const getBooks = () => api.get('/books/list/');
export const searchBooks = (query) =>
  api.get(`/books/search/?q=${encodeURIComponent(query)}`);
export const updateBook = (id, bookData) => api.put(`/books/${id}/`, bookData);
export const borrowBook = (id) => api.post('/reservations/reserve/', { book_id: id });
export const returnBook = (id) => api.post(`/reservations/return/${id}/`);

// Reservations API
export const getReservationHistory = () => api.get('/reservations/history/');

// Chatbot API
export const sendChatMessage = (message, history = []) =>
  api.post('/chatbot/chat/', { message, history });

export default api;
