import React, { useEffect, forwardRef, useImperativeHandle } from 'react';
import api from '../services/api';

const NotificationBell = forwardRef(({ onClick, collapsed, notifications, onNotificationsChange }, ref) => {

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/reservations/notifications/');
      onNotificationsChange(res.data.notifications || []);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  // Expose refetch to parent
  useImperativeHandle(ref, () => ({ refetch: fetchNotifications }));

  const unreadCount = notifications.length;

  return (
    <button
      className="sidebar-link sidebar-notif-btn"
      onClick={onClick}
      title="Notifications"
      aria-label="Open notifications"
    >
      <span className="sidebar-link-icon notif-icon-wrap">
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
        {unreadCount > 0 && (
          <span className="notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </span>
      {!collapsed && <span>Notifications</span>}
    </button>
  );
});

export default NotificationBell;