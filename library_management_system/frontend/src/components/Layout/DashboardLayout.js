// src/components/Layout/DashboardLayout.js
import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Header from '../common/Header';

function DashboardLayout() {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="app-dashboard-layout">
      <Header collapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />
      <main className="app-main-content">{/* Page content */ <Outlet />}</main>
    </div>
  );
}

export default DashboardLayout;