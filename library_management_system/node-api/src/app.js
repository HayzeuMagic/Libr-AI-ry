const express = require('express');
const cors = require('cors');

const borrowRoutes = require('./routes/borrowRoutes');
const searchRoutes = require('./routes/searchRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const trendingRoutes = require('./routes/trendingRoutes');
const recommendationRoutes = require('./routes/recommendationRoutes');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/borrow', borrowRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/trending', trendingRoutes);
app.use('/api/recommendations', recommendationRoutes);

module.exports = app;