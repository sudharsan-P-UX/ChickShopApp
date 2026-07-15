const express = require('express');
const router = express.Router();
const billingController = require('../controllers/billingController');
const authMiddleware = require('../middlewares/authMiddleware');

router.post('/pending', authMiddleware, billingController.savePendingBill);
router.get('/pending', authMiddleware, billingController.getPendingBills);
router.delete('/pending/:id', authMiddleware, billingController.deletePendingBill);

router.post('/complete', authMiddleware, billingController.completeBill);
router.get('/completed', authMiddleware, billingController.getCompletedBills);

module.exports = router;
