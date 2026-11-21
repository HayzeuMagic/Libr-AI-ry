const express = require('express');
const cors = require('cors');

const searchRoutes = require('./routes/searchRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const trendingRoutes = require('./routes/trendingRoutes');
const recommendationRoutes = require('./routes/recommendationRoutes');

const app = express();

app.use(cors());
app.use(express.json());

// Borrowing is handled (with auth and stock checks) by the Django API at
// /api/reservations/reserve/. The old unauthenticated /api/borrow routes here
// wrote to a non-existent table and have been removed.
app.use('/api/search', searchRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/trending', trendingRoutes);
app.use('/api/recommendations', recommendationRoutes);

module.exports = app;
