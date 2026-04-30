const router = require('express').Router();
const ctrl = require('../controllers/incomeController');

router.get('/', ctrl.getReport);

module.exports = router;

