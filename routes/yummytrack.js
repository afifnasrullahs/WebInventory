const router = require('express').Router();
const ctrl = require('../controllers/yummytrackController');

router.get('/pets-vps', ctrl.importPetsVps);

module.exports = router;