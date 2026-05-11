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

function App() {
  const hasToken = !!localStorage.getItem('accessToken');
  const isAdmin = localStorage.getItem('isAdmin') === 'true';

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/home" element={<Home />} />
        <Route path="/login" element={<Login />} />

        <Route
          path="/chatbot"
          element={hasToken ? <Chatbot /> : <Navigate to="/login" replace />}
        />

        <Route
          path="/books"
          element={hasToken ? <BookSearch /> : <Navigate to="/login" replace />}
        />

        <Route
          path="/admin/accounts"
           element={hasToken && isAdmin ? <AdminAccounts /> : <Navigate to="/login" replace />}
         />
        <Route
          path="/borrowed"
          element={hasToken ? <BorrowedBook /> : <Navigate to="/login" replace />}
        />
    
        <Route
        path="/statistics"
        element={hasToken ? <StatisticsPage /> : <Navigate to="/login" replace />}
      />  
        <Route
          path="/admin"
          element={hasToken && isAdmin ? <AdminDashboard /> : <Navigate to="/login" replace />}
        />

        <Route
          path="/ebooks"
          element={hasToken ? <Ebooks /> : <Navigate to="/login" replace />}
        />

        <Route
          path="/account"
          element={hasToken ? <AccountSettings /> : <Navigate to="/login" replace />}
        />

        <Route path="*" element={<Navigate to="/home" replace />} />
      </Route>
    </Routes>
  );
}

export default App;