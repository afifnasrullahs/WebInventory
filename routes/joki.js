const router = require('express').Router();
const ctrl = require('../controllers/jokiController');

// Services
router.get('/services', ctrl.getAllServices);
router.post('/services', ctrl.createService);
router.put('/services/:id', ctrl.updateService);
router.delete('/services/:id', ctrl.deleteService);

// Orders
router.get('/orders', ctrl.getAllOrders);
router.post('/orders', ctrl.createOrder);
router.get('/orders/:id', ctrl.getOrderById);
router.put('/orders/:id', ctrl.updateOrder);
router.put('/orders/:id/status', ctrl.updateOrderStatus);
router.put('/orders/:id/cancel', ctrl.cancelOrder);

module.exports = router;
