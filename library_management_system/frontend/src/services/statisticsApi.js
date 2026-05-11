// frontend/src/services/statisticsApi.js

const API_BASE_URL = 'http://localhost:4000';

async function handleResponse(response) {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with status ${response.status}`);
  }
  return response.json();
}

export async function fetchMostBorrowed({ days = 7, limit = 5 } = {}) {
  // Uses your working Django endpoint that already returns data
  const url = `${API_BASE_URL}/api/analytics/most-borrowed/?days=${days}&limit=${limit}`;
  const res = await fetch(url);
  return handleResponse(res);
}

export async function fetchTrending({ days = 7, limit = 5 } = {}) {
  // Existing endpoint you already tested earlier
  const url = `${API_BASE_URL}/api/trending?days=${days}&limit=${limit}`;
  const res = await fetch(url);
  return handleResponse(res);
}

export async function fetchUserRecommendations({ userId, limit = 5 }) {
  const url = `${API_BASE_URL}/api/recommendations/user/${userId}?limit=${limit}`;
  const res = await fetch(url);
  return handleResponse(res);
}

// NOTE: We are NOT using this yet in the card, because the backend URL is not ready.
// When your Django endpoint works, you can use this function in StudentsAlsoBorrowedCard.
export async function fetchStudentsAlsoBorrowed({ bookId, limit = 5 }) {
  const url = `${API_BASE_URL}/api/analytics/recommendations/book/${bookId}/?limit=${limit}`;
  const res = await fetch(url);
  return handleResponse(res);
}