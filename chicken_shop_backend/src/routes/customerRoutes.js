const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');

router.get('/:phone', customerController.getCustomer);
router.post('/', customerController.addCustomer);
router.get('/', customerController.getAllCustomers);

module.exports = router;
