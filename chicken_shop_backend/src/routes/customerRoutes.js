const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const authMiddleware = require('../middlewares/authMiddleware');
const authorize = require('../middlewares/authorize');

router.get('/:phone', authMiddleware, authorize('customers', 'view'), customerController.getCustomer);
router.post('/', authMiddleware, authorize('customers', 'add'), customerController.addCustomer);
router.get('/', authMiddleware, authorize('customers', 'view'), customerController.getAllCustomers);

module.exports = router;
