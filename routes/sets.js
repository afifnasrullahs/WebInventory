const router = require('express').Router();
const ctrl = require('../controllers/setController');

router.get('/', ctrl.getAll);
router.post('/', ctrl.create);
router.get('/:id', ctrl.getById);
router.put('/:id', ctrl.update);
router.delete('/:id', ctrl.delete);
router.post('/:id/items', ctrl.addItem);
router.delete('/:id/items/:itemId', ctrl.removeItem);

module.exports = router;
