const express = require('express');
const router = express.Router();
const billingController = require('../controllers/billingController');
const authMiddleware = require('../middlewares/authMiddleware');
const authorize = require('../middlewares/authorize');

router.post('/pending', authMiddleware, authorize('pending', 'add'), billingController.savePendingBill);
router.get('/pending', authMiddleware, authorize('pending', 'view'), billingController.getPendingBills);
router.delete('/pending/:id', authMiddleware, authorize('pending', 'delete'), billingController.deletePendingBill);

router.post('/complete', authMiddleware, authorize('billing', 'add'), billingController.completeBill);
router.get('/completed', authMiddleware, authorize('billing', 'view'), billingController.getCompletedBills);

module.exports = router;
