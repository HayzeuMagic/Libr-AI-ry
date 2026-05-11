import React, { useEffect, useState, useCallback } from 'react';
import api from '../services/api';
import './BorrowedBook.css';

const mapReservation = (item) => {
  const now = new Date();
  const dueDateRaw = item?.due_date || item?.dueDate || null;
  const due = dueDateRaw ? new Date(dueDateRaw) : null;

  let diffDays = due ? Math.floor((due - now) / (1000 * 60 * 60 * 24)) : 0;
  if (diffDays < -7) diffDays = -7;

  let status = item?.status || 'on-time';
  if (status === 'borrowed') {
    if (diffDays < 0) status = 'overdue';
    else if (diffDays === 0) status = 'due-today';
    else if (diffDays <= 3) status = 'due-soon';
    else status = 'on-time';
  }

  return {
    id: item?.id,
    title: item?.book_title || item?.title || 'Untitled',
    author: item?.book_author || item?.author || 'Unknown author',
    dueDate: dueDateRaw ? String(dueDateRaw).slice(0, 10) : '—',
    daysLeft: diffDays,
    status,
    coverUrl: item?.book_cover_url || '/lib.png',
  };
};

const getStatusColor = (status) => {
  switch (status) {
    case 'overdue':
      return '#e53e3e';
    case 'due-today':
    case 'due-soon':
      return '#dd6b20';
    default:
      return '#3182ce';
  }
};

const getStatusLabel = (status) => {
  switch (status) {
    case 'overdue':
      return 'Overdue';
    case 'due-today':
      return 'Due Today';
    case 'due-soon':
      return 'Due Soon';
    default:
      return 'On Time';
  }
};

const getDaysLeftLabel = (daysLeft, status) => {
  if (status === 'overdue') return `${Math.abs(daysLeft)}d overdue`;
  if (status === 'due-today') return 'Due today';
  return `${daysLeft}d left`;
};

const getDaysLeftClass = (status) => {
  if (status === 'overdue') return 'days-left overdue';
  if (status === 'due-today' || status === 'due-soon') return 'days-left warning';
  return 'days-left safe';
};

const BorrowedBook = () => {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedOverdue, setSelectedOverdue] = useState(null);
  const [renewingId, setRenewingId] = useState(null);
  const [pendingPayments, setPendingPayments] = useState(new Set());
  const [pendingRenewals, setPendingRenewals] = useState(new Set());

  const fetchBooks = useCallback(() => {
    setLoading(true);

    Promise.all([
      api.get('/reservations/history/'),
      api
        .get('/reservations/my-pending-payments/')
        .catch(() => ({ data: { pending_reservation_ids: [] } })),
      api
        .get('/reservations/my-pending-renewals/')
        .catch(() => ({ data: { pending_reservation_ids: [] } })),
    ])
      .then(([historyRes, pendingPaymentsRes, pendingRenewalsRes]) => {
        const pendingPaymentIds = new Set(
          pendingPaymentsRes?.data?.pending_reservation_ids || []
        );
        const pendingRenewalIds = new Set(
          pendingRenewalsRes?.data?.pending_reservation_ids || []
        );

        setPendingPayments(pendingPaymentIds);
        setPendingRenewals(pendingRenewalIds);

        const historyData = Array.isArray(historyRes?.data)
          ? historyRes.data
          : Array.isArray(historyRes?.data?.results)
          ? historyRes.data.results
          : [];

        setBooks(
          historyData.map((item) => {
            const mapped = mapReservation(item);
            if (pendingRenewalIds.has(mapped.id)) mapped.renewalStatus = 'pending';
            if (pendingPaymentIds.has(mapped.id)) mapped.paymentStatus = 'pending';
            return mapped;
          })
        );
      })
      .catch((err) => {
        console.error('Failed to fetch borrowed books:', err);
        setBooks([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  useEffect(() => {
    const handleFocus = () => fetchBooks();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchBooks]);

  const handleRenew = async (reservationId) => {
    setRenewingId(reservationId);
    try {
      await api.post(`/reservations/renew/${reservationId}/`);
      setPendingRenewals((prev) => new Set([...prev, reservationId]));
      setBooks((prev) =>
        prev.map((book) =>
          book.id === reservationId ? { ...book, renewalStatus: 'pending' } : book
        )
      );
    } catch (err) {
      const msg = err?.response?.data?.error || 'Failed to renew. Please try again.';
      alert(msg);
    } finally {
      setRenewingId(null);
    }
  };

  const handlePayClick = (book) => {
    const overdueDays = Math.abs(book.daysLeft || 0);
    const amount = overdueDays * 10;
    setSelectedOverdue({ ...book, overdueDays, amount });
    setShowPayModal(true);
  };

  const closePayModal = () => {
    setShowPayModal(false);
    setSelectedOverdue(null);
  };

  const handleConfirmPayment = async () => {
    if (!selectedOverdue) return;

    try {
      await api.post(`/reservations/pay/${selectedOverdue.id}/`);
      setPendingPayments((prev) => new Set([...prev, selectedOverdue.id]));
      setBooks((prev) =>
        prev.map((book) =>
          book.id === selectedOverdue.id
            ? { ...book, paymentStatus: 'pending' }
            : book
        )
      );
    } catch (err) {
      alert(err?.response?.data?.error || 'Failed to submit payment.');
    } finally {
      closePayModal();
    }
  };

  const dueSoonCount = books.filter(
    (b) => b.status === 'due-soon' || b.status === 'due-today'
  ).length;

  const overdueCount = books.filter((b) => b.status === 'overdue').length;

  return (
    <div className="borrowed-book-container">
      <div className="library-header">
        <div className="header-icon">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="32"
            height="32"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
            />
          </svg>
        </div>
        <h1>My Borrowed Books</h1>
      </div>

      <div className="stats-container">
        <div className="stat-card">
          <div className="stat-number">{books.length}</div>
          <div className="stat-label">Total Borrowed</div>
        </div>
        <div className="stat-card due-soon">
          <div className="stat-number">{dueSoonCount}</div>
          <div className="stat-label">Due Soon</div>
        </div>
        <div className="stat-card overdue">
          <div className="stat-number">{overdueCount}</div>
          <div className="stat-label">Overdue</div>
        </div>
      </div>

      {loading && (
        <div className="loading-state">
          <div className="loading-spinner" />
          <p>Loading your books…</p>
        </div>
      )}

      {!loading && books.length > 0 && (
        <div className="books-grid">
          {books.map((book) => (
            <div key={book.id} className={`book-card status-${book.status}`}>
              <div className="book-cover">
                <img
                  src={book.coverUrl}
                  alt={book.title}
                  loading="lazy"
                  onError={(e) => {
                    e.target.src = '/lib.png';
                  }}
                />
                <div
                  className="book-status-badge"
                  style={{ backgroundColor: getStatusColor(book.status) }}
                >
                  {getStatusLabel(book.status)}
                </div>
              </div>

              <div className="book-info">
                <h2 className="book-title">{book.title}</h2>
                <p className="book-author">by {book.author}</p>

                <div className="due-date-info">
                  <span className="due-label">Due:</span>
                  <span className="due-value">{book.dueDate}</span>
                  <span className={getDaysLeftClass(book.status)}>
                    {getDaysLeftLabel(book.daysLeft, book.status)}
                  </span>
                </div>

                <div className="book-info-spacer" />
              </div>

              <div className="button-container">
                <div className="underline" />

                {book.status !== 'overdue' && (
                  <div className="renew-container">
                    {pendingRenewals.has(book.id) || book.renewalStatus === 'pending' ? (
                      <button className="wait-btn" disabled>
                        ⏳ Awaiting Confirmation
                      </button>
                    ) : (
                      <button
                        className={`renew-btn${renewingId === book.id ? ' loading' : ''}`}
                        onClick={() => handleRenew(book.id)}
                        disabled={renewingId === book.id}
                      >
                        {renewingId === book.id ? 'Renewing…' : 'Renew'}
                      </button>
                    )}
                  </div>
                )}

                {book.status === 'overdue' && (
                  <div className="pay-container">
                    {pendingPayments.has(book.id) || book.paymentStatus === 'pending' ? (
                      <button className="wait-btn" disabled>
                        ⏳ Awaiting Confirmation
                      </button>
                    ) : (
                      <button className="pay-btn" onClick={() => handlePayClick(book)}>
                        💳 Pay Fine
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && books.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="64"
              height="64"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="1.2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
            </svg>
          </div>
          <h3>No Borrowed Books</h3>
          <p>You haven't borrowed any books yet. Head to the library to find your next read!</p>
        </div>
      )}

      {showPayModal && selectedOverdue && (
        <div className="pay-modal-backdrop" onClick={closePayModal}>
          <div className="pay-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Overdue Payment</h2>
            <p>
              Book: <strong>{selectedOverdue.title}</strong>
            </p>
            <p>
              Overdue by: <strong>{selectedOverdue.overdueDays} day(s)</strong>
            </p>
            <p>
              Fine amount: <strong>{selectedOverdue.amount} PHP</strong>
            </p>
            <div className="pay-modal-actions">
              <button className="close-btn" onClick={closePayModal}>
                Cancel
              </button>
              <button className="confirm-btn" onClick={handleConfirmPayment}>
                Confirm Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BorrowedBook;