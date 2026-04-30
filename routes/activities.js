const router = require('express').Router();
const ctrl = require('../controllers/activityController');

router.get('/', ctrl.getAll);
router.post('/', ctrl.create);
router.put('/:id/approve', ctrl.approve);

module.exports = router;

