import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import Login from './components/Auth/Login';
import AdminDashboard from './components/Dashboard/AdminDashboard';
import BookSearch from './components/Books/BookSearch';
import BorrowedBook from './pages/BorrowedBook';
import Home from './pages/Home';
import AppLayout from './components/Layout/AppLayout';
import Chatbot from './components/Chatbot/Chatbot';
import AccountSettings from './pages/AccountSettings';
import AdminAccounts from './pages/AdminAccounts';
import Ebooks from './pages/Ebooks';
import StatisticsPage from './pages/StatisticsPage';

// Auth is read from localStorage on every render of the guarded route.
// It used to be read once in App(), which never re-renders on navigation, so
// right after logging in every protected page bounced back to /login.
function RequireAuth({ children, adminOnly = false }) {
  const hasToken = !!localStorage.getItem('accessToken');
  const isAdmin = localStorage.getItem('isAdmin') === 'true';

  if (!hasToken) return <Navigate to="/login" replace />;
  if (adminOnly && !isAdmin) return <Navigate to="/home" replace />;
  return children;
}

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/home" element={<Home />} />
        <Route path="/login" element={<Login />} />

        <Route path="/chatbot" element={<RequireAuth><Chatbot /></RequireAuth>} />
        <Route path="/books" element={<RequireAuth><BookSearch /></RequireAuth>} />
        <Route path="/borrowed" element={<RequireAuth><BorrowedBook /></RequireAuth>} />
        <Route path="/statistics" element={<RequireAuth><StatisticsPage /></RequireAuth>} />
        <Route path="/ebooks" element={<RequireAuth><Ebooks /></RequireAuth>} />
        <Route path="/account" element={<RequireAuth><AccountSettings /></RequireAuth>} />

        <Route path="/admin" element={<RequireAuth adminOnly><AdminDashboard /></RequireAuth>} />
        <Route path="/admin/accounts" element={<RequireAuth adminOnly><AdminAccounts /></RequireAuth>} />

        <Route path="*" element={<Navigate to="/home" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
