import React, { useEffect, useState } from 'react';
import { fetchMostBorrowed } from '../../services/statisticsApi';

function MostBorrowedThisWeekCard() {
  const [data, setData] = useState({ items: [], rangeDays: 7, limit: 5 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const result = await fetchMostBorrowed({ days: 7, limit: 5 });
        setData(result);
        setError(null);
      } catch (err) {
        console.error('Error loading most borrowed:', err);
        setError('Failed to load most borrowed books');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="statistics-card">
        <h2>Most Borrowed (Last {data.rangeDays} Days)</h2>
        <div>Loading most borrowed books...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="statistics-card">
        <h2>Most Borrowed</h2>
        <div className="statistics-card-error">Error: {error}</div>
      </div>
    );
  }

  if (!data.items || data.items.length === 0) {
    return (
      <div className="statistics-card">
        <h2>Most Borrowed (Last {data.rangeDays} Days)</h2>
        <div className="statistics-card-empty">
          No borrowing data yet for the last {data.rangeDays} days.
        </div>
      </div>
    );
  }

  const topItem = data.items[0];
  const coverUrl =
    topItem.book_cover_url || topItem.coverUrl || '/lib.png';

  return (
    <div className="statistics-card">
      <h2>Most Borrowed (Last {data.rangeDays} Days)</h2>
      <div className="statistics-card-content">
        <img
          src={coverUrl}
          alt={topItem.title}
          className="statistics-card-image"
          onError={(e) => { e.target.src = '/lib.png'; }}
        />
        <div className="statistics-card-list">
          <ul>
            {data.items.map((item) => (
              <li key={item.bookId}>
                <strong>{item.title}</strong> by {item.author}{' '}
                ({item.borrowCount} borrows)
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default MostBorrowedThisWeekCard;