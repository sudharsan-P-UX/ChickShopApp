const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const authMiddleware = require('../middlewares/authMiddleware');

router.get('/:phone', authMiddleware, customerController.getCustomer);
router.post('/', authMiddleware, customerController.addCustomer);
router.get('/', authMiddleware, customerController.getAllCustomers);

module.exports = router;
