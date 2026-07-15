const express = require('express');
const router = express.Router();
const labelController = require('../controllers/labelController');
const authMiddleware = require('../middlewares/authMiddleware');
const authorize = require('../middlewares/authorize');

router.get('/', authMiddleware, authorize('custom_labels', 'view'), labelController.getAllLabels);
router.put('/', authMiddleware, authorize('custom_labels', 'edit'), labelController.updateLabels);

module.exports = router;
