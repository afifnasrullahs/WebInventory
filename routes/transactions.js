const router = require('express').Router();
const ctrl = require('../controllers/transactionController');

router.post('/', ctrl.create);
router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getById);
router.put('/:id', ctrl.update);
router.put('/:id/status', ctrl.updateStatus);
router.put('/:id/cancel', ctrl.cancel);
router.put('/:id/full', ctrl.updateFull);
router.delete('/:id', ctrl.delete);

module.exports = router;
