import React, { useEffect, useState } from 'react';
import { fetchTrending } from '../../services/statisticsApi';

function TrendingBooksCard() {
  const [data, setData] = useState({ items: [], rangeDays: 7, limit: 5 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const result = await fetchTrending({ days: 7, limit: 5 });
        setData(result);
        setError(null);
      } catch (err) {
        console.error('Error loading trending books:', err);
        setError('Failed to load trending books');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="statistics-card">
        <h2>Trending Books (Last {data.rangeDays} Days)</h2>
        <div>Loading trending books...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="statistics-card">
        <h2>Trending Books</h2>
        <div className="statistics-card-error">Error: {error}</div>
      </div>
    );
  }

  if (!data.items || data.items.length === 0) {
    return (
      <div className="statistics-card">
        <h2>Trending Books (Last {data.rangeDays} Days)</h2>
        <div className="statistics-card-empty">
          No trending data yet for the last {data.rangeDays} days.
        </div>
      </div>
    );
  }

  const topItem = data.items[0];
  const coverUrl =
    topItem.book_cover_url || topItem.coverUrl || '/lib.png';

  return (
    <div className="statistics-card">
      <h2>Trending Books (Last {data.rangeDays} Days)</h2>
      <div className="statistics-card-content">
        <img
          src={coverUrl}
          alt={topItem.title}
          className="statistics-card-image"
          onError={(e) => { e.target.src = '/lib.png'; }}
        />
        <div className="statistics-card-list">
          <ul>
            {data.items.map((item) => {
              const rawScore = item.trendingScore;
              const numericScore =
                typeof rawScore === 'number' ? rawScore : Number(rawScore);
              const scoreText =
                Number.isFinite(numericScore) ? numericScore.toFixed(2) : 'N/A';

              return (
                <li key={item.bookId}>
                  <strong>{item.title}</strong> by {item.author}{' '}
                  (borrows: {item.borrowCount}, searches: {item.searchCount}, score: {scoreText})
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default TrendingBooksCard;