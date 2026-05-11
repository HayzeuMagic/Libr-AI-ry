import React from 'react';
import MostBorrowedThisWeekCard from '../components/statistics/MostBorrowedThisWeekCard';
import TrendingBooksCard from '../components/statistics/TrendingBooksCard';
import RecommendedForYouCard from '../components/statistics/RecommendedForYouCard';
import StudentsAlsoBorrowedCard from '../components/statistics/StudentsAlsoBorrowedCard';
import './StatisticsPage.css';

function StatisticsPage() {
  return (
    <div className="statistics-page">
      <h1 className="statistics-page-title">Library Statistics</h1>
      <div className="statistics-grid">
        <MostBorrowedThisWeekCard />
        <TrendingBooksCard />
        <RecommendedForYouCard />
        <StudentsAlsoBorrowedCard />
      </div>
    </div>
  );
}

export default StatisticsPage;