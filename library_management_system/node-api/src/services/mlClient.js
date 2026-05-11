// src/services/mlClient.js
const axios = require('axios');

const ML_BASE_URL = process.env.ML_BASE_URL || 'http://localhost:5000';

async function trainModel() {
  const url = `${ML_BASE_URL}/ml/train`;
  const response = await axios.post(url);
  return response.data;
}

async function getUserRecommendations(userId, topK = 10) {
  const url = `${ML_BASE_URL}/ml/recommend/user`;
  const payload = { user_id: userId, top_k: topK };
  const response = await axios.post(url, payload);
  return response.data;
}

async function getAlsoBorrowed(bookId, topK = 10) {
  const url = `${ML_BASE_URL}/ml/recommend/also-borrowed`;
  const payload = { book_id: bookId, top_k: topK };
  const response = await axios.post(url, payload);
  return response.data;
}

module.exports = {
  trainModel,
  getUserRecommendations,
  getAlsoBorrowed,
};