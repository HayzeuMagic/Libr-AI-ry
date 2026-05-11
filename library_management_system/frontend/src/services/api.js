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

// Book-related API
export const getBooks = () => api.get('/books/list/');
export const searchBooks = (query) =>
  api.get(`/books/search/?q=${encodeURIComponent(query)}`);
export const addBook = (bookData) => api.post('/books/add/', bookData);
export const updateBook = (id, bookData) => api.put(`/books/update/${id}/`, bookData);
export const deleteBook = (id) => api.delete(`/books/delete/${id}/`);
export const borrowBook = (id) => api.post('/reservations/reserve/', { book_id: id });
export const returnBook = (id) => api.post(`/reservations/return/${id}/`);

// Reservations API
export const getReservationHistory = () => api.get('/reservations/history/');

// Chatbot API
export const sendChatMessage = (message, history = []) =>
  api.post('/chatbot/chat/', { message, history });

export default api;