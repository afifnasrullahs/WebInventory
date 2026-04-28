const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/items', require('../routes/items'));
app.use('/api/sets', require('../routes/sets'));
app.use('/api/transactions', require('../routes/transactions'));
app.use('/api/joki', require('../routes/joki'));

// Error handler
app.use(require('../middleware/errorHandler'));

module.exports = app;
