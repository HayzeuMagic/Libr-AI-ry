// frontend/src/pages/admin/AdminDashboard.js
import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const [reservations, setReservations] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [exporting, setExporting] = useState(false);
  const [returningId, setReturningId] = useState(null);
  const [stats, setStats] = useState({ total: 0, borrowed: 0, overdue: 0, returned: 0 });

  const [payments, setPayments] = useState([]);
  const [confirmingId, setConfirmingId] = useState(null);
  const [renewals, setRenewals] = useState([]);
  const [confirmingRenewalId, setConfirmingRenewalId] = useState(null);

  const [paidReservationIds, setPaidReservationIds] = useState(new Set());

  const [csvFile, setCsvFile] = useState(null);
  const [csvUploading, setCsvUploading] = useState(false);
  const [csvResult, setCsvResult] = useState(null);

  const loadReservations = useCallback(async () => {
    try {
      setLoading(true);

      const res = await api.get('/reservations/all/', {
        params: { page, page_size: pageSize },
      });

      const results = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.results)
        ? res.data.results
        : [];

      setReservations(results);
      setTotalPages(res.data?.total_pages || 1);
      if (res.data?.stats) setStats(res.data.stats);
      setError(null);
    } catch (err) {
      setError('Failed to load reservations. Please try again later.');
      console.error('Error loading reservations:', err);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    loadReservations();
  }, [loadReservations]);

  const loadPayments = useCallback(async () => {
    try {
      const res = await api.get('/reservations/admin/payments/');

      const results = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.results)
        ? res.data.results
        : [];

      setPayments(results);
    } catch (err) {
      console.error('Error loading payments:', err);
      setPayments([]);
    }
  }, []);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  const loadRenewals = useCallback(async () => {
    try {
      const res = await api.get('/reservations/admin/renewals/');

      const results = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.results)
        ? res.data.results
        : [];

      setRenewals(results);
    } catch (err) {
      console.error('Error loading renewals:', err);
      setRenewals([]);
    }
  }, []);

  useEffect(() => {
    loadRenewals();
  }, [loadRenewals]);

  useEffect(() => {
    const handleFocus = () => {
      loadReservations();
      loadPayments();
      loadRenewals();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [loadReservations, loadPayments, loadRenewals]);

  const pendingItems = [
    ...renewals.map((r) => ({ ...r, type: 'renewal' })),
    ...payments.map((p) => ({ ...p, type: 'payment' })),
  ];

  const handleExportExcel = async () => {
    try {
      setExporting(true);

      const response = await api.get('/reservations/export/excel/', {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'reservations.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to export. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const handleCsvUpload = async () => {
    if (!csvFile) return;

    const formData = new FormData();
    formData.append('file', csvFile);

    try {
      setCsvUploading(true);
      setCsvResult(null);

      const res = await api.post('/bulk-create-users/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setCsvResult(res.data);
      setCsvFile(null);
    } catch (err) {
      setCsvResult({
        error: err.response?.data?.error || 'Upload failed.',
      });
    } finally {
      setCsvUploading(false);
    }
  };

  const isOverdueReservation = (r) =>
    (!r.return_date && r.overdue_unreturned) || r.status === 'overdue';

  const getPaymentStatus = (r) => {
    if (paidReservationIds.has(r.id)) return 'paid';

    const rawStatus = (
      r.payment_status ||
      r.penalty_status ||
      r.penalty_payment_status ||
      ''
    )
      .toString()
      .toLowerCase();

    if (['paid', 'settled', 'complete', 'completed'].includes(rawStatus)) {
      return 'paid';
    }

    if (r.is_paid === true || r.paid === true || r.penalty_paid === true) {
      return 'paid';
    }

    const confirmed = payments.find(
      (p) => p.reservation_id === r.id && p.status === 'confirmed'
    );
    if (confirmed) return 'paid';

    const pending = payments.find(
      (p) => p.reservation_id === r.id && p.status === 'pending'
    );
    if (pending) return 'pending_payment';

    if (!isOverdueReservation(r) && r.status === 'returned') return 'not_applicable';
    if (!isOverdueReservation(r) && r.status !== 'overdue') return 'not_applicable';

    if (['not paid', 'not_paid', 'unpaid', 'pending'].includes(rawStatus)) {
      return 'not_paid';
    }

    if (r.is_paid === false || r.paid === false || r.penalty_paid === false) {
      return 'not_paid';
    }

    return 'not_paid';
  };

  const canReturnBook = (r) => {
    const paymentStatus = getPaymentStatus(r);
    const s = (r.status || '').toLowerCase();
    const isOverdue = isOverdueReservation(r);

    if (r.return_date) return false;
    if (!isOverdue && s === 'borrowed') return true;

    return (
      isOverdue &&
      paymentStatus === 'paid' &&
      (s === 'borrowed' || s === 'overdue' || r.overdue_unreturned)
    );
  };

  const handleReturnBook = async (reservation) => {
    if (!canReturnBook(reservation)) return;

    try {
      setReturningId(reservation.id);
      await api.post(`/reservations/admin-return/${reservation.id}/`);

      const today = new Date().toISOString().slice(0, 10);

      loadReservations();
      setReservations((prev) =>
        prev.map((r) =>
          r.id === reservation.id
            ? {
                ...r,
                status: 'returned',
                return_date: today,
                overdue_unreturned: false,
              }
            : r
        )
      );
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to return book.');
    } finally {
      setReturningId(null);
    }
  };

  const handleConfirmPayment = async (paymentId, reservationId) => {
    setConfirmingId(paymentId);

    try {
      await api.post(`/reservations/admin/payments/${paymentId}/confirm/`);

      setPayments((prev) => prev.filter((p) => p.payment_id !== paymentId));
      setPaidReservationIds((prev) => new Set([...prev, reservationId]));
      loadReservations();

      const today = new Date().toISOString().slice(0, 10);

      setReservations((prev) =>
        prev.map((r) =>
          r.id === reservationId
            ? {
                ...r,
                status: 'returned',
                return_date: today,
                overdue_unreturned: false,
                payment_status: 'paid',
                is_paid: true,
                paid: true,
                penalty_paid: true,
              }
            : r
        )
      );
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to confirm payment.');
    } finally {
      setConfirmingId(null);
    }
  };

  const handleConfirmRenewal = async (renewalId) => {
    setConfirmingRenewalId(renewalId);

    try {
      await api.post(`/reservations/admin/renewals/${renewalId}/confirm/`);
      setRenewals((prev) => prev.filter((r) => r.renewal_id !== renewalId));
      loadReservations();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to confirm renewal.');
    } finally {
      setConfirmingRenewalId(null);
    }
  };

  const StatusBadge = ({ status }) => {
    const statusKey = (status || '').toLowerCase();

    const statusConfig = {
      borrowed: {
        className: 'status-badge status-badge-borrowed',
        label: 'Borrowed',
      },
      returned: {
        className: 'status-badge status-badge-returned',
        label: 'Returned',
      },
      overdue: {
        className: 'status-badge status-badge-overdue',
        label: 'OVERDUE',
      },
      pending: {
        className: 'status-badge status-badge-pending',
        label: 'Pending',
      },
    };

    const config = statusConfig[statusKey] || {
      className: 'status-badge status-badge-default',
      label: status || 'Unknown',
    };

    return <span className={config.className}>{config.label}</span>;
  };

  const PaymentBadge = ({ paymentStatus }) => {
    if (paymentStatus === 'not_applicable') {
      return <span className="payment-empty">-</span>;
    }
    if (paymentStatus === 'paid') {
      return <span className="payment-badge payment-paid">Paid</span>;
    }
    if (paymentStatus === 'pending_payment') {
      return <span className="payment-badge payment-pending">Pending</span>;
    }
    return <span className="payment-badge payment-not-paid">Not Paid</span>;
  };

  const TypeBadge = ({ type }) => (
    <span className={`type-badge type-badge-${type}`}>
      {type === 'renewal' ? '🔄 Renewal' : '💳 Payment'}
    </span>
  );

  const filteredReservations = reservations.filter((r) => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;

    return (
      (r.user_username || '').toLowerCase().includes(term) ||
      (r.book_title || '').toLowerCase().includes(term)
    );
  });

  return (
    <div className="admin-dashboard">
      <header className="dashboard-header">
        <div className="header-left">
          <h1>Admin Dashboard</h1>
          <p className="header-subtitle">Manage book reservations and user imports</p>
        </div>
      </header>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="icon-24"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
            </div>
            <div className="stat-text">
              <h3 className="stat-value">{stats.total}</h3>
              <p className="stat-label">Total Reservations</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="icon-24"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div className="stat-text">
              <h3 className="stat-value">{stats.borrowed}</h3>
              <p className="stat-label">Currently Borrowed</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="icon-24"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div className="stat-text">
              <h3 className="stat-value">{stats.overdue}</h3>
              <p className="stat-label">Overdue Books</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="icon-24"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div className="stat-text">
              <h3 className="stat-value">{stats.returned}</h3>
              <p className="stat-label">Returned Books</p>
            </div>
          </div>
        </div>

        {pendingItems.length > 0 && (
          <section className="card reservations-section">
            <div className="card-header">
              <div className="header-left">
                <h2 className="card-title">Pending Actions</h2>
                <p className="card-subtitle">Renewals and payments awaiting confirmation</p>
              </div>
            </div>

            <div className="table-container">
              <table className="reservations-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Book</th>
                    <th>Due Date</th>
                    <th>Type</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingItems.map((item) => {
                    const isRenewal = item.type === 'renewal';
                    const key = isRenewal
                      ? `renewal-${item.renewal_id}`
                      : `payment-${item.payment_id}`;
                    const student = item.student || '-';
                    const bookTitle = item.book_title || '-';
                    const dueDate = item.due_date ? String(item.due_date).slice(0, 10) : '-';
                    const isConfirming = isRenewal
                      ? confirmingRenewalId === item.renewal_id
                      : confirmingId === item.payment_id;

                    return (
                      <tr key={key}>
                        <td className="user-cell">
                          <div className="user-info">
                            <div className="user-avatar">{student?.charAt(0) || '?'}</div>
                            <div className="user-details">
                              <div className="user-name">{student}</div>
                            </div>
                          </div>
                        </td>
                        <td className="book-cell">
                          <div className="book-title">{bookTitle}</div>
                        </td>
                        <td className="date-cell">{dueDate}</td>
                        <td className="type-cell">
                          <TypeBadge type={item.type} />
                        </td>
                        <td className="return-cell">
                          {isRenewal ? (
                            <button
                              className="return-btn return-btn-active"
                              onClick={() => handleConfirmRenewal(item.renewal_id)}
                              disabled={isConfirming}
                            >
                              {isConfirming ? 'Confirming…' : 'Confirm Renewal'}
                            </button>
                          ) : (
                            <button
                              className="return-btn return-btn-payment"
                              onClick={() =>
                                handleConfirmPayment(item.payment_id, item.reservation_id)
                              }
                              disabled={isConfirming}
                            >
                              {isConfirming ? 'Confirming…' : 'Confirm & Return'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section className="card reservations-section">
          <div className="card-header">
            <div className="header-left">
              <h2 className="card-title">Borrowed Books Overview</h2>
              <p className="card-subtitle">All reservations across the system</p>
            </div>

            <div className="card-header-actions">
              <button className="btn-export" onClick={handleExportExcel} disabled={exporting}>
                {exporting ? (
                  <>
                    <span className="export-spinner" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Export to Excel
                  </>
                )}
              </button>

              <div className="search-bar">
                <input
                  type="text"
                  placeholder="Search by student or book..."
                  className="search-input"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <button type="button" className="search-button" onClick={() => setPage(1)}>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="icon-16"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div className="table-container">
            {loading ? (
              <div className="loading-state">
                <div className="spinner" />
                <p>Loading reservations...</p>
              </div>
            ) : error ? (
              <div className="error-state">
                <p>{error}</p>
                <button onClick={() => window.location.reload()} className="btn-primary">
                  Retry
                </button>
              </div>
            ) : (
              <>
                <table className="reservations-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Book</th>
                      <th>Borrowed On</th>
                      <th>Due Date</th>
                      <th>Returned On</th>
                      <th>Book Status</th>
                      <th>Payment Status</th>
                      <th>Return</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReservations.map((r) => {
                      const paymentStatus = getPaymentStatus(r);
                      const returnAllowed = canReturnBook(r);

                      return (
                        <tr key={r.id}>
                          <td className="user-cell">
                            <div className="user-info">
                              <div className="user-avatar">
                                {r.user_username?.charAt(0) || '?'}
                              </div>
                              <div className="user-details">
                                <div className="user-name">{r.user_username || '-'}</div>
                              </div>
                            </div>
                          </td>

                          <td className="book-cell">
                            <div className="book-info">
                              <div className="book-title">{r.book_title || '-'}</div>
                            </div>
                          </td>

                          <td className="date-cell">
                            <div className="date-display">{r.borrow_date?.slice(0, 10) || '-'}</div>
                          </td>

                          <td className="date-cell">
                            <div className="date-display">{r.due_date?.slice(0, 10) || '-'}</div>
                          </td>

                          <td className="date-cell">
                            <div
                              className={
                                'date-display' +
                                (r.overdue_unreturned && !r.return_date ? ' overdue' : '')
                              }
                            >
                              {r.return_date
                                ? r.return_date.slice(0, 10)
                                : r.overdue_unreturned
                                ? 'OVERDUE'
                                : '-'}
                            </div>
                          </td>

                          <td className="status-cell">
                            <StatusBadge status={r.status} />
                          </td>

                          <td className="payment-cell">
                            <PaymentBadge paymentStatus={paymentStatus} />
                          </td>

                          <td className="return-cell">
                            <button
                              className={`return-btn ${
                                returnAllowed ? 'return-btn-active' : 'return-btn-disabled'
                              }`}
                              onClick={() => handleReturnBook(r)}
                              disabled={!returnAllowed || returningId === r.id}
                            >
                              {returningId === r.id ? 'Returning...' : 'Return'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}

                    {filteredReservations.length === 0 && (
                      <tr>
                        <td colSpan="8" className="empty-state">
                          <p>No reservations found.</p>
                          <p className="empty-subtitle">Try adjusting your search</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {totalPages > 1 && (
                  <div className="pagination">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="pagination-btn"
                    >
                      <span className="pagination-arrow">{'<'}</span>
                      <span>Previous</span>
                    </button>

                    <div className="pagination-info">
                      Page {page} of {totalPages}
                    </div>

                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="pagination-btn"
                    >
                      <span>Next</span>
                      <span className="pagination-arrow">{'>'}</span>
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
    
    </div>
  )
};

export default AdminDashboard;