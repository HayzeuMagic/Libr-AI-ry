import React, { useState, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { logout, getCurrentUser } from '../../services/auth';
import './header.css';
import NotificationBell from '../NotificationBell';
import api from '../../services/api';

const iconColor = (type) => {
  if (type === 'overdue') return '🔴';
  if (type === 'due_today') return '🟠';
  if (type === 'due_soon') return '🟡';
  return '🟢';
};

const Header = () => {
  const { isAuthenticated, isAdmin } = getCurrentUser();
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [deletingId, setDeletingId] = useState(null);
  const bellRef = useRef(null);

  const collapsed = !hovered;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleOpenModal = () => {
    if (bellRef.current?.refetch) bellRef.current.refetch();
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await api.delete(`/reservations/notifications/dismiss/${id}/`);
    } catch (err) {
      console.error('Failed to dismiss notification:', err);
    } finally {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setDeletingId(null);
    }
  };

  const handleDeleteAll = async () => {
    const ids = notifications.map((n) => n.id);
    setNotifications([]);
    try {
      await Promise.all(
        ids.map((id) =>
          api.delete(`/reservations/notifications/dismiss/${id}/`)
        )
      );
    } catch (err) {
      console.error('Failed to dismiss all notifications:', err);
    }
  };

  const navLink = (to, icon, label, end = false) => (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `sidebar-link ${isActive ? 'sidebar-link--active' : ''}`
      }
    >
      <span className="sidebar-link-icon">{icon}</span>
      {!collapsed && <span className="sidebar-link-label">{label}</span>}
    </NavLink>
  );

  return (
    <>
      {showModal && (
        <div className="notif-backdrop" onClick={() => setShowModal(false)}>
          <div className="notif-modal" onClick={(e) => e.stopPropagation()}>
            <div className="notif-modal-header">
              <div className="notif-modal-title">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  width={20}
                  height={20}
                >
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                <h2>Notifications</h2>
                {notifications.length > 0 && (
                  <span className="notif-modal-count">{notifications.length}</span>
                )}
              </div>

              <div className="notif-modal-actions">
                {notifications.length > 0 && (
                  <button
                    className="notif-clear-all-btn"
                    onClick={handleDeleteAll}
                    title="Clear all notifications"
                  >
                    Clear all
                  </button>
                )}
                <button
                  className="notif-close-btn"
                  onClick={() => setShowModal(false)}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="notif-modal-body">
              {notifications.length === 0 ? (
                <div className="notif-modal-empty">
                  <span>🎉</span>
                  <p>You're all caught up!</p>
                </div>
              ) : (
                <ul className="notif-modal-list">
                  {notifications.map((n, idx) => (
                    <li
                      key={n.id ?? idx}
                      className={`notif-modal-item notif-type-${n.type} ${
                        deletingId === n.id ? 'notif-modal-item--deleting' : ''
                      }`}
                    >
                      <span className="notif-modal-icon">{iconColor(n.type)}</span>
                      <div className="notif-modal-content">
                        <p className="notif-modal-message">{n.message}</p>
                        {n.due_date && (
                          <span className="notif-modal-date">Due: {n.due_date}</span>
                        )}
                      </div>
                      <button
                        className="notif-delete-btn"
                        onClick={() => handleDelete(n.id)}
                        disabled={deletingId === n.id}
                        aria-label="Dismiss notification"
                        title="Dismiss"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      <aside
        className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div className="sidebar-brand">
          <span className="sidebar-brand-icon">📚</span>
          {!collapsed && <span className="sidebar-brand-text">LIBR-AI-RY</span>}
        </div>

        <nav className="sidebar-nav">
          {isAuthenticated && (
            <NotificationBell
              ref={bellRef}
              onClick={handleOpenModal}
              collapsed={collapsed}
              notifications={notifications}
              onNotificationsChange={setNotifications}
            />
          )}

          {navLink('/home', '🏠', 'Home', true)}

          {!isAuthenticated && (
            <>
              {navLink('/login', '🔑', 'Login', true)}
            </>
          )}

          {isAuthenticated && !isAdmin && (
            <>
              
              {navLink('/chatbot', '🤖', 'Chatbot')}
              {navLink('/books', '📖', 'Our Books')}
              {navLink('/borrowed', '🔖', 'Borrowed Books')}
              {navLink('/ebooks', '📘', 'E-Books')}
            </>
          )}

          {isAuthenticated && isAdmin && (
            <>
              {navLink('/chatbot', '🤖', 'Chatbot')}
              {navLink('/books', '📖', 'Our Books')}
              {navLink('/admin', '⚙️', 'Manage Books', true)}
              {navLink('/admin/accounts', '👥', 'Manage Users')}
            </>
          )}
        </nav>

        {isAuthenticated && (
          <div className="sidebar-bottom">
            {navLink('/account', '👤', 'Settings', true)}
            <button className="sidebar-link sidebar-logout" onClick={handleLogout}>
              <span className="sidebar-link-icon">🚪</span>
              {!collapsed && <span className="sidebar-link-label">Logout</span>}
            </button>
          </div>
        )}
      </aside>
    </>
  );
};

export default Header;


// {navLink('/statistics', '📊', 'Statistics')}