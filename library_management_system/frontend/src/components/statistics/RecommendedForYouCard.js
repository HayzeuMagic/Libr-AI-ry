import React, { useEffect, useState } from 'react';
import { fetchUserRecommendations } from '../../services/statisticsApi';

const TEST_USER_ID = 17;

function RecommendedForYouCard() {
  const [data, setData] = useState({ items: [], userId: TEST_USER_ID, limit: 5 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const result = await fetchUserRecommendations({
          userId: TEST_USER_ID,
          limit: 5,
        });
        setData(result);
        setError(null);
      } catch (err) {
        console.error('Error loading recommendations:', err);
        setError('Failed to load recommendations');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="statistics-card">
        <h2>Recommended For You</h2>
        <div>Loading recommendations...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="statistics-card">
        <h2>Recommended For You</h2>
        <div className="statistics-card-error">Error: {error}</div>
      </div>
    );
  }

  if (!data.items || data.items.length === 0) {
    return (
      <div className="statistics-card">
        <h2>Recommended For You</h2>
        <div className="statistics-card-empty">
          No recommendations yet. Borrow more books to improve your recommendations.
        </div>
      </div>
    );
  }

  const topItem = data.items[0];

  return (
    <div className="statistics-card">
      <h2>Recommended For You</h2>
      <div className="statistics-card-content">
        {topItem.imageUrl && (
          <img
            src={topItem.imageUrl}
            alt={topItem.title}
            className="statistics-card-image"
          />
        )}
        <div className="statistics-card-list">
          <ul>
            {data.items.map((item) => (
              <li key={item.bookId}>
                <strong>{item.title}</strong> by {item.author}{' '}
                {item.reason && <span>({item.reason})</span>}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default RecommendedForYouCard;