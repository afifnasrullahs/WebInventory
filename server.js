require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const errorHandler = require('./middleware/errorHandler');

const itemRoutes = require('./routes/items');
const setRoutes = require('./routes/sets');
const transactionRoutes = require('./routes/transactions');
const jokiRoutes = require('./routes/joki');
const activityRoutes = require('./routes/activities');
const incomeRoutes = require('./routes/income');
const configRoutes = require('./routes/config');
const yummytrackRoutes = require('./routes/yummytrack');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

// API Routes
app.use('/api/items', itemRoutes);
app.use('/api/sets', setRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/joki', jokiRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/income', incomeRoutes);
app.use('/api/config', configRoutes);
app.use('/api/yummytrack', yummytrackRoutes);

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handler
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
