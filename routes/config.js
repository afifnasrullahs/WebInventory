const router = require('express').Router();
const ctrl = require('../controllers/configController');

router.put('/yummytrack-token', ctrl.saveYummytrackToken);

module.exports = router;