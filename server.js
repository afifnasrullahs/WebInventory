require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const errorHandler = require('./middleware/errorHandler');

const itemRoutes = require('./routes/items');
const setRoutes = require('./routes/sets');
const transactionRoutes = require('./routes/transactions');
const jokiRoutes = require('./routes/joki');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/items', itemRoutes);
app.use('/api/sets', setRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/joki', jokiRoutes);

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
