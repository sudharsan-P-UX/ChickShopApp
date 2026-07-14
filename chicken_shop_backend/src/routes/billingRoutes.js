const express = require('express');
const router = express.Router();
const billingController = require('../controllers/billingController');

router.post('/pending', billingController.savePendingBill);
router.get('/pending', billingController.getPendingBills);
router.delete('/pending/:id', billingController.deletePendingBill);

router.post('/complete', billingController.completeBill);
router.get('/completed', billingController.getCompletedBills);

module.exports = router;
